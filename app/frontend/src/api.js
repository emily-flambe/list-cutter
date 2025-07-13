// frontend/src/api.js
import axios from 'axios';
import { getNewToken } from './auth';

const getApiBaseUrl = () => {
  return import.meta.env.VITE_API_BASE_URL || '';
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
      const newToken = await getNewToken();
      if (newToken) {
        console.log('Token refresh successful, retrying request');
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        return api(originalRequest);
      } else {
        console.log('Token refresh failed');
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
