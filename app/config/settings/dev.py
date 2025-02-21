from .base import *

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
        "manifest_path": f"{STATIC_ROOT}/js/app/public/.vite/manifest.json",
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
    }
}

# When we do dev work, we should be using cta-tech.dev

# Come up with a better name here.
#   This domain is the one we use for GWorkspace
GWORKSPACE_DOMAIN = "cta-tech.app"

# techallies.org
GCP_ORGANIZATION_ID = "organizations/966966434935"
GCP_PARTNER_FOLDER = "folders/578009676262"

GWORKSPACE_ADMIN_EMAIL = f"admin@{GWORKSPACE_DOMAIN}"
GWORKSPACE_SERVICE_ACCOUNT_CREDS = "/tmp/keys/cta-tech-admin.json"

# cta-tech.dev
# GCP_ORGANIZATION_ID = "organizations/294735925352"

#########################################################
# Google Workspace Configurations
#########################################################

GOOGLE_WORKSPACE_SPECIAL_GROUPS = [
    # This will be a group with just a single segment
    "administrators@cta-tech.app",
    "1password-users@cta-tech.app",
    "2sv-temp-exempt@cta-tech.app",
]

###TODO: REMOVE THIS AFTER FIGURING OUT HOW TO USE ADMIN-52@CTA-GCI-338019.IAM.GSERVICEACCOUNT.COM TO RUN COMPOSER COMMANDS, OR SOMETHING ELSE I DUNNO. ALSO REPLACE REFERENCES TO THESE SETTINGS
#########################################################
# Google Composer Configurations
#########################################################

COMPOSER_SERVICE_ACCOUNT_CREDS = "/tmp/keys/cta-dev-composer.json"
COMPOSER_SERVICE_ACCOUNT_EMAIL = "composer@dev3869c056.iam.gserviceaccount.com"
