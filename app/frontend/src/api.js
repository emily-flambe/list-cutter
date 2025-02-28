// frontend/src/api.js
import axios from 'axios';
import { getNewToken } from './auth';

const api = axios.create({});

api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
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
