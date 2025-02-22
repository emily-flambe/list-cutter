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


# ===== Stage 2: Backend =====
FROM base AS backend

# Expose the Django port
EXPOSE 8000

# Run any setup script and then start the Django development server
CMD ["sh", "-c", "/app/scripts/setup.sh && python manage.py runserver 0.0.0.0:8000"]


# ===== Stage 3: Frontend =====
FROM node:18-slim AS frontend

WORKDIR /app/frontend

# Copy only the frontend code from the base stage
COPY --from=base /app/frontend/ . 

# Copy .env file for frontend
COPY .env .env

# Install frontend dependencies (e.g., Vite, etc.)
RUN npm install

# Expose the Vite dev server port
EXPOSE 5173

# Start the Vite development server, binding to 0.0.0.0
CMD ["sh", "-c", "npm run dev -- --host"]
