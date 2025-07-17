/**
 * Auth Token Cleanup Utility
 * Clears old authentication tokens that may conflict with OAuth
 */

export const clearOldAuthTokens = () => {
  // Remove all old auth-related items
  const authKeys = ['token', 'refreshToken', 'refresh_token', 'access_token', 'user'];
  
  authKeys.forEach(key => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
  
  console.log('[Auth Cleanup] Cleared old authentication tokens');
};

export const setNewAuthToken = (token) => {
  // Clear old tokens first
  clearOldAuthTokens();
  
  // Set new token
  localStorage.setItem('token', token);
  console.log('[Auth Cleanup] Set new authentication token');
};