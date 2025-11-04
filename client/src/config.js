// client/src/config.js
const isProduction = import.meta.env.PROD;

export const API_URL = isProduction 
  ? 'https://your-backend-url.onrender.com/api' 
  : 'http://localhost:5000/api';

export const SOCKET_URL = isProduction 
  ? 'https://your-backend-url.onrender.com' 
  : 'http://localhost:5000';
