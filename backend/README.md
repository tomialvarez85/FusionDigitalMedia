# Fusion Digital Media - Backend

Photography studio backend API built with FastAPI.

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env
# Edit .env with your values

# Run migrations
python migrations.py

# Seed admin user
python seed.py

# Start server
uvicorn server:app --reload --port 8001
```

## Deployment

### Railway / Render / Fly.io

1. Connect your GitHub repository
2. Set environment variables (see `.env.example`)
3. Set start command: `uvicorn server:app --host 0.0.0.0 --port ${PORT:-8001}`

### Docker

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8001
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
```

## Environment Variables

See `.env.example` for all required variables.

## API Documentation

Once running, visit `/docs` for interactive API documentation.
