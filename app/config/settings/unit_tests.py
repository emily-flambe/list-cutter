from .base import *

ENVIRONMENT = "unit_tests"
ENABLE_DEBUGGER = False

# temporary
ALLOWED_HOSTS = ["*"]

ROOT_DOMAIN = "localhost"
DEFAULT_HTTP_PROTOCOL = "http"
CSRF_TRUSTED_ORIGINS = [f"{DEFAULT_HTTP_PROTOCOL}://{ROOT_DOMAIN}"]

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
    }
}


GOOGLE_PROJECT_ID = "GOOGLE_PROJECT_ID"
GOOGLE_OAUTH2_CLIENT_ID = "GOOGLE_OAUTH2_CLIENT_ID"
GOOGLE_OAUTH2_CLIENT_SECRET = "GOOGLE_OAUTH2_CLIENT_SECRET"
