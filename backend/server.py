from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Query
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
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

# Rate limiting
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

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

# Rate limiting configuration
RATE_LIMIT_PHOTO_PROXY = os.environ.get("RATE_LIMIT_PHOTO_PROXY", "60")
limiter = Limiter(key_func=get_remote_address)

# Create the main app
app = FastAPI(title="Lux Studio API", version="1.0.0")

# Add rate limit exception handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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

class Admin(BaseModel):
    """Admin user schema"""
    model_config = ConfigDict(extra="ignore")
    admin_id: str
    email: str
    name: str
    created_at: datetime

class Event(BaseModel):
    """Event schema"""
    model_config = ConfigDict(extra="ignore")
    event_id: str
    name: str
    date: str
    description: str = ""
    photographer_name: str = ""
    is_published: bool = False
    cover_photo_id: Optional[str] = None
    created_by: str
    created_at: datetime
    updated_at: datetime

class Photo(BaseModel):
    """Photo schema"""
    model_config = ConfigDict(extra="ignore")
    photo_id: str
    event_id: str
    storage_key: str
    original_filename: str = ""
    width: int = 0
    height: int = 0
    file_size: int = 0
    uploaded_at: datetime

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
    storage_key: str
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
        
        admin_doc = await db.admins.find_one({"admin_id": admin_id}, {"_id": 0})
        if not admin_doc:
            admin_doc = await db.users.find_one({"user_id": admin_id}, {"_id": 0})
            if admin_doc:
                admin_doc["admin_id"] = admin_doc.pop("user_id", admin_id)
        
        if not admin_doc:
            raise HTTPException(status_code=401, detail="Admin not found")
        
        admin_doc.pop("password_hash", None)
        
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
    
    access_token = create_access_token(admin_id, email)
    refresh_token = create_refresh_token(admin_id)
    
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
    
    admin_doc.pop("password_hash", None)
    return admin_doc

@api_router.post("/auth/register")
async def register(request: RegisterRequest, response: Response):
    """Register a new admin user."""
    email = request.email.lower()
    
    existing = await db.admins.find_one({"email": email})
    if not existing:
        existing = await db.users.find_one({"email": email})
    
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
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
    
    access_token = create_access_token(admin_id, email)
    refresh_token = create_refresh_token(admin_id)
    
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
        
        admin_doc = await db.admins.find_one({"admin_id": admin_id}, {"_id": 0})
        if not admin_doc:
            admin_doc = await db.users.find_one({"user_id": admin_id}, {"_id": 0})
        
        if not admin_doc:
            raise HTTPException(status_code=401, detail="Admin not found")
        
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
    
    event = await db.events.find_one({
        "event_id": event_id,
        "created_by": current_admin.admin_id
    })
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
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
    """Get all events for the current admin with optimized queries."""
    # Use aggregation to get events with photo counts in a single query
    pipeline = [
        {"$match": {"created_by": current_admin.admin_id}},
        {"$lookup": {
            "from": "photos",
            "localField": "event_id",
            "foreignField": "event_id",
            "as": "photos"
        }},
        {"$addFields": {
            "photo_count": {"$size": "$photos"}
        }},
        {"$project": {
            "_id": 0,
            "photos": 0  # Remove photos array, keep only count
        }},
        {"$sort": {"created_at": -1}}
    ]
    
    events = await db.events.aggregate(pipeline).to_list(1000)
    
    # Get all cover photo IDs that exist
    cover_photo_ids = [e["cover_photo_id"] for e in events if e.get("cover_photo_id")]
    
    # Batch fetch cover photos if any exist
    cover_photos = {}
    if cover_photo_ids:
        covers = await db.photos.find(
            {"photo_id": {"$in": cover_photo_ids}},
            {"_id": 0, "photo_id": 1, "storage_key": 1}
        ).to_list(len(cover_photo_ids))
        cover_photos = {c["photo_id"]: c.get("storage_key") for c in covers}
    
    # Process events
    for event in events:
        # Handle backward compatibility
        if "published" in event and "is_published" not in event:
            event["is_published"] = event.pop("published")
        
        # Add cover image URL
        if event.get("cover_photo_id") and event["cover_photo_id"] in cover_photos:
            storage_key = cover_photos[event["cover_photo_id"]]
            if storage_key:
                event["cover_image"] = get_cloudinary_url(storage_key)
    
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
    
    if "published" in event and "is_published" not in event:
        event["is_published"] = event.pop("published")
    
    count = await db.photos.count_documents({"event_id": event_id})
    event["photo_count"] = count
    
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
    
    photos = await db.photos.find({"event_id": event_id}, {"_id": 0}).to_list(1000)
    for photo in photos:
        try:
            storage_key = photo.get("storage_key") or photo.get("public_id")
            if storage_key:
                cloudinary.uploader.destroy(storage_key, invalidate=True)
        except Exception as e:
            logger.error(f"Failed to delete photo from Cloudinary: {e}")
    
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
    
    event = await db.events.find_one(
        {"event_id": photo["event_id"], "created_by": current_admin.admin_id}
    )
    
    if not event:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        storage_key = photo.get("storage_key") or photo.get("public_id")
        if storage_key:
            cloudinary.uploader.destroy(storage_key, invalidate=True)
    except Exception as e:
        logger.error(f"Failed to delete from Cloudinary: {e}")
    
    await db.photos.delete_one({"photo_id": photo_id})
    
    return {"message": "Photo deleted successfully"}

