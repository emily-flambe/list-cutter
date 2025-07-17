#!/usr/bin/env node

/**
 * Direct OAuth Token Exchange Test
 * Tests Google OAuth token endpoint directly
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Google OAuth Token Exchange\n');

// Read .dev.vars to get credentials
const devVarsPath = path.join(__dirname, '.dev.vars');
if (!fs.existsSync(devVarsPath)) {
  console.error('❌ .dev.vars file not found!');
  process.exit(1);
}

const devVars = fs.readFileSync(devVarsPath, 'utf8');
const vars = {};
devVars.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    vars[key.trim()] = value.trim();
  }
});

if (!vars.GOOGLE_CLIENT_ID || !vars.GOOGLE_CLIENT_SECRET) {
  console.error('❌ Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .dev.vars');
  process.exit(1);
}

console.log('📋 Configuration:');
console.log(`Client ID: ${vars.GOOGLE_CLIENT_ID.substring(0, 20)}...`);
console.log(`Redirect URI: ${vars.GOOGLE_REDIRECT_URI}`);
console.log('');

// Test with a dummy authorization code to see what error we get
const testParams = new URLSearchParams({
  client_id: vars.GOOGLE_CLIENT_ID,
  client_secret: vars.GOOGLE_CLIENT_SECRET,
  code: 'INVALID_TEST_CODE',
  grant_type: 'authorization_code',
  redirect_uri: vars.GOOGLE_REDIRECT_URI,
});

const postData = testParams.toString();

const options = {
  hostname: 'oauth2.googleapis.com',
  port: 443,
  path: '/token',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('🔄 Testing token exchange endpoint...\n');

const req = https.request(options, (res) => {
  console.log(`Response Status: ${res.statusCode}`);
  console.log(`Response Headers:`, res.headers);
  console.log('');
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('Response Body:', JSON.stringify(response, null, 2));
      
      if (response.error) {
        console.log('\n🔍 Error Analysis:');
        
        if (response.error === 'invalid_grant') {
          console.log('✅ This is expected with a test code');
          console.log('✅ OAuth endpoint is responding correctly');
          console.log('✅ Credentials are being accepted');
          console.log('\n💡 The real issue is likely:');
          console.log('   1. The authorization code has expired (they expire quickly)');
          console.log('   2. The code was already used');
          console.log('   3. Redirect URI mismatch between auth and token request');
        } else if (response.error === 'invalid_client') {
          console.log('❌ Client authentication failed');
          console.log('   - Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
          console.log('   - Verify credentials in Google Cloud Console');
        } else if (response.error === 'redirect_uri_mismatch') {
          console.log('❌ Redirect URI mismatch');
          console.log('   - Must match EXACTLY what\'s in Google Cloud Console');
          console.log('   - Check for trailing slashes, http vs https, port numbers');
        }
      }
    } catch (e) {
      console.log('Raw Response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error(`❌ Request Error: ${e.message}`);
});

req.write(postData);
req.end();

console.log('\n📝 Next Steps:');
console.log('1. Check the Google Cloud Console authorized redirect URIs');
console.log('2. Ensure it includes EXACTLY: ' + vars.GOOGLE_REDIRECT_URI);
console.log('3. Try the OAuth flow again and check the [OAuth Debug] logs');
console.log('4. The detailed logging will show exactly where it fails');