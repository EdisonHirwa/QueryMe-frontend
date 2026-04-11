import axios from 'axios';
import { clearAuthState, getStoredToken } from '../utils/authStorage';

const baseURL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

const axiosInstance = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosInstance.interceptors.request.use((config) => {
  const token = getStoredToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearAuthState();
      window.dispatchEvent(new CustomEvent('qm:unauthorized'));
    }

    return Promise.reject(error);
  },
);

export default axiosInstance;
