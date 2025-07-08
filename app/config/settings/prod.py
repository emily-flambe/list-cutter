from .base import *
import os
from neomodel import config as neomodel_config

NEO4J_PASSWORD = os.environ.get('NEO4J_PASSWORD', 'default_password')
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

# Database
# https://docs.djangoproject.com/en/5.0/ref/settings/#databases

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql_psycopg2",
        "NAME": get_env_variable("POSTGRES_DB"),
        "HOST": get_env_variable("POSTGRES_HOST"),
        "PORT": get_env_variable("POSTGRES_PORT"),
        "USER": get_env_variable("POSTGRES_USER"),
        "PASSWORD": get_env_variable("POSTGRES_PASSWORD"),
        # "OPTIONS": {
        #     "sslmode": get_env_variable("POSTGRES_SSLMODE", "verify-ca"),
        #     "sslrootcert": "/app/config/settings/certs/dev-gcp/server-ca.pem",
        #     "sslcert": "/app/config/settings/certs/dev-gcp/client-cert.pem",
        #     "sslkey": "/app/config/settings/certs/dev-gcp/client-key.pem",
        # },
    }
}
