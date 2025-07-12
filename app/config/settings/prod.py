from .base import *
import os
from neomodel import config as neomodel_config

# Neo4j configuration for production
NEO4J_PASSWORD = os.environ.get('NEO4J_PASSWORD', 'default_password')
NEO4J_HOST = os.environ.get('NEO4J_HOST', 'neo4j.production.host')  # Should be set in production env
neomodel_config.DATABASE_URL = f'bolt://neo4j:{NEO4J_PASSWORD}@{NEO4J_HOST}:7687'

ENVIRONMENT = "prod"
ENABLE_DEBUGGER = False

# temporary
ALLOWED_HOSTS = ["*"]

ROOT_DOMAIN = "cutty.emilyflam.be"
DEFAULT_HTTP_PROTOCOL = "https"
CSRF_TRUSTED_ORIGINS = [f"{DEFAULT_HTTP_PROTOCOL}://{ROOT_DOMAIN}"]

DJANGO_VITE = {
    "default": {
        "dev_mode": False,
        "manifest_path": "/app/static/js/app/public/.vite/manifest.json",
    }
}

# Database configurations removed - migrated to Cloudflare D1
# PostgreSQL DATABASES configuration removed in Phase 2B cleanup
