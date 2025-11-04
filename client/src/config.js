// client/src/config.js

// For development
const dev = {
  API_URL: 'http://localhost:5000/api',
  SOCKET_URL: 'http://localhost:5000'
};

// For production - UPDATE THESE WITH YOUR ACTUAL RENDER URL
const prod = {
  API_URL: 'https://nexsy.onrender.com/api', // REPLACE THIS
  SOCKET_URL: 'https://nexsy.onrender.com'   // REPLACE THIS
};

// Check if we're in production
const isProduction = import.meta.env.PROD;

export const config = isProduction ? prod : dev;
export const API_URL = config.API_URL;
export const SOCKET_URL = config.SOCKET_URL;