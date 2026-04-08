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
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET")

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
    secure=True
)

# JWT Configuration
JWT_SECRET = os.environ.get("JWT_SECRET", "lux-studio-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"

# Create the main app
app = FastAPI(title="Lux Studio API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ======================= HELPER FUNCTIONS =======================

def get_cloudinary_url(storage_key: str) -> str:
    """Reconstruct Cloudinary URL from storage_key (public_id)"""
    if not CLOUDINARY_CLOUD_NAME:
        return ""
    return f"https://res.cloudinary.com/{CLOUDINARY_CLOUD_NAME}/image/upload/{storage_key}"

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def create_access_token(admin_id: str, email: str) -> str:
    payload = {
        "sub": admin_id, 
        "email": email, 
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        "type": "access"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(admin_id: str) -> str:
    payload = {
        "sub": admin_id, 
        "exp": datetime.now(timezone.utc) + timedelta(days=7), 
        "type": "refresh"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

# ======================= MODELS =======================

# Database Schema Models
class Admin(BaseModel):
    """Admin user schema - stored in 'admins' collection"""
    model_config = ConfigDict(extra="ignore")
    admin_id: str
    email: str
    name: str
    created_at: datetime

class Event(BaseModel):
    """Event schema - stored in 'events' collection"""
    model_config = ConfigDict(extra="ignore")
    event_id: str
    name: str
    date: str  # YYYY-MM-DD format
    description: str = ""
    photographer_name: str = ""
    is_published: bool = False
    cover_photo_id: Optional[str] = None
    created_by: str
    created_at: datetime
    updated_at: datetime

class Photo(BaseModel):
    """Photo schema - stored in 'photos' collection"""
    model_config = ConfigDict(extra="ignore")
    photo_id: str
    event_id: str
    storage_key: str  # Cloudinary public_id only
    original_filename: str = ""
    width: int = 0
    height: int = 0
    file_size: int = 0
    uploaded_at: datetime

# Request/Response Models
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str

class EventCreate(BaseModel):
    name: str
    date: str
    description: str = ""
    photographer_name: str = ""
    is_published: bool = False

class EventUpdate(BaseModel):
    name: Optional[str] = None
    date: Optional[str] = None
    description: Optional[str] = None
    photographer_name: Optional[str] = None
    is_published: Optional[bool] = None
    cover_photo_id: Optional[str] = None

class PhotoCreate(BaseModel):
    event_id: str
    storage_key: str  # Cloudinary public_id
    original_filename: str = ""
    width: int = 0
    height: int = 0
    file_size: int = 0

# ======================= AUTH HELPERS =======================

async def get_current_admin(request: Request) -> Admin:
    """Get the current authenticated admin from JWT token."""
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
        
        admin_id = payload.get("sub")
        
        # Check admins collection first, fallback to users for backward compatibility
        admin_doc = await db.admins.find_one({"admin_id": admin_id}, {"_id": 0})
        if not admin_doc:
            # Fallback: check users collection
            admin_doc = await db.users.find_one({"user_id": admin_id}, {"_id": 0})
            if admin_doc:
                admin_doc["admin_id"] = admin_doc.pop("user_id", admin_id)
        
        if not admin_doc:
            raise HTTPException(status_code=401, detail="Admin not found")
        
        # Remove sensitive data
        admin_doc.pop("password_hash", None)
        
        # Convert datetime if needed
        if isinstance(admin_doc.get('created_at'), str):
            admin_doc['created_at'] = datetime.fromisoformat(admin_doc['created_at'])
        
        return Admin(**admin_doc)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ======================= AUTH ROUTES =======================

@api_router.post("/auth/login")
async def login(request: LoginRequest, response: Response):
    """Login with email and password."""
    email = request.email.lower()
    
    # Check admins collection first, fallback to users
    admin_doc = await db.admins.find_one({"email": email}, {"_id": 0})
    if not admin_doc:
        admin_doc = await db.users.find_one({"email": email}, {"_id": 0})
        if admin_doc:
            admin_doc["admin_id"] = admin_doc.pop("user_id", "")
    
    if not admin_doc:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(request.password, admin_doc.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    admin_id = admin_doc.get("admin_id", admin_doc.get("user_id", ""))
    
    # Create tokens
    access_token = create_access_token(admin_id, email)
    refresh_token = create_refresh_token(admin_id)
    
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
    
    # Return admin without password
    admin_doc.pop("password_hash", None)
    return admin_doc

@api_router.post("/auth/register")
async def register(request: RegisterRequest, response: Response):
    """Register a new admin user."""
    email = request.email.lower()
    
    # Check if admin exists in either collection
    existing = await db.admins.find_one({"email": email})
    if not existing:
        existing = await db.users.find_one({"email": email})
    
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create admin
    admin_id = f"admin_{uuid.uuid4().hex[:12]}"
    password_hash = hash_password(request.password)
    now = datetime.now(timezone.utc)
    
    admin_doc = {
        "admin_id": admin_id,
        "email": email,
        "name": request.name,
        "password_hash": password_hash,
        "created_at": now.isoformat()
    }
    
    await db.admins.insert_one(admin_doc)
    
    # Create tokens
    access_token = create_access_token(admin_id, email)
    refresh_token = create_refresh_token(admin_id)
    
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
    
    # Return admin without password
    admin_doc.pop("password_hash", None)
    admin_doc.pop("_id", None)
    return admin_doc

@api_router.get("/auth/me")
async def get_me(current_admin: Admin = Depends(get_current_admin)):
    """Get current authenticated admin."""
    return current_admin.model_dump()

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
        
        admin_id = payload.get("sub")
        
        # Find admin
        admin_doc = await db.admins.find_one({"admin_id": admin_id}, {"_id": 0})
        if not admin_doc:
            admin_doc = await db.users.find_one({"user_id": admin_id}, {"_id": 0})
        
        if not admin_doc:
            raise HTTPException(status_code=401, detail="Admin not found")
        
        # Create new access token
        access_token = create_access_token(admin_id, admin_doc["email"])
        
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
    event_id: str = Query(..., description="Event ID for folder organization"),
    current_admin: Admin = Depends(get_current_admin)
):
    """Generate a signed upload signature for Cloudinary."""
    if not CLOUDINARY_API_SECRET:
        raise HTTPException(status_code=500, detail="Cloudinary not configured")
    
    # Verify event belongs to admin
    event = await db.events.find_one({
        "event_id": event_id,
        "created_by": current_admin.admin_id
    })
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Folder structure: lux-studio/events/{event_id}/
    folder = f"lux-studio/events/{event_id}"
    
    timestamp = int(time.time())
    params = {
        "timestamp": timestamp,
        "folder": folder,
    }
    
    signature = cloudinary.utils.api_sign_request(
        params,
        CLOUDINARY_API_SECRET
    )
    
    return {
        "signature": signature,
        "timestamp": timestamp,
        "cloud_name": CLOUDINARY_CLOUD_NAME,
        "api_key": CLOUDINARY_API_KEY,
        "folder": folder
    }

# ======================= DASHBOARD STATS =======================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_admin: Admin = Depends(get_current_admin)):
    """Get dashboard statistics."""
    events_count = await db.events.count_documents({"created_by": current_admin.admin_id})
    
    # Get photo counts for current admin's events
    user_events = await db.events.find(
        {"created_by": current_admin.admin_id},
        {"_id": 0, "event_id": 1}
    ).to_list(1000)
    
    event_ids = [e["event_id"] for e in user_events]
    user_photos_count = await db.photos.count_documents({"event_id": {"$in": event_ids}})
    
    return {
        "total_events": events_count,
        "total_photos": user_photos_count
    }

# ======================= EVENT ROUTES (ADMIN) =======================

@api_router.get("/events")
async def get_events(current_admin: Admin = Depends(get_current_admin)):
    """Get all events for the current admin."""
    events = await db.events.find(
        {"created_by": current_admin.admin_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    # Get photo counts and add cover image URL
    for event in events:
        count = await db.photos.count_documents({"event_id": event["event_id"]})
        event["photo_count"] = count
        
        # Handle backward compatibility (published vs is_published)
        if "published" in event and "is_published" not in event:
            event["is_published"] = event.pop("published")
        
        # Get cover photo URL if set
        if event.get("cover_photo_id"):
            cover = await db.photos.find_one({"photo_id": event["cover_photo_id"]}, {"_id": 0})
            if cover:
                event["cover_image"] = get_cloudinary_url(cover["storage_key"])
    
    return events

@api_router.post("/events", status_code=201)
async def create_event(
    event_data: EventCreate,
    current_admin: Admin = Depends(get_current_admin)
):
    """Create a new event."""
    now = datetime.now(timezone.utc)
    event_id = f"evt_{uuid.uuid4().hex[:12]}"
    
    event = {
        "event_id": event_id,
        "name": event_data.name,
        "date": event_data.date,
        "description": event_data.description,
        "photographer_name": event_data.photographer_name,
        "is_published": event_data.is_published,
        "cover_photo_id": None,
        "created_by": current_admin.admin_id,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.events.insert_one(event)
    event.pop("_id", None)
    event["photo_count"] = 0
    return event

@api_router.get("/events/{event_id}")
async def get_event(event_id: str, current_admin: Admin = Depends(get_current_admin)):
    """Get a specific event."""
    event = await db.events.find_one(
        {"event_id": event_id, "created_by": current_admin.admin_id},
        {"_id": 0}
    )
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Handle backward compatibility
    if "published" in event and "is_published" not in event:
        event["is_published"] = event.pop("published")
    
    # Get photo count
    count = await db.photos.count_documents({"event_id": event_id})
    event["photo_count"] = count
    
    # Get cover photo URL
    if event.get("cover_photo_id"):
        cover = await db.photos.find_one({"photo_id": event["cover_photo_id"]}, {"_id": 0})
        if cover:
            event["cover_image"] = get_cloudinary_url(cover["storage_key"])
    
    return event

@api_router.put("/events/{event_id}")
async def update_event(
    event_id: str,
    event_data: EventUpdate,
    current_admin: Admin = Depends(get_current_admin)
):
    """Update an event."""
    update_dict = {k: v for k, v in event_data.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.events.update_one(
        {"event_id": event_id, "created_by": current_admin.admin_id},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    
    return await get_event(event_id, current_admin)

@api_router.delete("/events/{event_id}")
async def delete_event(event_id: str, current_admin: Admin = Depends(get_current_admin)):
    """Delete an event and all its photos."""
    event = await db.events.find_one(
        {"event_id": event_id, "created_by": current_admin.admin_id},
        {"_id": 0}
    )
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Delete all photos from Cloudinary
    photos = await db.photos.find({"event_id": event_id}, {"_id": 0}).to_list(1000)
    for photo in photos:
        try:
            storage_key = photo.get("storage_key") or photo.get("public_id")
            if storage_key:
                cloudinary.uploader.destroy(storage_key, invalidate=True)
        except Exception as e:
            logger.error(f"Failed to delete photo from Cloudinary: {e}")
    
    # Delete from database
    await db.photos.delete_many({"event_id": event_id})
    await db.events.delete_one({"event_id": event_id})
    
    return {"message": "Event deleted successfully"}

# ======================= PHOTO ROUTES (ADMIN) =======================

@api_router.get("/events/{event_id}/photos")
async def get_event_photos(event_id: str, current_admin: Admin = Depends(get_current_admin)):
    """Get all photos for an event (admin view with full URLs)."""
    event = await db.events.find_one(
        {"event_id": event_id, "created_by": current_admin.admin_id}
    )
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    photos = await db.photos.find({"event_id": event_id}, {"_id": 0}).to_list(1000)
    
    # Add full URLs for admin view
    for photo in photos:
        storage_key = photo.get("storage_key") or photo.get("public_id")
        if storage_key:
            photo["cloudinary_url"] = get_cloudinary_url(storage_key)
    
    return photos

@api_router.post("/photos", status_code=201)
async def create_photo(
    photo_data: PhotoCreate,
    current_admin: Admin = Depends(get_current_admin)
):
    """Add a photo to an event."""
    event = await db.events.find_one(
        {"event_id": photo_data.event_id, "created_by": current_admin.admin_id}
    )
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    now = datetime.now(timezone.utc)
    photo_id = f"photo_{uuid.uuid4().hex[:12]}"
    
    photo = {
        "photo_id": photo_id,
        "event_id": photo_data.event_id,
        "storage_key": photo_data.storage_key,
        "original_filename": photo_data.original_filename,
        "width": photo_data.width,
        "height": photo_data.height,
        "file_size": photo_data.file_size,
        "uploaded_at": now.isoformat()
    }
    
    await db.photos.insert_one(photo)
    photo.pop("_id", None)
    photo["cloudinary_url"] = get_cloudinary_url(photo_data.storage_key)
    return photo

@api_router.delete("/photos/{photo_id}")
async def delete_photo(photo_id: str, current_admin: Admin = Depends(get_current_admin)):
    """Delete a photo."""
    photo = await db.photos.find_one({"photo_id": photo_id}, {"_id": 0})
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    # Verify ownership
    event = await db.events.find_one(
        {"event_id": photo["event_id"], "created_by": current_admin.admin_id}
    )
    
    if not event:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Delete from Cloudinary
    try:
        storage_key = photo.get("storage_key") or photo.get("public_id")
        if storage_key:
            cloudinary.uploader.destroy(storage_key, invalidate=True)
    except Exception as e:
        logger.error(f"Failed to delete from Cloudinary: {e}")
    
    # Delete from database
    await db.photos.delete_one({"photo_id": photo_id})
    
    return {"message": "Photo deleted successfully"}

# ======================= PUBLIC ROUTES =======================

@api_router.get("/public/events")
async def get_public_events():
    """Get all published events for public view."""
    # Query supports both old 'published' and new 'is_published' fields
    events = await db.events.find(
        {"$or": [{"is_published": True}, {"published": True}]},
        {"_id": 0, "created_by": 0}
    ).sort("date", -1).to_list(1000)
    
    # Get photo counts and normalize fields
    for event in events:
        count = await db.photos.count_documents({"event_id": event["event_id"]})
        event["photo_count"] = count
        
        # Normalize to is_published
        if "published" in event:
            event["is_published"] = event.pop("published", True)
        
        # Get cover photo URL
        if event.get("cover_photo_id"):
            cover = await db.photos.find_one({"photo_id": event["cover_photo_id"]}, {"_id": 0})
            if cover:
                event["cover_image"] = get_cloudinary_url(cover.get("storage_key", ""))
    
    return events

@api_router.get("/public/events/{event_id}")
async def get_public_event(event_id: str):
    """Get a specific published event."""
    event = await db.events.find_one(
        {"event_id": event_id, "$or": [{"is_published": True}, {"published": True}]},
        {"_id": 0, "created_by": 0}
    )
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    count = await db.photos.count_documents({"event_id": event_id})
    event["photo_count"] = count
    
    # Normalize
    if "published" in event:
        event["is_published"] = event.pop("published", True)
    
    return event

@api_router.get("/public/events/{event_id}/photos")
async def get_public_event_photos(event_id: str):
    """Get photos for a published event - returns photo IDs only, no URLs exposed."""
    event = await db.events.find_one(
        {"event_id": event_id, "$or": [{"is_published": True}, {"published": True}]}
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
            "width": photo.get("width", 800),
            "height": photo.get("height", 600)
        })
    
    return result

# ======================= PHOTO PROXY ROUTE (PUBLIC) =======================

@api_router.get("/photos/{photo_id}/view")
async def view_photo(photo_id: str):
    """
    Proxy endpoint to stream photo from storage.
    Reconstructs URL server-side - never exposed to client.
    """
    # Find the photo
    photo = await db.photos.find_one({"photo_id": photo_id}, {"_id": 0})
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    # Verify the event is published
    event = await db.events.find_one(
        {"event_id": photo["event_id"], "$or": [{"is_published": True}, {"published": True}]}
    )
    
    if not event:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    # Reconstruct URL from storage_key (public_id)
    storage_key = photo.get("storage_key") or photo.get("public_id")
    if not storage_key:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    # Support both old (full URL) and new (storage_key only) formats
    if storage_key.startswith("http"):
        cloudinary_url = storage_key
    else:
        cloudinary_url = get_cloudinary_url(storage_key)
    
    if not cloudinary_url:
        raise HTTPException(status_code=500, detail="Storage not configured")
    
    # Fetch the image from Cloudinary
    async with httpx.AsyncClient() as http_client:
        try:
            response = await http_client.get(cloudinary_url, timeout=30.0)
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
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="Image load timeout")
        except Exception as e:
            logger.error(f"Failed to fetch image: {e}")
            raise HTTPException(status_code=500, detail="Failed to load image")

# ======================= ROOT ROUTE =======================

@api_router.get("/")
async def root():
    return {"message": "Lux Studio API", "version": "1.0.0"}

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
    
    # Check both collections for existing admin
    existing = await db.admins.find_one({"email": admin_email})
    if not existing:
        existing = await db.users.find_one({"email": admin_email})
    
    if existing is None:
        admin_id = f"admin_{uuid.uuid4().hex[:12]}"
        hashed = hash_password(admin_password)
        now = datetime.now(timezone.utc)
        
        await db.admins.insert_one({
            "admin_id": admin_id,
            "email": admin_email,
            "name": "Admin",
            "password_hash": hashed,
            "created_at": now.isoformat()
        })
        logger.info(f"Admin user created: {admin_email}")
    
    # Create indexes
    await db.admins.create_index("email", unique=True)
    await db.admins.create_index("admin_id", unique=True)
    await db.events.create_index("event_id", unique=True)
    await db.events.create_index("created_by")
    await db.photos.create_index("photo_id", unique=True)
    await db.photos.create_index("event_id")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
