#!/bin/bash
# deploy-dev.sh

# Check if the deployment type is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <image_tag>"
  echo "image_tag: dev or latest"
  exit 1
fi

IMAGE_TAG=$1

# Set the Docker Compose file based on the deploy type
if [ "$IMAGE_TAG" == "dev" ]; then
  DOCKER_COMPOSE_FILE="docker-compose.web-dev.yml"
elif [ "$IMAGE_TAG" == "latest" ]; then
  DOCKER_COMPOSE_FILE="docker-compose.web-latest.yml"
else
  echo "Invalid IMAGE_TAG. Use 'dev' or 'latest'."
  exit 1
fi

# Exit immediately if any command fails
set -e

echo "Pruning docker images..."
docker system prune -a -f --volumes

echo "Pulling latest images from Docker Hub using $DOCKER_COMPOSE_FILE..."
docker-compose -f $DOCKER_COMPOSE_FILE pull

echo "Bringing up containers using $DOCKER_COMPOSE_FILE..."
docker-compose -f $DOCKER_COMPOSE_FILE up -d --remove-orphans

echo "Deployment complete!"