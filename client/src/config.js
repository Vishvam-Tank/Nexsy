// client/src/config.js

// Development configuration
const devConfig = {
  API_URL: 'http://localhost:5000/api',
  SOCKET_URL: 'http://localhost:5000'
};

// Production configuration - UPDATE THESE WITH YOUR ACTUAL RENDER URL
const prodConfig = {
  API_URL: 'https://nexsy.onrender.com/api', // REPLACE WITH YOUR RENDER URL
  SOCKET_URL: 'https://nexsy.onrender.com'   // REPLACE WITH YOUR RENDER URL
};

// Check if we're in production
const isProduction = import.meta.env.PROD;

// Use environment variables if available, otherwise use config
const config = isProduction ? prodConfig : devConfig;

export const API_URL = import.meta.env.VITE_API_URL || config.API_URL;
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || config.SOCKET_URL;

console.log('API URL:', API_URL);
console.log('Socket URL:', SOCKET_URL);