# ======================= PUBLIC ROUTES =======================

@api_router.get("/public/events")
async def get_public_events():
    """Get all published events for public view with optimized queries."""
    # Use aggregation to get events with photo counts in a single query
    pipeline = [
        {"$match": {"$or": [{"is_published": True}, {"published": True}]}},
        {"$lookup": {
            "from": "photos",
            "localField": "event_id",
            "foreignField": "event_id",
            "as": "photos"
        }},
        {"$addFields": {
            "photo_count": {"$size": "$photos"}
        }},
        {"$project": {
            "_id": 0,
            "created_by": 0,
            "photos": 0  # Remove photos array, keep only count
        }},
        {"$sort": {"date": -1}}
    ]
    
    events = await db.events.aggregate(pipeline).to_list(1000)
    
    # Get all cover photo IDs that exist
    cover_photo_ids = [e["cover_photo_id"] for e in events if e.get("cover_photo_id")]
    
    # Batch fetch cover photos if any exist
    cover_photos = {}
    if cover_photo_ids:
        covers = await db.photos.find(
            {"photo_id": {"$in": cover_photo_ids}},
            {"_id": 0, "photo_id": 1, "storage_key": 1}
        ).to_list(len(cover_photo_ids))
        cover_photos = {c["photo_id"]: c.get("storage_key") for c in covers}
    
    # Process events
    for event in events:
        # Handle backward compatibility
        if "published" in event:
            event["is_published"] = event.pop("published", True)
        
        # Add cover image URL
        if event.get("cover_photo_id") and event["cover_photo_id"] in cover_photos:
            storage_key = cover_photos[event["cover_photo_id"]]
            if storage_key:
                event["cover_image"] = get_cloudinary_url(storage_key)
    
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
    
    if "published" in event:
        event["is_published"] = event.pop("published", True)
    
    return event

@api_router.get("/public/events/{event_id}/photos")
async def get_public_event_photos(event_id: str):
    """Get photos for a published event - returns photo IDs only."""
    event = await db.events.find_one(
        {"event_id": event_id, "$or": [{"is_published": True}, {"published": True}]}
    )
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    photos = await db.photos.find(
        {"event_id": event_id},
        {"_id": 0}
    ).to_list(1000)
    
    result = []
    for photo in photos:
        result.append({
            "photo_id": photo["photo_id"],
            "width": photo.get("width", 800),
            "height": photo.get("height", 600)
        })
    
    return result

# ======================= PHOTO PROXY WITH RATE LIMITING =======================

@api_router.get("/photos/{photo_id}/view")
@limiter.limit(f"{RATE_LIMIT_PHOTO_PROXY}/minute")
async def view_photo(request: Request, photo_id: str):
    """
    Proxy endpoint to stream photo from storage.
    Rate limited to prevent bulk downloading.
    """
    photo = await db.photos.find_one({"photo_id": photo_id}, {"_id": 0})
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    event = await db.events.find_one(
        {"event_id": photo["event_id"], "$or": [{"is_published": True}, {"published": True}]}
    )
    
    if not event:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    storage_key = photo.get("storage_key") or photo.get("public_id")
    if not storage_key:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    if storage_key.startswith("http"):
        cloudinary_url = storage_key
    else:
        cloudinary_url = get_cloudinary_url(storage_key)
    
    if not cloudinary_url:
        raise HTTPException(status_code=500, detail="Storage not configured")
    
    async with httpx.AsyncClient() as http_client:
        try:
            response = await http_client.get(cloudinary_url, timeout=30.0)
            if response.status_code != 200:
                raise HTTPException(status_code=404, detail="Image not found")
            
            content_type = response.headers.get("content-type", "image/jpeg")
            
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
async def api_root():
    return {"message": "Lux Studio API", "version": "1.0.0"}

# Include the API router
app.include_router(api_router)

# ======================= CORS CONFIGURATION =======================

# Get allowed origins from environment
cors_origins_env = os.environ.get('CORS_ORIGINS', '*')
if cors_origins_env == '*':
    allow_origins = ["*"]
else:
    allow_origins = [origin.strip() for origin in cors_origins_env.split(',') if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=allow_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# ======================= STATIC FILES (PRODUCTION) =======================

# Serve React build in production
FRONTEND_BUILD_PATH = Path(__file__).parent.parent / "frontend" / "build"

if FRONTEND_BUILD_PATH.exists():
    # Serve static assets
    app.mount("/static", StaticFiles(directory=FRONTEND_BUILD_PATH / "static"), name="static")
    
    # Serve index.html for all non-API routes (SPA support)
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Don't serve index.html for API routes
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        
        # Check if it's a static file
        file_path = FRONTEND_BUILD_PATH / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        
        # Serve index.html for SPA routing
        index_path = FRONTEND_BUILD_PATH / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        
        raise HTTPException(status_code=404, detail="Not found")

# ======================= STARTUP EVENTS =======================

@app.on_event("startup")
async def startup_event():
    """Initialize database on startup."""
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@luxstudio.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin123!")
    
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
    
    logger.info("Database initialized")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
