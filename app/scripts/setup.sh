#!/bin/bash -e

cd /app/

# For logging to stdout
export PYTHONUNBUFFERED=1

# Removing subcommand will allow wait-for-it's error code to bubble up
/app/scripts/wait-for-it.sh \
    -h $POSTGRES_HOST \
    -p $POSTGRES_PORT \
    -t 30 \
    2>&1

# Move static assets into place
if [[ $* != *--skip-collectstatic* ]]
then
    echo "Collecting static..."
    python manage.py collectstatic --noinput -i node_modules
else
    echo "Skipping static collection."
fi

# Run migrations
if [[ $* == *--skip-migrate* ]]
then
    echo "Skipping migrations."
else
    echo "Migrating..."
    time python manage.py migrate --noinput
fi