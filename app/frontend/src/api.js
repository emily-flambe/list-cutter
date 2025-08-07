import axios from 'axios';
import { getNewToken } from './auth';

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL !== undefined) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://127.0.0.1:8788';
    }
    
    if (hostname === 'cutty.emilycogsdill.com') {
      return '';
    }
    
    if (hostname === 'cutty-dev.emilycogsdill.com') {
      return '';
    }
    
    if (hostname.includes('workers.dev') || hostname.includes('emily-cogsdill.workers.dev')) {
      return '';
    }
  }
  
  return '';
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
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
    
    if (!error.response && error.code === 'ECONNABORTED') {
      if (!originalRequest._retryCount) {
        originalRequest._retryCount = 0;
      }
      if (originalRequest._retryCount < 2) {
        originalRequest._retryCount++;
        originalRequest.timeout = 45000;
        return api(originalRequest);
      }
    }
    
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const newToken = await getNewToken();
        if (newToken) {
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          return api(originalRequest);
        } else {
          localStorage.removeItem('authToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('token');
          
          if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
            window.location.href = '/login';
          }
        }
      } catch (refreshError) {
        console.error('Token refresh error:', refreshError);
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('token');
        
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          window.location.href = '/login';
        }
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
