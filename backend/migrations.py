"""
Database Migration Script for Lux Studio
Run this to initialize or update the MongoDB schema
"""
import asyncio
import os
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt

# Load environment
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

async def run_migrations():
    """Run all database migrations"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print(f"Connected to MongoDB: {DB_NAME}")
    print("=" * 50)
    
    # ============================================
    # 1. Create Collections (if not exist)
    # ============================================
    print("\n[1/5] Creating collections...")
    
    collections = await db.list_collection_names()
    
    required_collections = ['admins', 'events', 'photos']
    for coll in required_collections:
        if coll not in collections:
            await db.create_collection(coll)
            print(f"  ✓ Created collection: {coll}")
        else:
            print(f"  - Collection exists: {coll}")
    
    # ============================================
    # 2. Create Indexes
    # ============================================
    print("\n[2/5] Creating indexes...")
    
    # Admins indexes
    await db.admins.create_index("email", unique=True)
    await db.admins.create_index("admin_id", unique=True)
    print("  ✓ admins: email (unique), admin_id (unique)")
    
    # Events indexes
    await db.events.create_index("event_id", unique=True)
    await db.events.create_index("created_by")
    await db.events.create_index("is_published")
    await db.events.create_index([("date", -1)])
    print("  ✓ events: event_id (unique), created_by, is_published, date")
    
    # Photos indexes
    await db.photos.create_index("photo_id", unique=True)
    await db.photos.create_index("event_id")
    await db.photos.create_index("storage_key")
    print("  ✓ photos: photo_id (unique), event_id, storage_key")
    
    # ============================================
    # 3. Schema Validation (optional, for strict mode)
    # ============================================
    print("\n[3/5] Setting up schema validation...")
    
    # Admins schema
    admins_validator = {
        "$jsonSchema": {
            "bsonType": "object",
            "required": ["admin_id", "email", "password_hash", "name", "created_at"],
            "properties": {
                "admin_id": {"bsonType": "string", "description": "Unique admin identifier"},
                "email": {"bsonType": "string", "description": "Admin email (unique)"},
                "password_hash": {"bsonType": "string", "description": "Bcrypt password hash"},
                "name": {"bsonType": "string", "description": "Admin display name"},
                "created_at": {"bsonType": "string", "description": "ISO timestamp"}
            }
        }
    }
    
    # Events schema
    events_validator = {
        "$jsonSchema": {
            "bsonType": "object",
            "required": ["event_id", "name", "date", "is_published", "created_by", "created_at"],
            "properties": {
                "event_id": {"bsonType": "string", "description": "Unique event identifier"},
                "name": {"bsonType": "string", "description": "Event name"},
                "date": {"bsonType": "string", "description": "Event date (YYYY-MM-DD)"},
                "description": {"bsonType": "string", "description": "Event description"},
                "photographer_name": {"bsonType": "string", "description": "Photographer name"},
                "is_published": {"bsonType": "bool", "description": "Public visibility"},
                "cover_photo_id": {"bsonType": ["string", "null"], "description": "Cover photo reference"},
                "created_by": {"bsonType": "string", "description": "Admin who created the event"},
                "created_at": {"bsonType": "string", "description": "ISO timestamp"},
                "updated_at": {"bsonType": "string", "description": "ISO timestamp"}
            }
        }
    }
    
    # Photos schema
    photos_validator = {
        "$jsonSchema": {
            "bsonType": "object",
            "required": ["photo_id", "event_id", "storage_key", "uploaded_at"],
            "properties": {
                "photo_id": {"bsonType": "string", "description": "Unique photo identifier"},
                "event_id": {"bsonType": "string", "description": "Parent event reference"},
                "storage_key": {"bsonType": "string", "description": "Cloudinary public_id"},
                "original_filename": {"bsonType": "string", "description": "Original upload filename"},
                "width": {"bsonType": "int", "description": "Image width in pixels"},
                "height": {"bsonType": "int", "description": "Image height in pixels"},
                "file_size": {"bsonType": "int", "description": "File size in bytes"},
                "uploaded_at": {"bsonType": "string", "description": "ISO timestamp"}
            }
        }
    }
    
    try:
        await db.command("collMod", "admins", validator=admins_validator)
        await db.command("collMod", "events", validator=events_validator)
        await db.command("collMod", "photos", validator=photos_validator)
        print("  ✓ Schema validation rules applied")
    except Exception as e:
        print(f"  - Schema validation skipped: {e}")
    
    # ============================================
    # 4. Seed Admin User
    # ============================================
    print("\n[4/5] Seeding admin user...")
    
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@luxstudio.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin123!")
    
    existing_admin = await db.admins.find_one({"email": admin_email})
    
    if existing_admin is None:
        import uuid
        admin_id = f"admin_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()
        
        await db.admins.insert_one({
            "admin_id": admin_id,
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "created_at": now
        })
        print(f"  ✓ Created admin: {admin_email}")
    else:
        print(f"  - Admin exists: {admin_email}")
    
    # ============================================
    # 5. Migrate existing data (if any)
    # ============================================
    print("\n[5/5] Migrating existing data...")
    
    # Migrate users to admins collection (if using old schema)
    old_users = await db.users.find({}).to_list(1000)
    if old_users:
        for user in old_users:
            existing = await db.admins.find_one({"email": user.get("email")})
            if not existing:
                await db.admins.insert_one({
                    "admin_id": user.get("user_id", f"admin_{user.get('email', 'unknown')[:8]}"),
                    "email": user.get("email"),
                    "password_hash": user.get("password_hash", ""),
                    "name": user.get("name", "Admin"),
                    "created_at": user.get("created_at", datetime.now(timezone.utc).isoformat())
                })
        print(f"  ✓ Migrated {len(old_users)} users to admins")
    
    # Migrate events (rename published -> is_published, add missing fields)
    events_to_migrate = await db.events.find({}).to_list(1000)
    migrated_events = 0
    for event in events_to_migrate:
        updates = {}
        
        # Rename 'published' to 'is_published'
        if 'published' in event and 'is_published' not in event:
            updates['is_published'] = event['published']
            updates['$unset'] = {'published': 1}
        
        # Add cover_photo_id if missing
        if 'cover_photo_id' not in event:
            updates['cover_photo_id'] = None
        
        if updates:
            set_updates = {k: v for k, v in updates.items() if k != '$unset'}
            unset_updates = updates.get('$unset', {})
            
            update_query = {}
            if set_updates:
                update_query['$set'] = set_updates
            if unset_updates:
                update_query['$unset'] = unset_updates
            
            if update_query:
                await db.events.update_one({"_id": event["_id"]}, update_query)
                migrated_events += 1
    
    if migrated_events > 0:
        print(f"  ✓ Migrated {migrated_events} events to new schema")
    else:
        print("  - No event migrations needed")
    
    # Migrate photos (cloudinary_url -> storage_key)
    photos_to_migrate = await db.photos.find({}).to_list(10000)
    migrated_photos = 0
    for photo in photos_to_migrate:
        updates = {}
        
        # Convert cloudinary_url to storage_key (extract public_id)
        if 'cloudinary_url' in photo and 'storage_key' not in photo:
            url = photo['cloudinary_url']
            # Extract public_id from URL: https://res.cloudinary.com/{cloud}/image/upload/{public_id}.{ext}
            if '/upload/' in url:
                public_id_with_ext = url.split('/upload/')[-1]
                # Remove version if present (v1234567/)
                if public_id_with_ext.startswith('v') and '/' in public_id_with_ext:
                    public_id_with_ext = '/'.join(public_id_with_ext.split('/')[1:])
                # Remove extension
                public_id = public_id_with_ext.rsplit('.', 1)[0]
                updates['storage_key'] = public_id
        
        # Add missing fields
        if 'original_filename' not in photo:
            updates['original_filename'] = photo.get('storage_key', '').split('/')[-1] or 'unknown'
        if 'file_size' not in photo:
            updates['file_size'] = 0
        if 'uploaded_at' not in photo and 'created_at' in photo:
            updates['uploaded_at'] = photo['created_at']
        
        if updates:
            await db.photos.update_one({"_id": photo["_id"]}, {"$set": updates})
            migrated_photos += 1
    
    if migrated_photos > 0:
        print(f"  ✓ Migrated {migrated_photos} photos to new schema")
    else:
        print("  - No photo migrations needed")
    
    # ============================================
    # Done
    # ============================================
    print("\n" + "=" * 50)
    print("Migration completed successfully!")
    print("=" * 50)
    
    # Print summary
    admin_count = await db.admins.count_documents({})
    event_count = await db.events.count_documents({})
    photo_count = await db.photos.count_documents({})
    
    print(f"\nDatabase Summary:")
    print(f"  - Admins: {admin_count}")
    print(f"  - Events: {event_count}")
    print(f"  - Photos: {photo_count}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(run_migrations())
