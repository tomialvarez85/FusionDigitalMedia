# Fusion Digital Media - Photography Studio Application

## Original Problem Statement
Build a full-stack web application for a photography studio team (rebranded to "Fusion Digital Media") with:
- Admin panel for photographers to manage events and photos
- Public gallery for clients to browse published events
- Photo protection system to prevent unauthorized downloads (Canvas watermark, blur, disabled right-click)

## Architecture
- **Frontend**: React with Tailwind CSS, Shadcn UI components
- **Backend**: FastAPI with Python
- **Database**: MongoDB
- **Image Storage**: Cloudinary (backend proxy, no raw URLs exposed)
- **Authentication**: JWT with email/password (httpOnly cookies)

## User Personas
1. **Admin (Photographers)**: Login, create events, upload photos, manage content
2. **Public Users (Clients)**: Browse gallery, view protected photos (no login required)

## Core Requirements (All Complete)
- [x] Admin authentication with JWT
- [x] Event CRUD operations
- [x] Photo upload to Cloudinary
- [x] Public gallery view
- [x] Photo protection (canvas rendering, watermark "Fusion Digital Media", blur bottom 50%)
- [x] Backend proxy for images (no raw URLs exposed)
- [x] Right-click/drag disabled
- [x] Deployment configs (Procfile, vercel.json, .env.example, README)
- [x] Removed private `emergentintegrations` dependency for external deployment (Render)

## Database Schema (MongoDB)

### admins collection
| Field | Type | Description |
|-------|------|-------------|
| admin_id | string | Unique identifier |
| email | string | Admin email (unique) |
| password_hash | string | Bcrypt hashed password |
| name | string | Display name |
| created_at | string | ISO timestamp |

### events collection
| Field | Type | Description |
|-------|------|-------------|
| event_id | string | Unique identifier |
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
| photo_id | string | Unique identifier |
| event_id | string | FK to events.event_id |
| storage_key | string | Cloudinary public_id only |
| original_filename | string | Original upload filename |
| width | int | Image width |
| height | int | Image height |
| file_size | int | File size in bytes |
| uploaded_at | string | ISO timestamp |

## API Endpoints
- POST /api/auth/login
- POST /api/auth/register
- GET /api/auth/me
- POST /api/auth/logout
- GET /api/events (admin)
- POST /api/events
- GET /api/events/:id
- PUT /api/events/:id
- DELETE /api/events/:id
- GET /api/events/:id/photos
- POST /api/photos
- DELETE /api/photos/:id
- GET /api/photos/:id/view (proxy, public)
- GET /api/public/events
- GET /api/public/events/:id
- GET /api/public/events/:id/photos
- POST /api/cloudinary/signature

## Environment Variables Required
| Variable | Description |
|----------|-------------|
| MONGO_URL | MongoDB connection string |
| DB_NAME | Database name |
| JWT_SECRET | Secret key for JWT tokens |
| ADMIN_EMAIL | Default admin email |
| ADMIN_PASSWORD | Default admin password |
| CLOUDINARY_CLOUD_NAME | Cloudinary cloud name |
| CLOUDINARY_API_KEY | Cloudinary API key |
| CLOUDINARY_API_SECRET | Cloudinary API secret |
| CORS_ORIGINS | Allowed origins |

## What's Been Implemented
- Full admin panel (login, dashboard, event management, photo upload)
- Public gallery with Canvas-protected photos
- Cloudinary integration with backend proxy
- Deployment configs for Render and Vercel
- Branding: "Fusion Digital Media"
- Clean requirements.txt (no private dependencies)

## Prioritized Backlog

### P2 (Nice to have)
- [ ] Bulk photo delete
- [ ] Event cover image upload
- [ ] Photo reordering
- [ ] Client photo selection/favorites
