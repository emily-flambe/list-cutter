"""
WSGI config

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.0/howto/deployment/wsgi/
"""

import os

from django.core.exceptions import ImproperlyConfigured
from django.core.wsgi import get_wsgi_application


if not os.environ["DJANGO_SETTINGS_MODULE"]:
    raise ImproperlyConfigured()

application = get_wsgi_application()
