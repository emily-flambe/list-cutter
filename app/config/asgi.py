"""
ASGI config

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.0/howto/deployment/asgi/
"""

import os
from django.core.exceptions import ImproperlyConfigured
from django.core.asgi import get_asgi_application

if not os.environ["DJANGO_SETTINGS_MODULE"]:
    raise ImproperlyConfigured()

application = get_asgi_application()
