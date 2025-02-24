#!/bin/bash
# deploy-dev.sh

# Exit immediately if any command fails
set -e

echo "Pruning docker images..."
docker system prune -a -f --volumes

echo "Pulling latest images from Docker Hub..."
docker-compose -f docker-compose.web.yml pull

if [ "$1" == "true" ]; then
  echo "Changes detected in Dockerfile or docker-compose.yml. Rebuilding Docker container..."
  
  # Bring down any existing containers and remove orphans
  docker-compose down --remove-orphans
  
  # Build and bring up containers with orphan removal
  docker-compose -f docker-compose.web.yml build && docker-compose -f docker-compose.web.yml up -d --remove-orphans
else
  echo "No rebuild required. Restarting container..."
  docker-compose -f docker-compose.web.yml restart
fi

