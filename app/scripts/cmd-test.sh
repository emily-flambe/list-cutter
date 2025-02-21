#!/bin/bash -e

cd /app/

./scripts/setup.sh --skip-collectstatic

export DJANGO_SETTINGS_MODULE=config.settings.unit_tests

echo "Running tests..."
coverage run -m pytest --no-migrations --disable-warnings -s "$@"

exit $?
