# Preview/staging-specific CORS settings for Cloudflare Pages
CORS_ALLOWED_ORIGINS = [
    "https://preview-listcutter.pages.dev",  # Preview domain placeholder
    "https://staging-listcutter.pages.dev",  # Staging domain placeholder
]

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_ALL_ORIGINS = False  # Override the base setting for security

# Allow broader headers for preview/testing
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