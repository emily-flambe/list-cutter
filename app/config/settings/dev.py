from .base import *
import os
from neomodel import config as neomodel_config

# Neo4j configuration for development
NEO4J_PASSWORD = os.environ.get('NEO4J_PASSWORD', 'default_password')
NEO4J_HOST = os.environ.get('NEO4J_HOST', 'localhost')  # For local development
neomodel_config.DATABASE_URL = f'bolt://neo4j:{NEO4J_PASSWORD}@{NEO4J_HOST}:7687'

ENVIRONMENT = "dev"
ENABLE_DEBUGGER = False

# temporary
ALLOWED_HOSTS = ["*"]
DEBUG = True

ROOT_DOMAIN = "localhost"
DEFAULT_HTTP_PROTOCOL = "http"
CSRF_TRUSTED_ORIGINS = [f"{DEFAULT_HTTP_PROTOCOL}://{ROOT_DOMAIN}"]

DJANGO_VITE = {
    "default": {
        "dev_mode": True,
        "manifest_path": "/app/static/js/app/public/.vite/manifest.json",
    }
}

# Database configurations removed - migrated to Cloudflare D1
# PostgreSQL DATABASES configuration removed in Phase 2B cleanup

# Set more generous throttling rates for development
REST_FRAMEWORK = {
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '1000/minute',  # Increase the rate for anonymous users
        'user': '2000/minute',   # Increase the rate for authenticated users
    },
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
    ),
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',  # Use JWT!
    ],
}