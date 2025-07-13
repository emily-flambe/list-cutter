#!/bin/bash

# Script to run email optional migration on development and production D1 databases
# Run this from the cloudflare/workers directory

echo "🔄 Running email optional migration on development and production D1 databases..."

echo "📊 Development Database (cutty-dev):"

# Check if users table exists first, if not run all migrations in order
echo "🔍 Checking if database is initialized..."
if ! wrangler d1 execute cutty-dev --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name='users' LIMIT 1;" >/dev/null 2>&1; then
    echo "🏗️  Database not initialized, running all migrations in order..."
    for migration in ./migrations/*.sql; do
        echo "📋 Running $(basename "$migration")..."
        wrangler d1 execute cutty-dev --remote --file="$migration"
        if [ $? -ne 0 ]; then
            echo "❌ Migration $(basename "$migration") failed"
            exit 1
        fi
    done
else
    echo "📋 Running email optional migration..."
    wrangler d1 execute cutty-dev --remote --file=./migrations/0007_make_email_optional.sql
fi
if [ $? -eq 0 ]; then
    echo "✅ Development migration completed successfully"
    echo "🧪 Testing development database..."
    wrangler d1 execute cutty-dev --remote --file=./test_email_optional.sql
else
    echo "❌ Development migration failed"
    exit 1
fi

echo ""
echo "🚀 Production Database (cutty-prod):"
read -p "⚠️  Are you sure you want to run migration on PRODUCTION? (yes/no): " confirm
if [ "$confirm" = "yes" ]; then
    # Check if users table exists first, if not run all migrations in order
    echo "🔍 Checking if production database is initialized..."
    if ! wrangler d1 execute DB --env production --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name='users' LIMIT 1;" >/dev/null 2>&1; then
        echo "🏗️  Production database not initialized, running all migrations in order..."
        for migration in ./migrations/*.sql; do
            echo "📋 Running $(basename "$migration") on production..."
            wrangler d1 execute DB --env production --remote --file="$migration"
            if [ $? -ne 0 ]; then
                echo "❌ Migration $(basename "$migration") failed on production"
                exit 1
            fi
        done
    else
        echo "📋 Running email optional migration on production..."
        wrangler d1 execute DB --env production --remote --file=./migrations/0007_make_email_optional.sql
    fi
    if [ $? -eq 0 ]; then
        echo "✅ Production migration completed successfully"
        echo "🧪 Testing production database..."
        wrangler d1 execute DB --env production --remote --file=./test_email_optional.sql
    else
        echo "❌ Production migration failed"
        exit 1
    fi
else
    echo "⏭️  Skipping production migration"
fi

echo ""
echo "🎉 Migration process completed!"
echo "📧 Email field is now optional in all updated databases"