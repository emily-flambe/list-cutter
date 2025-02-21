#!/bin/bash -e

# Make sure the output caused by "set -x" is not written to stderr or it'll show up as an error in Datadog
export BASH_XTRACEFD=1
set -x

cd /app/

env

echo "Arguments passed: $@"

./scripts/setup.sh "$@"

GUNICORN_ARGS=("-c" "config/gunicorn.py" "config.wsgi")

# Validate config - will cause script to exit if the config is not valid
# gunicorn --print-config "${GUNICORN_ARGS[@]}"

# Run the app
# ddtrace-run gunicorn "${GUNICORN_ARGS[@]}"
gunicorn "${GUNICORN_ARGS[@]}"
