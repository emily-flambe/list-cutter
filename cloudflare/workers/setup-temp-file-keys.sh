#!/bin/bash

# Script to create TEMP_FILE_KEYS KV namespace for Cutty

echo "This script will help you create the TEMP_FILE_KEYS KV namespace"
echo "Make sure you're logged into Cloudflare with: wrangler login"
echo ""

# Create the namespace
echo "Creating TEMP_FILE_KEYS namespace..."
OUTPUT=$(npx wrangler kv namespace create "TEMP_FILE_KEYS" 2>&1)

if [ $? -eq 0 ]; then
    echo "Success! Namespace created."
    echo ""
    echo "Output from wrangler:"
    echo "$OUTPUT"
    echo ""
    
    # Extract the ID from the output
    ID=$(echo "$OUTPUT" | grep -oE 'id = "[a-f0-9-]+"' | cut -d'"' -f2)
    
    if [ -n "$ID" ]; then
        echo "Extracted namespace ID: $ID"
        echo ""
        echo "Next steps:"
        echo "1. Edit wrangler.toml"
        echo "2. Replace 'REPLACE_WITH_ACTUAL_ID' with: $ID"
        echo "3. Replace 'REPLACE_WITH_ACTUAL_PREVIEW_ID' with: $ID"
        echo ""
        echo "You can do this manually or run:"
        echo "sed -i '' 's/REPLACE_WITH_ACTUAL_ID/$ID/g' wrangler.toml"
        echo "sed -i '' 's/REPLACE_WITH_ACTUAL_PREVIEW_ID/$ID/g' wrangler.toml"
    else
        echo "Could not extract ID from output. Please update wrangler.toml manually."
    fi
else
    echo "Failed to create namespace. Error output:"
    echo "$OUTPUT"
    echo ""
    echo "Common issues:"
    echo "1. Not logged in - run: wrangler login"
    echo "2. Network issues - check your connection"
    echo "3. Account permissions - ensure you have KV namespace creation rights"
fi