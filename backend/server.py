from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Query
from fastapi.responses import JSONResponse, StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import cloudinary
import cloudinary.utils
import cloudinary.uploader
import time
import httpx
import bcrypt
import jwt
import io

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Cloudinary configuration
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

# JWT Configuration
JWT_SECRET = os.environ.get("JWT_SECRET", "lux-studio-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ======================= PASSWORD & JWT HELPERS =======================

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id, 
        "email": email, 
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        "type": "access"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id, 
        "exp": datetime.now(timezone.utc) + timedelta(days=7), 
        "type": "refresh"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

# ======================= MODELS =======================

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    role: str = "admin"
    created_at: datetime

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str

class Event(BaseModel):
    model_config = ConfigDict(extra="ignore")
    event_id: str
    name: str
    date: str
    description: str
    photographer_name: str
    cover_image: Optional[str] = None
    cover_public_id: Optional[str] = None
    published: bool = True
    created_by: str
    created_at: datetime
    updated_at: datetime

class EventCreate(BaseModel):
    name: str
    date: str
    description: str = ""
    photographer_name: str = ""
    cover_image: Optional[str] = None
    cover_public_id: Optional[str] = None
    published: bool = True

class EventUpdate(BaseModel):
    name: Optional[str] = None
    date: Optional[str] = None
    description: Optional[str] = None
    photographer_name: Optional[str] = None
    cover_image: Optional[str] = None
    cover_public_id: Optional[str] = None
    published: Optional[bool] = None

class Photo(BaseModel):
    model_config = ConfigDict(extra="ignore")
    photo_id: str
    event_id: str
    cloudinary_url: str
    public_id: str
    width: int
    height: int
    created_at: datetime

class PhotoCreate(BaseModel):
    event_id: str
    cloudinary_url: str
    public_id: str
    width: int
    height: int

# ======================= AUTH HELPERS =======================

async def get_current_user(request: Request) -> User:
    """Get the current authenticated user from JWT token."""
    token = request.cookies.get("access_token")
    
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        
        user_id = payload.get("sub")
        user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        
        if not user_doc:
            raise HTTPException(status_code=401, detail="User not found")
        
        # Remove password_hash from response
        user_doc.pop("password_hash", None)
        
        # Convert datetime if needed
        if isinstance(user_doc.get('created_at'), str):
            user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
        
        return User(**user_doc)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ======================= AUTH ROUTES =======================

@api_router.post("/auth/login")
async def login(request: LoginRequest, response: Response):
    """Login with email and password."""
    email = request.email.lower()
    
    user_doc = await db.users.find_one({"email": email}, {"_id": 0})
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(request.password, user_doc.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Create tokens
    access_token = create_access_token(user_doc["user_id"], email)
    refresh_token = create_refresh_token(user_doc["user_id"])
    
    # Set cookies
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=24 * 60 * 60,
        path="/"
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7 * 24 * 60 * 60,
        path="/"
    )
    
    # Return user without password
    user_doc.pop("password_hash", None)
    return user_doc

@api_router.post("/auth/register")
async def register(request: RegisterRequest, response: Response):
    """Register a new admin user."""
    email = request.email.lower()
    
    # Check if user exists
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    password_hash = hash_password(request.password)
    now = datetime.now(timezone.utc)
    
    user_doc = {
        "user_id": user_id,
        "email": email,
        "name": request.name,
        "password_hash": password_hash,
        "role": "admin",
        "created_at": now.isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    # Create tokens
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    # Set cookies
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=24 * 60 * 60,
        path="/"
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7 * 24 * 60 * 60,
        path="/"
    )
    
    # Return user without password
    user_doc.pop("password_hash", None)
    user_doc.pop("_id", None)
    return user_doc

@api_router.get("/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user."""
    return current_user.model_dump()

@api_router.post("/auth/logout")
async def logout(response: Response):
    """Logout and clear session."""
    response.delete_cookie(key="access_token", path="/", secure=True, samesite="none")
    response.delete_cookie(key="refresh_token", path="/", secure=True, samesite="none")
    return {"message": "Logged out successfully"}

@api_router.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    """Refresh access token."""
    refresh_token = request.cookies.get("refresh_token")
    
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")
    
    try:
        payload = jwt.decode(refresh_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        
        user_id = payload.get("sub")
        user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        
        if not user_doc:
            raise HTTPException(status_code=401, detail="User not found")
        
        # Create new access token
        access_token = create_access_token(user_id, user_doc["email"])
        
        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            secure=True,
            samesite="none",
            max_age=24 * 60 * 60,
            path="/"
        )
        
        return {"message": "Token refreshed"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

# ======================= CLOUDINARY ROUTES =======================

@api_router.get("/cloudinary/signature")
async def generate_signature(
    resource_type: str = Query("image", enum=["image", "video"]),
    folder: str = "luxstudio",
    current_user: User = Depends(get_current_user)
):
    """Generate a signed upload signature for Cloudinary."""
    ALLOWED_FOLDERS = ("luxstudio", "luxstudio/events", "luxstudio/covers")
    
    if not any(folder.startswith(f) for f in ALLOWED_FOLDERS):
        raise HTTPException(status_code=400, detail="Invalid folder path")
    
    timestamp = int(time.time())
    params = {
        "timestamp": timestamp,
        "folder": folder,
    }
    
    signature = cloudinary.utils.api_sign_request(
        params,
        os.getenv("CLOUDINARY_API_SECRET")
    )
    
    return {
        "signature": signature,
        "timestamp": timestamp,
        "cloud_name": os.getenv("CLOUDINARY_CLOUD_NAME"),
        "api_key": os.getenv("CLOUDINARY_API_KEY"),
        "folder": folder,
        "resource_type": resource_type
    }

# ======================= DASHBOARD STATS =======================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    """Get dashboard statistics."""
    events_count = await db.events.count_documents({"created_by": current_user.user_id})
    
    # Get photo counts per event for current user's events
    user_events = await db.events.find(
        {"created_by": current_user.user_id},
        {"_id": 0, "event_id": 1}
    ).to_list(1000)
    
    event_ids = [e["event_id"] for e in user_events]
    user_photos_count = await db.photos.count_documents({"event_id": {"$in": event_ids}})
    
    return {
        "total_events": events_count,
        "total_photos": user_photos_count
    }

# ======================= EVENT ROUTES (ADMIN) =======================

@api_router.get("/events", response_model=List[Event])
async def get_events(current_user: User = Depends(get_current_user)):
    """Get all events for the current admin user."""
    events = await db.events.find(
        {"created_by": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    # Get photo counts for each event
    for event in events:
        count = await db.photos.count_documents({"event_id": event["event_id"]})
        event["photo_count"] = count
        if isinstance(event.get('created_at'), str):
            event['created_at'] = datetime.fromisoformat(event['created_at'])
        if isinstance(event.get('updated_at'), str):
            event['updated_at'] = datetime.fromisoformat(event['updated_at'])
    
    return events

@api_router.post("/events", response_model=Event, status_code=201)
async def create_event(
    event_data: EventCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new event."""
    now = datetime.now(timezone.utc)
    event = {
        "event_id": f"evt_{uuid.uuid4().hex[:12]}",
        "name": event_data.name,
        "date": event_data.date,
        "description": event_data.description,
        "photographer_name": event_data.photographer_name,
        "cover_image": event_data.cover_image,
        "cover_public_id": event_data.cover_public_id,
        "published": event_data.published,
        "created_by": current_user.user_id,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.events.insert_one(event)
    event.pop("_id", None)
    event["created_at"] = now
    event["updated_at"] = now
    return event

@api_router.get("/events/{event_id}", response_model=Event)
async def get_event(event_id: str, current_user: User = Depends(get_current_user)):
    """Get a specific event."""
    event = await db.events.find_one(
        {"event_id": event_id, "created_by": current_user.user_id},
        {"_id": 0}
    )
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Get photo count
    count = await db.photos.count_documents({"event_id": event_id})
    event["photo_count"] = count
    
    if isinstance(event.get('created_at'), str):
        event['created_at'] = datetime.fromisoformat(event['created_at'])
    if isinstance(event.get('updated_at'), str):
        event['updated_at'] = datetime.fromisoformat(event['updated_at'])
    
    return event

@api_router.put("/events/{event_id}", response_model=Event)
async def update_event(
    event_id: str,
    event_data: EventUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update an event."""
    update_dict = {k: v for k, v in event_data.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.events.update_one(
        {"event_id": event_id, "created_by": current_user.user_id},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    
    event = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if isinstance(event.get('created_at'), str):
        event['created_at'] = datetime.fromisoformat(event['created_at'])
    if isinstance(event.get('updated_at'), str):
        event['updated_at'] = datetime.fromisoformat(event['updated_at'])
    
    return event

@api_router.delete("/events/{event_id}")
async def delete_event(event_id: str, current_user: User = Depends(get_current_user)):
    """Delete an event and all its photos."""
    event = await db.events.find_one(
        {"event_id": event_id, "created_by": current_user.user_id},
        {"_id": 0}
    )
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Delete all photos from Cloudinary
    photos = await db.photos.find({"event_id": event_id}, {"_id": 0}).to_list(1000)
    for photo in photos:
        try:
            cloudinary.uploader.destroy(photo["public_id"], invalidate=True)
        except Exception as e:
            logger.error(f"Failed to delete photo from Cloudinary: {e}")
    
    # Delete cover image if exists
    if event.get("cover_public_id"):
        try:
            cloudinary.uploader.destroy(event["cover_public_id"], invalidate=True)
        except Exception as e:
            logger.error(f"Failed to delete cover from Cloudinary: {e}")
    
    # Delete from database
    await db.photos.delete_many({"event_id": event_id})
    await db.events.delete_one({"event_id": event_id})
    
    return {"message": "Event deleted successfully"}

# ======================= PHOTO ROUTES (ADMIN) =======================

@api_router.get("/events/{event_id}/photos", response_model=List[Photo])
async def get_event_photos(event_id: str, current_user: User = Depends(get_current_user)):
    """Get all photos for an event."""
    event = await db.events.find_one(
        {"event_id": event_id, "created_by": current_user.user_id}
    )
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    photos = await db.photos.find({"event_id": event_id}, {"_id": 0}).to_list(1000)
    
    for photo in photos:
        if isinstance(photo.get('created_at'), str):
            photo['created_at'] = datetime.fromisoformat(photo['created_at'])
    
    return photos

@api_router.post("/photos", response_model=Photo, status_code=201)
async def create_photo(
    photo_data: PhotoCreate,
    current_user: User = Depends(get_current_user)
):
    """Add a photo to an event."""
    event = await db.events.find_one(
        {"event_id": photo_data.event_id, "created_by": current_user.user_id}
    )
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    now = datetime.now(timezone.utc)
    photo = {
        "photo_id": f"photo_{uuid.uuid4().hex[:12]}",
        "event_id": photo_data.event_id,
        "cloudinary_url": photo_data.cloudinary_url,
        "public_id": photo_data.public_id,
        "width": photo_data.width,
        "height": photo_data.height,
        "created_at": now.isoformat()
    }
    
    await db.photos.insert_one(photo)
    photo.pop("_id", None)
    photo["created_at"] = now
    return photo

@api_router.delete("/photos/{photo_id}")
async def delete_photo(photo_id: str, current_user: User = Depends(get_current_user)):
    """Delete a photo."""
    photo = await db.photos.find_one({"photo_id": photo_id}, {"_id": 0})
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    # Verify ownership
    event = await db.events.find_one(
        {"event_id": photo["event_id"], "created_by": current_user.user_id}
    )
    
    if not event:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Delete from Cloudinary
    try:
        cloudinary.uploader.destroy(photo["public_id"], invalidate=True)
    except Exception as e:
        logger.error(f"Failed to delete from Cloudinary: {e}")
    
    # Delete from database
    await db.photos.delete_one({"photo_id": photo_id})
    
    return {"message": "Photo deleted successfully"}

# ======================= PUBLIC ROUTES =======================

@api_router.get("/public/events")
async def get_public_events():
    """Get all published events for public view."""
    events = await db.events.find(
        {"published": True},
        {"_id": 0, "created_by": 0}
    ).sort("date", -1).to_list(1000)
    
    # Get photo counts for each event
    for event in events:
        count = await db.photos.count_documents({"event_id": event["event_id"]})
        event["photo_count"] = count
    
    return events

@api_router.get("/public/events/{event_id}")
async def get_public_event(event_id: str):
    """Get a specific published event."""
    event = await db.events.find_one(
        {"event_id": event_id, "published": True},
        {"_id": 0, "created_by": 0}
    )
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    count = await db.photos.count_documents({"event_id": event_id})
    event["photo_count"] = count
    
    return event

@api_router.get("/public/events/{event_id}/photos")
async def get_public_event_photos(event_id: str):
    """Get photos for a published event - returns photo IDs only, no URLs exposed."""
    event = await db.events.find_one(
        {"event_id": event_id, "published": True}
    )
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    photos = await db.photos.find(
        {"event_id": event_id},
        {"_id": 0}
    ).to_list(1000)
    
    # Return only photo IDs and dimensions - NO URLs exposed to public
    result = []
    for photo in photos:
        result.append({
            "photo_id": photo["photo_id"],
            "width": photo["width"],
            "height": photo["height"]
        })
    
    return result

# ======================= PHOTO PROXY ROUTE (PUBLIC) =======================

@api_router.get("/photos/{photo_id}/view")
async def view_photo(photo_id: str):
    """
    Proxy endpoint to stream photo from storage.
    This prevents direct URL exposure to the browser.
    """
    # Find the photo
    photo = await db.photos.find_one({"photo_id": photo_id}, {"_id": 0})
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    # Verify the event is published
    event = await db.events.find_one(
        {"event_id": photo["event_id"], "published": True}
    )
    
    if not event:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    # Fetch the image from Cloudinary
    async with httpx.AsyncClient() as http_client:
        try:
            response = await http_client.get(photo["cloudinary_url"], timeout=30.0)
            if response.status_code != 200:
                raise HTTPException(status_code=404, detail="Image not found")
            
            # Determine content type
            content_type = response.headers.get("content-type", "image/jpeg")
            
            # Stream the image back
            return StreamingResponse(
                io.BytesIO(response.content),
                media_type=content_type,
                headers={
                    "Cache-Control": "private, max-age=3600",
                    "X-Content-Type-Options": "nosniff"
                }
            )
        except Exception as e:
            logger.error(f"Failed to fetch image: {e}")
            raise HTTPException(status_code=500, detail="Failed to load image")

# ======================= ROOT ROUTE =======================

@api_router.get("/")
async def root():
    return {"message": "Lux Studio API"}

# Include the router in the main app
app.include_router(api_router)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# ======================= STARTUP EVENTS =======================

@app.on_event("startup")
async def startup_event():
    """Seed admin user on startup."""
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@luxstudio.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin123!")
    
    existing = await db.users.find_one({"email": admin_email})
    
    if existing is None:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        hashed = hash_password(admin_password)
        now = datetime.now(timezone.utc)
        
        await db.users.insert_one({
            "user_id": user_id,
            "email": admin_email,
            "name": "Admin",
            "password_hash": hashed,
            "role": "admin",
            "created_at": now.isoformat()
        })
        logger.info(f"Admin user created: {admin_email}")
    elif not verify_password(admin_password, existing.get("password_hash", "")):
        # Update password if changed in env
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}}
        )
        logger.info(f"Admin password updated for: {admin_email}")
    
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.events.create_index("event_id", unique=True)
    await db.photos.create_index("photo_id", unique=True)
    await db.photos.create_index("event_id")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
