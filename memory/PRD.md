# Lux Studio - Photography Studio Application

## Original Problem Statement
Build a full-stack web application for a photography studio team called "Lux Studio" with:
- Admin panel for photographers to manage events and photos
- Public gallery for clients to browse published events
- Photo protection system to prevent unauthorized downloads

## Architecture
- **Frontend**: React with Tailwind CSS, Shadcn UI components
- **Backend**: FastAPI with Python
- **Database**: MongoDB
- **Image Storage**: Cloudinary (credentials needed)
- **Authentication**: JWT with email/password

## User Personas
1. **Admin (Photographers)**: Login, create events, upload photos, manage content
2. **Public Users (Clients)**: Browse gallery, view protected photos

## Core Requirements
- [x] Admin authentication with JWT
- [x] Event CRUD operations
- [x] Photo upload to Cloudinary
- [x] Public gallery view
- [x] Photo protection (canvas rendering, watermark, blur)
- [x] Backend proxy for images
- [x] Right-click/drag disabled

## Deployment Configuration

### Environment Variables Required
Copy from `/app/backend/.env.example`:
| Variable | Description |
|----------|-------------|
| MONGO_URL | MongoDB connection string |
| DB_NAME | Database name |
| JWT_SECRET | Secret key for JWT tokens (min 32 chars) |
| ADMIN_EMAIL | Default admin email |
| ADMIN_PASSWORD | Default admin password (min 8 chars) |
| CLOUDINARY_CLOUD_NAME | Cloudinary cloud name |
| CLOUDINARY_API_KEY | Cloudinary API key |
| CLOUDINARY_API_SECRET | Cloudinary API secret |
| CORS_ORIGINS | Allowed origins (comma-separated or *) |
| RATE_LIMIT_PHOTO_PROXY | Rate limit per minute per IP (default: 60) |

### Security Features
- JWT authentication with httpOnly cookies
- Rate limiting on photo proxy (60 req/min/IP)
- CORS configured for production domains
- Admin user auto-seeded on startup
- No raw image URLs exposed to browser

### Production Build
- React build served by FastAPI in production
- Single deployable unit
- MongoDB aggregation pipelines for optimized queries

### Scripts
- `python seed.py` - Create admin user from env vars
- `python migrations.py` - Initialize/update database schema

## Database Schema (MongoDB)

### admins collection
| Field | Type | Description |
|-------|------|-------------|
| admin_id | string | Unique identifier (primary key) |
| email | string | Admin email (unique) |
| password_hash | string | Bcrypt hashed password |
| name | string | Display name |
| created_at | string | ISO timestamp |

### events collection
| Field | Type | Description |
|-------|------|-------------|
| event_id | string | Unique identifier (primary key) |
| name | string | Event name |
| date | string | Event date (YYYY-MM-DD) |
| description | string | Event description |
| photographer_name | string | Photographer name |
| is_published | boolean | Public visibility |
| cover_photo_id | string | Reference to photos.photo_id |
| created_by | string | Reference to admins.admin_id |
| created_at | string | ISO timestamp |
| updated_at | string | ISO timestamp |

### photos collection
| Field | Type | Description |
|-------|------|-------------|
| photo_id | string | Unique identifier (primary key) |
| event_id | string | Reference to events.event_id (FK) |
| storage_key | string | Cloudinary public_id only |
| original_filename | string | Original upload filename |
| width | int | Image width in pixels |
| height | int | Image height in pixels |
| file_size | int | File size in bytes |
| uploaded_at | string | ISO timestamp |

## File Storage (Cloudinary)
- Folder structure: `lux-studio/events/{event_id}/`
- Only `public_id` stored in database (storage_key field)
- URLs reconstructed server-side in proxy endpoint
- No raw URLs ever exposed to browser

## Migration
Run `python /app/backend/migrations.py` to initialize/update schema.

## What's Been Implemented (January 2026)

### Backend
- JWT authentication with email/password
- Admin user auto-seeding
- Event management endpoints (CRUD)
- Photo management endpoints
- Cloudinary integration (signed uploads)
- Photo proxy endpoint for secure image delivery
- Dashboard stats endpoint

### Frontend - Admin Panel
- Admin login page with email/password
- Admin dashboard with stats (events, photos count)
- Create event page with date picker
- Event detail page with inline editing
- Photo upload with drag-and-drop
- Per-file upload progress tracking
- Delete confirmations for events/photos

### Frontend - Public Gallery
- Home page with responsive grid (3/2/1 columns)
- Event cards with protected thumbnails (canvas-rendered)
- Photo count badges on event cards
- Event detail page with masonry photo grid
- Protected photo viewer (canvas + watermark + blur)
- Lightbox with prev/next navigation
- Stronger watermark in lightbox (40% opacity)
- "Contact us to purchase" message
- Floating WhatsApp contact button
- Right-click/drag/keyboard shortcuts disabled

## API Endpoints
- POST /api/auth/login - Login
- POST /api/auth/register - Register
- GET /api/auth/me - Current user
- POST /api/auth/logout - Logout
- GET /api/events - List user's events
- POST /api/events - Create event
- GET /api/events/:id - Get event
- PUT /api/events/:id - Update event
- DELETE /api/events/:id - Delete event
- GET /api/events/:id/photos - Get event photos
- POST /api/photos - Add photo
- DELETE /api/photos/:id - Delete photo
- GET /api/photos/:id/view - Proxy photo (public)
- GET /api/public/events - Public events
- GET /api/public/events/:id - Public event detail
- GET /api/public/events/:id/photos - Public event photos

## Prioritized Backlog

### P0 (Blocking)
- [x] Admin authentication
- [x] Event CRUD
- [x] Photo upload

### P1 (Important)
- [ ] Cloudinary credentials configuration
- [ ] Test full photo upload flow

### P2 (Nice to have)
- [ ] Bulk photo delete
- [ ] Event cover image upload
- [ ] Photo reordering
- [ ] Client photo selection/favorites

## Next Tasks
1. Add Cloudinary credentials to test photo uploads
2. Test end-to-end photo upload and public viewing
3. Add event cover image upload functionality
