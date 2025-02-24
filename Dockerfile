# ===== Stage 1: Base (shared code) =====
FROM python:3.12.8-slim-bookworm AS base
WORKDIR /app

# Combine apt-get commands
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    git \
    curl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN pip install --upgrade pip && pip install poetry

COPY app/pyproject.toml app/poetry.lock ./
RUN poetry config virtualenvs.create false && poetry install --no-root

COPY app/ /app/

# ===== Stage 2: Backend Dev =====
FROM base AS backend
EXPOSE 8000
CMD ["sh", "-c", "/app/scripts/setup.sh && python manage.py runserver 0.0.0.0:8000"]

# ===== Stage 3: Frontend Dev =====
FROM node:20-alpine AS frontend-dev
WORKDIR /app/frontend

# Optional: if you need native deps, add them
# RUN apk add --no-cache python3 make g++

COPY app/frontend/package*.json ./
RUN npm ci
COPY app/frontend/ ./
COPY .env .env

EXPOSE 5173
CMD ["sh", "-c", "npm run dev -- --host"]

# ===== Stage 4: Frontend Production Builder =====
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Limit Node memory usage if building on small EC2
ENV NODE_OPTIONS="--max-old-space-size=512"

COPY app/frontend/package*.json ./
RUN npm ci
COPY app/frontend/ ./
COPY .env .env

RUN npm run build

# ===== Stage 5: Frontend Production (Nginx) =====
FROM nginx:alpine AS frontend-prod

# Copy the built files from the builder stage (dist instead of public)
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

COPY ./nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
# Nginx starts automatically. No need for CMD.

# ===== Stage 6: Production Backend (Django) =====
FROM base AS prod-backend
# If django-vite or WhiteNoise needs the built assets, copy them in:
# COPY --from=frontend-builder /app/frontend/public /app/static/js/app/public

EXPOSE 8000
CMD ["sh", "-c", "/app/scripts/setup.sh && python manage.py runserver 0.0.0.0:8000"]
