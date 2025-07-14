// Debug script to check tokens in localStorage
// Run this in browser console to inspect stored tokens

console.log('=== TOKEN DEBUG INFO ===');

// Get all auth-related items from localStorage
const authToken = localStorage.getItem('authToken');
const refreshToken = localStorage.getItem('refreshToken');
const legacyToken = localStorage.getItem('token');

console.log('AuthToken length:', authToken ? authToken.length : 'null');
console.log('RefreshToken length:', refreshToken ? refreshToken.length : 'null');
console.log('Legacy token length:', legacyToken ? legacyToken.length : 'null');

if (authToken) {
  console.log('AuthToken starts with:', authToken.substring(0, 20) + '...');
  console.log('AuthToken ends with:', '...' + authToken.substring(authToken.length - 20));
  
  // Check if it looks like a valid JWT (has 3 parts separated by dots)
  const parts = authToken.split('.');
  console.log('JWT parts count:', parts.length);
  if (parts.length === 3) {
    console.log('✅ Token format looks valid (3 parts)');
  } else {
    console.log('❌ Token format invalid (should have 3 parts)');
  }
}

if (refreshToken) {
  console.log('RefreshToken starts with:', refreshToken.substring(0, 20) + '...');
  const refreshParts = refreshToken.split('.');
  console.log('Refresh JWT parts count:', refreshParts.length);
  if (refreshParts.length === 3) {
    console.log('✅ Refresh token format looks valid');
  } else {
    console.log('❌ Refresh token format invalid');
  }
}

// Show all localStorage keys that might be auth-related
console.log('All localStorage keys:', Object.keys(localStorage));

console.log('=== END DEBUG INFO ===');