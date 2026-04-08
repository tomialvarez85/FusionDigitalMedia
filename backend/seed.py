"""
Seed Script for Lux Studio
Creates the initial admin user from environment variables.
Run: python seed.py
"""
import asyncio
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt

# Load environment
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

async def seed_admin():
    """Create the initial admin user from environment variables."""
    
    # Get environment variables
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME')
    admin_email = os.environ.get('ADMIN_EMAIL')
    admin_password = os.environ.get('ADMIN_PASSWORD')
    
    # Validate required variables
    if not mongo_url:
        print("ERROR: MONGO_URL environment variable is required")
        return False
    
    if not db_name:
        print("ERROR: DB_NAME environment variable is required")
        return False
    
    if not admin_email:
        print("ERROR: ADMIN_EMAIL environment variable is required")
        return False
    
    if not admin_password:
        print("ERROR: ADMIN_PASSWORD environment variable is required")
        return False
    
    if len(admin_password) < 8:
        print("ERROR: ADMIN_PASSWORD must be at least 8 characters")
        return False
    
    print(f"Connecting to MongoDB: {db_name}")
    print("=" * 50)
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Create indexes
    print("\nCreating indexes...")
    await db.admins.create_index("email", unique=True)
    await db.admins.create_index("admin_id", unique=True)
    await db.events.create_index("event_id", unique=True)
    await db.events.create_index("created_by")
    await db.photos.create_index("photo_id", unique=True)
    await db.photos.create_index("event_id")
    print("  ✓ Indexes created")
    
    # Check if admin exists
    print(f"\nChecking for existing admin: {admin_email}")
    existing = await db.admins.find_one({"email": admin_email.lower()})
    
    if existing:
        print(f"  - Admin already exists: {admin_email}")
        
        # Optionally update password if it changed
        if not verify_password(admin_password, existing.get("password_hash", "")):
            await db.admins.update_one(
                {"email": admin_email.lower()},
                {"$set": {"password_hash": hash_password(admin_password)}}
            )
            print("  ✓ Admin password updated")
    else:
        # Create new admin
        admin_id = f"admin_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc)
        
        admin_doc = {
            "admin_id": admin_id,
            "email": admin_email.lower(),
            "name": "Admin",
            "password_hash": hash_password(admin_password),
            "created_at": now.isoformat()
        }
        
        await db.admins.insert_one(admin_doc)
        print(f"  ✓ Admin created: {admin_email}")
        print(f"    ID: {admin_id}")
    
    # Print summary
    admin_count = await db.admins.count_documents({})
    event_count = await db.events.count_documents({})
    photo_count = await db.photos.count_documents({})
    
    print("\n" + "=" * 50)
    print("Seed completed!")
    print("=" * 50)
    print(f"\nDatabase Summary:")
    print(f"  - Admins: {admin_count}")
    print(f"  - Events: {event_count}")
    print(f"  - Photos: {photo_count}")
    print(f"\nAdmin Login:")
    print(f"  - Email: {admin_email}")
    print(f"  - Password: {'*' * len(admin_password)}")
    
    client.close()
    return True

if __name__ == "__main__":
    success = asyncio.run(seed_admin())
    exit(0 if success else 1)
