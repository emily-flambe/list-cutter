#!/bin/bash
# deploy-dev.sh

# error noisily
set -e

if [ "$1" == "true" ]; then
  echo "Changes detected in Dockerfile or docker-compose.yml. Rebuilding Docker container..."
  
  # Bring down any existing containers and remove orphans
  docker-compose down --remove-orphans
  
  # Build and bring up containers with orphan removal
  docker-compose build && docker-compose up -d --remove-orphans
else
  echo "No rebuild required. Restarting container..."
  docker-compose restart
fi

echo "Running Django migrations..."
docker-compose exec backend python manage.py migrate

echo "Collecting static files..."
docker-compose exec backend python manage.py collectstatic --noinput

echo "Installing frontend dependencies..."
docker-compose exec backend bash -l -c "cd frontend && npm install"

echo "Building frontend..."
docker-compose exec backend bash -l -c "cd frontend && npm run build"

echo "Starting frontend development server..."
docker-compose exec backend bash -l -c "cd frontend && nohup npm run dev > /dev/null 2>&1 &"
