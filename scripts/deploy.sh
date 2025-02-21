#!/bin/bash
# deploy-dev.sh

# Exit immediately if any command fails
set -e

echo "Pruning docker images..."
docker system prune -a -f --volumes

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
docker-compose exec frontend bash -l -c "npm install"

echo "Building frontend..."
docker-compose exec frontend bash -l -c "npm run build"

echo "Starting frontend development server..."
docker-compose exec frontend bash -l -c "nohup npm run dev > /dev/null 2>&1 &"
