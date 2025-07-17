#!/usr/bin/env node

/**
 * OAuth Configuration Verification Script
 * Helps troubleshoot OAuth issues by checking configuration
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 OAuth Configuration Verification\n');

// Check for .dev.vars file
const devVarsPath = path.join(__dirname, '.dev.vars');
const hasDevVars = fs.existsSync(devVarsPath);

if (hasDevVars) {
  console.log('✅ .dev.vars file found');
  const devVars = fs.readFileSync(devVarsPath, 'utf8');
  const hasGoogleVars = devVars.includes('GOOGLE_CLIENT_ID') && 
                        devVars.includes('GOOGLE_CLIENT_SECRET') && 
                        devVars.includes('GOOGLE_REDIRECT_URI');
  
  if (hasGoogleVars) {
    console.log('✅ Google OAuth variables found in .dev.vars');
    
    // Parse and display redirect URI (without exposing secrets)
    const lines = devVars.split('\n');
    lines.forEach(line => {
      if (line.startsWith('GOOGLE_REDIRECT_URI=')) {
        const redirectUri = line.split('=')[1].trim();
        console.log(`📍 Redirect URI: ${redirectUri}`);
        
        // Check common issues
        if (redirectUri.includes('localhost') && redirectUri.includes('http://')) {
          console.log('⚠️  Warning: Using HTTP with localhost. Google OAuth requires HTTPS except for localhost development.');
        }
        if (!redirectUri.includes('/callback')) {
          console.log('⚠️  Warning: Redirect URI should typically include /callback path');
        }
      }
    });
  } else {
    console.log('❌ Google OAuth variables NOT found in .dev.vars');
    console.log('\nAdd these to your .dev.vars file:');
    console.log('GOOGLE_CLIENT_ID=your-client-id');
    console.log('GOOGLE_CLIENT_SECRET=your-client-secret');
    console.log('GOOGLE_REDIRECT_URI=http://localhost:8787/api/v1/auth/google/callback');
  }
} else {
  console.log('❌ .dev.vars file NOT found');
  console.log('\nCreate .dev.vars file with:');
  console.log('JWT_SECRET=dev-secret-key');
  console.log('API_KEY_SALT=dev-salt-key');
  console.log('GOOGLE_CLIENT_ID=your-client-id');
  console.log('GOOGLE_CLIENT_SECRET=your-client-secret');
  console.log('GOOGLE_REDIRECT_URI=http://localhost:8787/api/v1/auth/google/callback');
}

console.log('\n📋 Google Cloud Console Checklist:');
console.log('1. Go to https://console.cloud.google.com/apis/credentials');
console.log('2. Select your OAuth 2.0 Client ID');
console.log('3. Verify Authorized redirect URIs includes:');
console.log('   - For development: http://localhost:8787/api/v1/auth/google/callback');
console.log('   - For production: https://cutty.emilycogsdill.com/api/v1/auth/google/callback');
console.log('4. Ensure OAuth consent screen is configured');
console.log('5. Check that required scopes are enabled (email, profile, openid)');

console.log('\n🧪 Testing Steps:');
console.log('1. Start dev server: npm run dev');
console.log('2. Check logs with enhanced debugging enabled');
console.log('3. Try OAuth flow and watch for [OAuth Debug] messages');
console.log('4. Common issues to check:');
console.log('   - Redirect URI mismatch (must match EXACTLY)');
console.log('   - Client ID/Secret mismatch');
console.log('   - OAuth consent screen not configured');
console.log('   - Missing required scopes');

console.log('\n🔗 Quick Test URL:');
console.log('http://localhost:8787/api/v1/auth/google');