#!/bin/bash

# Test OAuth flow for debugging

echo "=== Testing OAuth Flow ==="
echo ""

# Step 1: Get the authorization URL
echo "1. Getting OAuth authorization URL..."
RESPONSE=$(curl -s "http://localhost:8788/api/v1/auth/google?return_url=/dashboard")
echo "Response: $RESPONSE"
echo ""

# Extract authorization URL and state
AUTH_URL=$(echo $RESPONSE | jq -r '.authorization_url' 2>/dev/null)
STATE=$(echo $RESPONSE | jq -r '.state' 2>/dev/null)

if [ "$AUTH_URL" = "null" ] || [ -z "$AUTH_URL" ]; then
    echo "❌ Failed to get authorization URL"
    echo "Full response: $RESPONSE"
    exit 1
fi

echo "✅ Got authorization URL"
echo "State token: ${STATE:0:50}..."
echo ""
echo "2. Visit this URL in your browser to authenticate:"
echo "$AUTH_URL"
echo ""
echo "3. After authenticating, you'll be redirected back. Copy the FULL redirect URL and run:"
echo ""
echo "curl -v 'PASTE_REDIRECT_URL_HERE'"
echo ""
echo "This will show you the exact error response."

# Test if secrets are loaded
echo ""
echo "=== Testing Secret Configuration ==="
echo ""
echo "4. Testing if OAuth secrets are accessible..."
curl -s "http://localhost:8788/api/v1/auth/google/status" | jq '.' 2>/dev/null || echo "Status endpoint not available"

# Test token exchange directly (requires valid code)
echo ""
echo "=== Manual Token Exchange Test ==="
echo ""
echo "To test token exchange directly with curl:"
echo ""
cat << 'EOF'
# After getting an authorization code from Google:
CODE="YOUR_AUTH_CODE"
curl -X POST https://oauth2.googleapis.com/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "code=$CODE" \
  -d "grant_type=authorization_code" \
  -d "redirect_uri=http://localhost:8788/api/v1/auth/google/callback"
EOF