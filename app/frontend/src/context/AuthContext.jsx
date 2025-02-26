// frontend/src/context/AuthContext.jsx
import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('authToken'));
  const [user, setUser] = useState(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

  const login = (newToken, username) => {
    localStorage.setItem('authToken', newToken);
    setToken(newToken);
    fetchUserData(newToken); // Fetch user data on login
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    setToken(null);
    setUser(null);
  };

  const fetchUserData = async (token) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/accounts/user/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setUser(response.data); // Set user data
    } catch (error) {
      if (error.response && error.response.status === 401) {
        await refreshToken(); // Attempt to refresh the token
        fetchUserData(localStorage.getItem('authToken')); // Retry fetching user data
      } else {
        console.error('Failed to fetch user data:', error);
        setUser(null); // Reset user if fetching fails
      }
    }
  };

  const refreshToken = async () => {
    console.log('Attempting to refresh token...'); // Log when the refresh attempt starts
    try {
      const refreshTokenValue = localStorage.getItem('refreshToken');
      console.log('Using refresh token:', refreshTokenValue); // Log the refresh token being used

      const response = await axios.post(`${API_BASE_URL}/api/accounts/token/refresh/`, {
        refresh: refreshTokenValue, // Store refresh token in local storage
      });
      
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
