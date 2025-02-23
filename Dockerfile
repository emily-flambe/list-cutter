# ===== Stage 1: Base (shared code) =====
FROM python:3.12.8-slim-bookworm AS base
WORKDIR /app

# Install system dependencies needed for the backend build
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    git \
    curl \
    && apt-get clean

# Install Poetry for dependency management
RUN pip install --upgrade pip && pip install poetry

# Copy dependency definitions and install Python dependencies
COPY app/pyproject.toml app/poetry.lock ./
RUN poetry config virtualenvs.create false && poetry install --no-root

# Copy entire project (both backend and frontend code)
COPY app/ /app/

# ===== Stage 2: Backend (Development) =====
FROM base AS backend
EXPOSE 8000
CMD ["sh", "-c", "/app/scripts/setup.sh && python manage.py runserver 0.0.0.0:8000"]

# ===== Stage 3: Frontend Development =====
FROM node:20-slim AS frontend-dev
WORKDIR /app/frontend

# Copy package files first to leverage Docker cache
COPY app/frontend/package*.json ./
RUN npm install

# Copy the rest of the frontend code and environment file
COPY app/frontend/ ./
COPY .env .env

# Expose the Vite dev server port
EXPOSE 5173

# Start the Vite development server with hot reloading
CMD ["sh", "-c", "npm run dev -- --host"]

# ===== Stage 4: Frontend Production Builder =====
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend

COPY app/frontend/package*.json ./
RUN npm install
COPY app/frontend/ ./
COPY .env .env

# Build the production assets; this creates output in /app/frontend/public (default for Vite).
RUN npm run build

# ===== Stage 5: Frontend Production (Nginx) =====
FROM nginx:alpine AS frontend-prod

# Copy build output from the builder stage into Nginx's html directory
COPY --from=frontend-builder /app/frontend/public /usr/share/nginx/html

# Optionally, copy a custom Nginx config if you have one:
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
# By default, the nginx:alpine image starts Nginx. No custom CMD needed.

# ===== Stage 6: Production Backend (Django) =====
FROM base AS prod-backend

# (Optional) If you still need to copy the build output for django-vite or WhiteNoise, do it here:
# COPY --from=frontend-builder /app/frontend/public /app/static/js/app/public

EXPOSE 8000
CMD ["sh", "-c", "/app/scripts/setup.sh && python manage.py runserver 0.0.0.0:8000"]
