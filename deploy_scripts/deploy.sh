#!/bin/bash
# deploy-dev.sh

if [ "$1" == "true" ]; then
  echo "Changes detected in Dockerfile or docker-compose.yml. Rebuilding Docker container..."
  docker-compose build && docker-compose up -d
else
  echo "No rebuild required. Restarting container..."
  docker-compose restart
fi

echo "Running Django migrations..."
docker-compose exec web python ../manage.py migrate

echo "Collecting static files..."
docker-compose exec web python ../manage.py collectstatic --noinput

echo "Installing npm dependencies..."
docker-compose exec web bash -l -c "npm install"

echo "Building npm assets..."
docker-compose exec web bash -l -c "npm run build"

echo "Starting npm in development mode..."
docker-compose exec -T web bash -l -c "nohup npm run dev > /dev/null 2>&1 &"
