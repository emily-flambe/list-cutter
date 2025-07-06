# Development-specific CORS settings for Cloudflare Pages migration
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",  # Vite dev server
    "http://localhost:8788",  # Wrangler Pages dev server
    "http://0.0.0.0:5173",    # Docker-friendly binding
]

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_ALL_ORIGINS = False  # Override the base setting for security