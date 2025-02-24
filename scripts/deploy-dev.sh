#!/bin/bash
# deploy-dev.sh

# Exit immediately if any command fails
set -e

echo "Pruning docker images..."
docker system prune -a -f --volumes

echo "Pulling latest images from Docker Hub..."
docker-compose -f docker-compose.web-dev.yml pull

echo "Bringing up containers..."
docker-compose -f docker-compose.web-dev.yml up -d --remove-orphans

echo "Deployment complete!"