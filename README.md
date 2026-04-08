# Fusion Digital Media - Photography Studio Platform

A full-stack photography studio application for managing photo events with protected image viewing.

## Features

- **Admin Panel**: Create/edit/delete photo events, upload multiple photos with drag-and-drop
- **Public Gallery**: Browse published events with protected photo viewing
- **Photo Protection**: 
  - Images served via backend proxy (no direct URLs exposed)
  - Canvas-rendered with watermark and blur effect
  - Right-click, drag, and keyboard shortcuts disabled
- **WhatsApp Integration**: Floating contact button for client inquiries
- **Rate Limiting**: Photo proxy limited to 60 requests/minute/IP

## Tech Stack

- **Frontend**: React, Tailwind CSS, Shadcn UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Storage**: Cloudinary
- **Auth**: JWT with httpOnly cookies

---

## Environment Variables

### Frontend (React)

Create a `.env` file in the `/frontend` directory:

```env
# Backend API URL (required)
REACT_APP_BACKEND_URL=https://your-backend-url.com
```

| Variable | Required | Description |
|----------|----------|-------------|
| `REACT_APP_BACKEND_URL` | Yes | Full URL to the backend API (e.g., `https://api.yourdomain.com`) |

### Backend (FastAPI)

Create a `.env` file in the `/backend` directory (see `.env.example`):

```env
# Database
MONGO_URL=mongodb+srv://user:pass@cluster.mongodb.net/dbname
DB_NAME=fusiondigitalmedia

# Authentication
JWT_SECRET=your-super-secret-jwt-key-min-32-characters
ADMIN_EMAIL=admin@fusiondigitalmedia.com
ADMIN_PASSWORD=YourSecurePassword123!

# Cloudinary (Image Storage)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Security
CORS_ORIGINS=https://your-frontend-domain.vercel.app,https://yourdomain.com
RATE_LIMIT_PHOTO_PROXY=60
```

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URL` | Yes | MongoDB connection string |
| `DB_NAME` | Yes | Database name |
| `JWT_SECRET` | Yes | Secret key for JWT tokens (min 32 characters) |
| `ADMIN_EMAIL` | Yes | Default admin email (created on startup) |
| `ADMIN_PASSWORD` | Yes | Default admin password (min 8 characters) |
| `CLOUDINARY_CLOUD_NAME` | Yes | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Yes | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Yes | Cloudinary API secret |
| `CORS_ORIGINS` | No | Comma-separated allowed origins (default: `*`) |
| `RATE_LIMIT_PHOTO_PROXY` | No | Rate limit per minute per IP (default: `60`) |

---

## Deployment

### Frontend (Vercel)

1. Push the `/frontend` folder to a GitHub repository
2. Import to Vercel
3. Set environment variables:
   - `REACT_APP_BACKEND_URL` = your backend URL
4. Deploy

The `vercel.json` is already configured for SPA routing.

### Backend (Railway/Render/Fly.io)

1. Push the `/backend` folder to a GitHub repository
2. Import to your hosting platform
3. Set all environment variables listed above
4. The app listens on port `8001` by default (configurable via `PORT` env var)

**Start command:**
```bash
uvicorn server:app --host 0.0.0.0 --port ${PORT:-8001}
```

### Database (MongoDB Atlas)

1. Create a free cluster at [mongodb.com/atlas](https://mongodb.com/atlas)
2. Create a database user
3. Whitelist your backend's IP (or allow all with `0.0.0.0/0`)
4. Copy the connection string to `MONGO_URL`

### Cloudinary

1. Sign up at [cloudinary.com](https://cloudinary.com)
2. Go to Dashboard → Settings
3. Copy `Cloud name`, `API Key`, and `API Secret`

---

## Local Development

### Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your values
python seed.py  # Create admin user
uvicorn server:app --reload --port 8001
```

### Frontend

```bash
cd frontend
yarn install
cp .env.example .env
# Edit .env with your backend URL
yarn start
```

---

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/register` - Register new admin
- `GET /api/auth/me` - Get current admin
- `POST /api/auth/logout` - Logout

### Events (Admin)
- `GET /api/events` - List admin's events
- `POST /api/events` - Create event
- `GET /api/events/:id` - Get event details
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event

### Photos (Admin)
- `GET /api/events/:id/photos` - List event photos
- `POST /api/photos` - Add photo
- `DELETE /api/photos/:id` - Delete photo
- `GET /api/cloudinary/signature` - Get upload signature

### Public
- `GET /api/public/events` - List published events
- `GET /api/public/events/:id` - Get published event
- `GET /api/public/events/:id/photos` - Get photo IDs (no URLs)
- `GET /api/photos/:id/view` - Proxy photo (rate limited)

---

## Scripts

```bash
# Initialize database and create admin user
python backend/seed.py

# Run database migrations
python backend/migrations.py
```

---

## Default Admin Credentials

After running `seed.py` or on first backend startup:
- **Email**: Value of `ADMIN_EMAIL` env var
- **Password**: Value of `ADMIN_PASSWORD` env var

---

## License

© 2025 Fusion Digital Media. All rights reserved.
