#!/bin/bash
set -e

# Run migrations
python manage.py migrate

# Start server
exec "$@"
