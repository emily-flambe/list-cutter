#!/bin/bash

# Script to run the database cleanup migration after massive simplification
# This will drop all unused tables from the database

echo "Database Cleanup Migration - Drop Unused Tables"
echo "=============================================="
echo ""
echo "This migration will drop the following tables that are no longer used:"
echo "- saved_files (files now stored in R2 bucket)"
echo "- file_relationships"
echo "- security_events"
echo "- security_analytics"
echo "- api_keys"
echo "- api_key_usage"
echo ""
echo "The 'users' table will be preserved as it's still needed for authentication."
echo ""

# Check if environment is specified
if [ -z "$1" ]; then
    echo "Usage: ./run-cleanup-migration.sh [dev|prod]"
    exit 1
fi

ENV=$1
DATABASE=""

if [ "$ENV" = "dev" ]; then
    DATABASE="cutty-dev"
elif [ "$ENV" = "prod" ]; then
    DATABASE="cutty-prod"
    echo "⚠️  WARNING: You are about to modify the PRODUCTION database!"
    echo "Press Ctrl+C to cancel, or Enter to continue..."
    read
else
    echo "Error: Invalid environment. Use 'dev' or 'prod'"
    exit 1
fi

echo "Running migration on $DATABASE..."
echo ""

# Run the migration
wrangler d1 execute $DATABASE --remote --file=0011_drop_unused_tables.sql

echo ""
echo "Migration complete!"
echo ""
echo "To verify the changes, you can run:"
echo "wrangler d1 execute $DATABASE --remote --command \"SELECT name FROM sqlite_master WHERE type='table';\""