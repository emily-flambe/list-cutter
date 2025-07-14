# 🔒 Google OAuth Secrets Configuration Guide

## Required Wrangler Secrets

**CRITICAL**: These secrets must be configured before OAuth implementation can work.

### 1. Google OAuth Application Secrets

```bash
# Set Google OAuth client credentials
wrangler secret put GOOGLE_CLIENT_ID
# Enter your Google OAuth client ID when prompted

wrangler secret put GOOGLE_CLIENT_SECRET  
# Enter your Google OAuth client secret when prompted

wrangler secret put GOOGLE_REDIRECT_URI
# Enter your OAuth redirect URI: https://your-domain.com/api/v1/auth/google/callback
```

### 2. Existing JWT Secret (Already Configured)

```bash
# This should already exist - verify with:
wrangler secret list

# If not present, set it:
wrangler secret put JWT_SECRET
# Enter a strong random secret (minimum 32 characters)
```

### 3. Optional API Key Salt (Already Configured)

```bash
# This should already exist for API key functionality
# If not present:
wrangler secret put API_KEY_SALT
```

## Google Cloud Console Setup

### Step 1: Create OAuth Application

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing project
3. Enable the Google+ API and Google People API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"

### Step 2: Configure OAuth Application

**Application Type**: Web application

**Authorized JavaScript Origins**:
```
https://cutty.emilycogsdill.com
https://list-cutter.emilycogsdill.com
http://localhost:3000  (for development)
```

**Authorized Redirect URIs**:
```
https://cutty.emilycogsdill.com/api/v1/auth/google/callback          (production)
http://localhost:8787/api/v1/auth/google/callback                   (development)
```

### Step 3: Download Credentials

1. Download the JSON credentials file
2. Extract `client_id` and `client_secret`
3. Use these values for the Wrangler secrets above

## Environment-Specific Configuration

### Development Environment

For local development, also create `.dev.vars` file:

```bash
# File: cloudflare/workers/.dev.vars
JWT_SECRET=dev-secret-key-for-local-testing-only-never-use-in-production
API_KEY_SALT=dev-salt-for-api-keys-local-testing-only
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:8787/api/v1/auth/google/callback
```

### Production Environment

Use Wrangler secrets (never commit production secrets to code):

```bash
# Production secrets
wrangler secret put GOOGLE_CLIENT_ID --env production
wrangler secret put GOOGLE_CLIENT_SECRET --env production
wrangler secret put GOOGLE_REDIRECT_URI --env production
# Example: https://cutty.emilycogsdill.com/api/v1/auth/google/callback
```

## Security Configuration Requirements

### OAuth Scopes

We request minimal necessary scopes:
- `openid` - Basic OpenID Connect authentication
- `email` - User's email address
- `profile` - Basic profile information (name, picture)

### Security Features Implemented

1. **CSRF Protection**: JWT-signed state tokens with 10-minute expiration
2. **Input Validation**: Comprehensive validation of all OAuth parameters
3. **Rate Limiting**: Multi-layered protection against abuse
4. **Security Logging**: All OAuth events logged for monitoring
5. **Token Verification**: Proper ID token validation with Google's public keys
6. **State Management**: Database-backed state storage for additional security

### Rate Limiting Configuration

The OAuth implementation includes these rate limits:
- **General OAuth attempts**: 30 per 15 minutes per IP
- **Failed OAuth attempts**: 15 per 15 minutes per IP  
- **Burst protection**: 15 attempts per minute per IP
- **Suspicious activity detection**: Automatic blocking of suspicious patterns

## Verification Commands

### Check Secret Configuration

```bash
# List all configured secrets
wrangler secret list

# Verify specific secrets exist (won't show values)
wrangler secret list | grep GOOGLE_CLIENT_ID
wrangler secret list | grep GOOGLE_CLIENT_SECRET
wrangler secret list | grep GOOGLE_REDIRECT_URI
wrangler secret list | grep JWT_SECRET
```

### Test OAuth Configuration

```bash
# After implementation, test the OAuth endpoints:
curl "https://your-domain.com/api/v1/auth/google"
# Should redirect to Google OAuth with proper parameters

# Test with invalid state parameter:
curl "https://your-domain.com/api/v1/auth/google/callback?code=test&state=invalid"
# Should return error about invalid state
```

## Security Checklist

- [ ] Google OAuth application configured with correct redirect URIs
- [ ] All required Wrangler secrets configured for each environment
- [ ] `.dev.vars` file created for local development (and added to .gitignore)
- [ ] Production secrets never committed to code repository
- [ ] OAuth scopes limited to minimum necessary permissions
- [ ] Rate limiting configuration reviewed and appropriate
- [ ] Security event logging configured and monitored
- [ ] HTTPS enforced for all OAuth redirect URIs

## Troubleshooting

### Common Issues

1. **"Invalid redirect_uri"**: Check OAuth application configuration in Google Cloud Console
2. **"Invalid client_id"**: Verify GOOGLE_CLIENT_ID secret is correctly set
3. **"State parameter mismatch"**: Check JWT_SECRET is properly configured
4. **"Callback not found"**: Ensure OAuth routes are properly implemented and deployed

### Debug Commands

```bash
# Check Wrangler environment
wrangler whoami
wrangler --version

# Test local development server
cd cloudflare/workers && npm run dev

# Check deployment status
wrangler deployment list
```

---
**🔒 Security Note**: Never commit OAuth secrets to version control. Always use Wrangler secrets or environment variables for sensitive configuration.