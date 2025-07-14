// frontend/src/context/AuthContext.jsx
import React, { createContext, useState, useEffect } from 'react';
import api from '../api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('authToken'));
  const [user, setUser] = useState(null);

  const login = (newToken, username, refreshToken) => {
    localStorage.setItem('authToken', newToken);
    localStorage.setItem('refreshToken', refreshToken); // Store refresh token
    setToken(newToken);
    fetchUserData(newToken);
  };

  const logout = () => {
    clearAllTokens();
    setToken(null);
    setUser(null);
  };

  const fetchUserData = async (token) => {
    try {
      const response = await api.get('/api/v1/accounts/user');
      setUser(response.data);
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.error('Failed to fetch user data:', error);
        console.log('Attempting to refresh token...');
        await refreshToken();
        try {
          const response = await api.get('/api/v1/accounts/user');
          setUser(response.data);
        } catch (retryError) {
          console.error('Failed to fetch user data after refreshing token:', retryError);
          setUser(null);
        }
        return;
      }
      console.error('Failed to fetch user data:', error);
      setUser(null);
    }
  };

  const refreshToken = async () => {
    console.log('Attempting to refresh token...');
    try {
      const refreshTokenValue = localStorage.getItem('refreshToken');
      
      if (!refreshTokenValue) {
        console.log('No refresh token found, logging out');
        logout();
        return;
      }

      console.log('Sending request to refresh token at:', `/api/v1/auth/refresh`);
      
      const response = await api.post(
        `/api/v1/auth/refresh`,
        { refresh_token: refreshTokenValue },
        { headers: { 'Content-Type': 'application/json' } }
      );

      console.log('Token refresh successful');

      const newAccessToken = response.data.access_token;
      const newRefreshToken = response.data.refresh_token;
      
      localStorage.setItem('authToken', newAccessToken);
      if (newRefreshToken) {
        localStorage.setItem('refreshToken', newRefreshToken);
      }
      
      setToken(newAccessToken);
      fetchUserData(newAccessToken);
    } catch (error) {
      console.error('Failed to refresh token:', error);
      
      // If token refresh fails, clear all tokens and log out
      if (error.response && (error.response.status === 401 || error.response.status === 400)) {
        console.log('Invalid refresh token, clearing all tokens and logging out');
        clearAllTokens();
      }
      
      logout();
    }
  };

  const clearAllTokens = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('token'); // Legacy token key
    console.log('All authentication tokens cleared');
  };

  // Validate token on app initialization
  const validateToken = async () => {
    const storedToken = localStorage.getItem('authToken');
    if (storedToken) {
      try {
        // Try to fetch user data to validate token
        const response = await api.get('/api/v1/accounts/user');
        setUser(response.data);
      } catch (error) {
        if (error.response && (error.response.status === 401 || error.response.status === 400)) {
          console.log('Stored token is invalid, clearing tokens');
          clearAllTokens();
          setToken(null);
          setUser(null);
        }
      }
    }
  };

  useEffect(() => {
    if (token) {
      fetchUserData(token); // Fetch user data on token change
    } else {
      setUser(null); // Reset user if no token
    }
  }, [token]);

  // Validate token on app startup
  useEffect(() => {
    validateToken();
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};
