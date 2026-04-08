from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Query
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import cloudinary
import cloudinary.utils
import cloudinary.uploader
import time
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

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

# ======================= MODELS =======================

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime

class UserSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    session_id: str
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime

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
    description: str
    photographer_name: str
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
    """Get the current authenticated user from session token."""
    session_token = request.cookies.get("session_token")
    
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check expiry
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0}
    )
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    
    return User(**user_doc)

# ======================= AUTH ROUTES =======================

@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    """Exchange session_id from Emergent Auth for a session token."""
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")
    
    # Call Emergent Auth to get session data
    async with httpx.AsyncClient() as client:
        try:
            auth_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            if auth_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session_id")
            
            auth_data = auth_response.json()
        except Exception as e:
            logger.error(f"Auth error: {e}")
            raise HTTPException(status_code=401, detail="Authentication failed")
    
    email = auth_data.get("email")
    name = auth_data.get("name")
    picture = auth_data.get("picture")
    session_token = auth_data.get("session_token")
    
    # Check if user exists or create new
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user["user_id"]
        # Update user info
        await db.users.update_one(
            {"email": email},
            {"$set": {"name": name, "picture": picture}}
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        new_user = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(new_user)
    
    # Create session
    session_doc = {
        "session_id": str(uuid.uuid4()),
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_sessions.insert_one(session_doc)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return user_doc

@api_router.get("/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user."""
    return current_user.model_dump()

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout and clear session."""
    session_token = request.cookies.get("session_token")
    
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(
        key="session_token",
        path="/",
        secure=True,
        samesite="none"
    )
    
    return {"message": "Logged out successfully"}

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

# ======================= EVENT ROUTES (ADMIN) =======================

@api_router.get("/events", response_model=List[Event])
async def get_events(current_user: User = Depends(get_current_user)):
    """Get all events for the current admin user."""
    events = await db.events.find(
        {"created_by": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    for event in events:
        if isinstance(event.get('created_at'), str):
            event['created_at'] = datetime.fromisoformat(event['created_at'])
        if isinstance(event.get('updated_at'), str):
            event['updated_at'] = datetime.fromisoformat(event['updated_at'])
    
    return events

@api_router.post("/events", response_model=Event)
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

@api_router.post("/photos", response_model=Photo)
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
    """Get photos for a published event - returns obfuscated data for canvas rendering."""
    event = await db.events.find_one(
        {"event_id": event_id, "published": True}
    )
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    photos = await db.photos.find(
        {"event_id": event_id},
        {"_id": 0}
    ).to_list(1000)
    
    # Return photo data with URLs (canvas will handle protection)
    result = []
    for photo in photos:
        result.append({
            "photo_id": photo["photo_id"],
            "src": photo["cloudinary_url"],
            "width": photo["width"],
            "height": photo["height"]
        })
    
    return result

# ======================= ROOT ROUTE =======================

@api_router.get("/")
async def root():
    return {"message": "Lux Studio API"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
