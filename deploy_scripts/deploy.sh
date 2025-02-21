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
docker-compose exec web python manage.py migrate

echo "Collecting static files..."
docker-compose exec web python manage.py collectstatic --noinput

echo "Running frontend setup and build..."
docker-compose exec web bash -l -c "cd frontend && npm install && npm run build && nohup npm run dev > /dev/null 2>&1 &"
