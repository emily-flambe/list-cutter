#!/bin/bash

# Helper script to create local SQLite database
# Run this from the cloudflare/workers directory

echo "🏗️  Creating local SQLite database..."

if [ ! -f "schema.sql" ]; then
    echo "❌ ERROR: schema.sql not found"
    echo "Make sure you're in the cloudflare/workers directory"
    exit 1
fi

# Create the database from schema
sqlite3 local.sqlite < schema.sql

if [ $? -eq 0 ]; then
    echo "✅ Local database created successfully at local.sqlite"
    echo "📊 Database info:"
    echo "Tables created:"
    sqlite3 local.sqlite ".tables"
    echo ""
    echo "Now you can run: make migrations ENV=local"
else
    echo "❌ Failed to create local database"
    exit 1
fi