import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../api';

export const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('authToken'));
  const [user, setUser] = useState(null);

  const login = (newToken, username, refreshToken) => {
    localStorage.setItem('authToken', newToken);
    localStorage.setItem('refreshToken', refreshToken);
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
      const response = await api.get('/api/v1/auth/user');
      setUser(response.data.user || response.data);
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.error('Failed to fetch user data:', error);
        await refreshToken();
        try {
          const response = await api.get('/api/v1/auth/user');
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
        logout();
        return;
      }

      
      const response = await api.post(
        `/api/v1/auth/refresh`,
        { refresh_token: refreshTokenValue },
        { headers: { 'Content-Type': 'application/json' } }
      );


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
      
      if (error.response && (error.response.status === 401 || error.response.status === 400)) {
        clearAllTokens();
      }
      
      logout();
    }
  };

  const clearAllTokens = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('token');
  };

  const validateToken = async () => {
    const storedToken = localStorage.getItem('authToken');
    if (storedToken) {
      try {
        const response = await api.get('/api/v1/auth/user');
        setUser(response.data.user || response.data);
      } catch (error) {
        if (error.response && (error.response.status === 401 || error.response.status === 400)) {
          clearAllTokens();
          setToken(null);
          setUser(null);
        }
      }
    }
  };

  useEffect(() => {
    if (token) {
      fetchUserData(token);
    } else {
      setUser(null);
    }
  }, [token]);

  useEffect(() => {
    validateToken();
  }, []);

  return (
    <AuthContext.Provider value={{ 
      token, 
      user, 
      login, 
      logout, 
      setUser,
      API_BASE_URL: api.defaults.baseURL || ''
    }}>
      {children}
    </AuthContext.Provider>
  );
};
