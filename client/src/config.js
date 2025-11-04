// client/src/config.js

// Configuration for different environments
const config = {
  development: {
    API_URL: 'http://localhost:5000/api',
    SOCKET_URL: 'http://localhost:5000'
  },
  production: {
    API_URL: 'https://nexsy-1.onrender.com/api', // YOUR RENDER URL
    SOCKET_URL: 'https://nexsy-1.onrender.com'   // YOUR RENDER URL
  }
};

// Use environment variables if available, otherwise use config
const environment = import.meta.env.PROD ? 'production' : 'development';
const envConfig = config[environment];

export const API_URL = import.meta.env.VITE_API_URL || envConfig.API_URL;
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || envConfig.SOCKET_URL;

console.log('🚀 Nexsy Chat Configuration:');
console.log('Environment:', environment);
console.log('API URL:', API_URL);
console.log('Socket URL:', SOCKET_URL);
console.log('Backend:', 'https://nexsy-1.onrender.com');