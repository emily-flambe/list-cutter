// frontend/src/api.js
import axios from 'axios';
import { getNewToken } from './auth';

const getApiBaseUrl = () => {
  // If VITE_API_BASE_URL is explicitly set, use it
  if (import.meta.env.VITE_API_BASE_URL !== undefined) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // Auto-detect based on hostname
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://127.0.0.1:8788';
    }
    
    // Production
    if (hostname === 'cutty.emilycogsdill.com') {
      return '';
    }
    
    // Development
    if (hostname === 'cutty-dev.emilycogsdill.com') {
      return '';
    }
    
    // Preview deployments (*.workers.dev) - use same origin
    if (hostname.includes('workers.dev') || hostname.includes('emily-cogsdill.workers.dev')) {
      return '';
    }
  }
  
  // Fallback to same origin
  return '';
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to automatically add Authorization header
api.interceptors.request.use(
  config => {
    // Check both 'token' (OAuth) and 'authToken' (legacy) for compatibility
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Remove Content-Type header for FormData to let browser set it with boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    
    // Handle network errors (e.g., cold start timeouts)
    if (!error.response && error.code === 'ECONNABORTED') {
      console.log('Request timeout, retrying...');
      if (!originalRequest._retryCount) {
        originalRequest._retryCount = 0;
      }
      if (originalRequest._retryCount < 2) {
        originalRequest._retryCount++;
        originalRequest.timeout = 45000; // Increase timeout for retry
        return api(originalRequest);
      }
    }
    
    // Handle 401 errors (token refresh)
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      console.log('Interceptor triggered for 401 error');
      originalRequest._retry = true;
      
      try {
        const newToken = await getNewToken();
        if (newToken) {
          console.log('Token refresh successful, retrying request');
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          return api(originalRequest);
        } else {
          console.log('Token refresh failed, clearing tokens and redirecting to login');
          // Clear all tokens if refresh fails
          localStorage.removeItem('authToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('token');
          
          // Redirect to login page if not already there
          if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
            window.location.href = '/login';
          }
        }
      } catch (refreshError) {
        console.error('Token refresh error:', refreshError);
        // Clear tokens on refresh error
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('token');
        
        // Redirect to login page
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          window.location.href = '/login';
        }
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
