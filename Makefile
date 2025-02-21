.PHONY: help build up start down destroy stop restart logs ps web db black

help:
	make -pRrq  -f Makefile 2>/dev/null | awk -v RS= -F: '/^# File/,/^# Finished Make data base/ {if ($$1 !~ "^[#.]") {print $$1}}' | sort | egrep -v -e '^[^[:alnum:]]' -e '^$@$$'

# For most commands, you can pass c=<container_name> to specify the container to run the command on.
#  For the most part, you'll want to start the project with c=web
#  But there will often be scenarios where you want to rebuild web-js, e.g. make rebuild c=web-js


# Basic target to build containers
build:
	docker compose -f docker-compose.yml build $(c)

# Use this command to rebuild a container. This is helpful when
# 	you've made changes to the Dockerfile, requirements.txt, or package.json
rebuild:
	docker compose -f docker-compose.yml down $(c)
	docker compose -f docker-compose.yml rm $(c)
	docker compose -f docker-compose.yml build --no-cache $(c)

# This is the command you'll use most often
# It will start the project in the background and tail the logs for the specified container
# This command can be cntl-c'd to stop tailing the logs, but the project will continue to run in the background
up:
	docker compose -f docker-compose.yml up -d $(c)
	docker compose -f docker-compose.yml logs -f $(c)

# This command will bring down all containers.
#   However, it will not remove volumes, so your data will persist
down:
	docker compose -f docker-compose.yml down $(c)

# This command will stop the project and remove all volumes.
#   Helpful when your data is in a bad state and you want to start fresh
destroy:
	docker compose -f docker-compose.yml down -v $(c)

# This command will stop the project, but not remove any volumes
stop:
	docker compose -f docker-compose.yml stop $(c)

# The typical set of actions to ensure env gets reloaded
restart:
	docker compose -f docker-compose.yml down $(c)
	docker compose -f docker-compose.yml rm $(c)
	docker compose -f docker-compose.yml up -d $(c)
	docker compose -f docker-compose.yml logs -f $(c)

logs:
	docker compose -f docker-compose.yml logs --tail=100 -f $(c)

# See what's up
ps:
	docker compose -f docker-compose.yml ps

# Get a shell to the web container. Really helpful for running django commands
web:
	docker compose -f docker-compose.yml exec web bash

# Get a shell to the DB container. PW will be in the .env file
db:
	docker compose -f docker-compose.yml exec db psql -Upostgres

black:
	docker compose -f docker-compose.yml exec web bash -c "cd .. && poetry run black --config pyproject.toml . $(c)"

frontend:
	docker compose -f docker-compose.yml exec web bash -c "cd /app/frontend && npm run dev"
