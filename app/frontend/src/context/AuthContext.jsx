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
    localStorage.removeItem('authToken');
    setToken(null);
    setUser(null);
  };

  const fetchUserData = async (token) => {
    try {
      const response = await api.get(`/api/accounts/user/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setUser(response.data); // Set user data
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.error('Failed to fetch user data:', error);
        console.log('Attempting to refresh token...'); // Log refresh attempt
        await refreshToken(); // Attempt to refresh the token
        try {
          // Retry fetching user data with the new token
          const newToken = localStorage.getItem('authToken');
          const response = await api.get(`/api/accounts/user/`, {
            headers: {
              Authorization: `Bearer ${newToken}`,
            },
          });
          setUser(response.data); // Set user data
        } catch (retryError) {
          console.error('Failed to fetch user data after refreshing token:', retryError);
          console.error('Request payload:', { token }); // Log the request payload
          setUser(null); // Reset user if fetching fails
        }
        return; // Stop further execution
      }
      console.error('Failed to fetch user data:', error);
      setUser(null); // Reset user if fetching fails
    }
  };

  const refreshToken = async () => {
    console.log('Attempting to refresh token...'); // Log when the refresh attempt starts
    try {
      const refreshTokenValue = localStorage.getItem('refreshToken'); // Retrieve refresh token
      console.log('Using refresh token:', refreshTokenValue); // Log the refresh token being used

      // Log the request details
      console.log('Sending request to refresh token at:', `/api/accounts/token/refresh/`);
      
      // Form the request
      const response = await api.post(
        `/api/accounts/token/refresh/`,
        { refresh: refreshTokenValue }, // Data to send
        { headers: { 'Content-Type': 'application/json' } } // Headers
      );

      console.log('Token refresh response:', response.data); // Log the response from the server

      const newAccessToken = response.data.access;
      localStorage.setItem('authToken', newAccessToken);
      setToken(newAccessToken);
      fetchUserData(newAccessToken); // Fetch user data with the new token
    } catch (error) {
      console.error('Failed to refresh token:', error); // Log the error
      if (error.response) {
        console.error('Response data:', error.response.data); // Log response data if available
        console.error('Response status:', error.response.status); // Log response status
      }
      logout(); // Log out if refresh fails
    }
  };

  useEffect(() => {
    if (token) {
      fetchUserData(token); // Fetch user data on token change
    } else {
      setUser(null); // Reset user if no token
    }
  }, [token]);

  return (
    <AuthContext.Provider value={{ token, user, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};
