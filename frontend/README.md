# Fusion Digital Media - Frontend

React-based photography gallery with protected image viewing.

## Quick Start

```bash
# Install dependencies
yarn install

# Copy environment file
cp .env.example .env
# Edit .env with your backend URL

# Start development server
yarn start
```

## Deployment (Vercel)

1. Push to GitHub
2. Import to Vercel
3. Set environment variables:
   - `REACT_APP_BACKEND_URL` = your backend URL
4. Deploy

The `vercel.json` is pre-configured for SPA routing.

## Build for Production

```bash
yarn build
```

Output will be in the `build/` folder.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `REACT_APP_BACKEND_URL` | Yes | Full URL to the backend API |

## Features

- Public gallery with protected photos
- Admin panel for event management
- Canvas-rendered images with watermark
- WhatsApp contact integration
