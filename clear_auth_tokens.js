// Clear authentication tokens from localStorage
// Run this in browser console to clear invalid tokens

console.log('Clearing authentication tokens...');

// Clear all auth-related localStorage items
localStorage.removeItem('authToken');
localStorage.removeItem('refreshToken');
localStorage.removeItem('token');

console.log('Authentication tokens cleared successfully!');
console.log('Please refresh the page and try logging in again.');

// Optional: Show what was cleared
console.log('Cleared items:', {
  authToken: 'removed',
  refreshToken: 'removed', 
  token: 'removed'
});