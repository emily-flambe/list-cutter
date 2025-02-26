// frontend/src/auth.js
import axios from 'axios';

export const getNewToken = async () => {
  try {
    const refreshToken = localStorage.getItem('refreshToken');
    const response = await axios.post(
      `/api/accounts/token/refresh/`,
      { refresh: refreshToken },
      { headers: { 'Content-Type': 'application/json' } }
    );
    const newToken = response.data.access;
    updateAuthToken(newToken);
    return newToken;
  } catch (error) {
    console.error('Failed to refresh token:', error);
    return null;
  }
};

export const updateAuthToken = (newToken) => {
  localStorage.setItem('authToken', newToken);
  // If you need to update your React context, consider adding a callback or using an event system.
};
