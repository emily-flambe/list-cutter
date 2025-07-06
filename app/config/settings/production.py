# Production-specific CORS settings for Cloudflare Pages
CORS_ALLOWED_ORIGINS = [
    "https://list-cutter.emilyflam.be",  # Production domain
    "https://listcutter.com",            # Alternative domain if used
]

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_ALL_ORIGINS = False  # Override the base setting for security

# Additional security headers for production
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]