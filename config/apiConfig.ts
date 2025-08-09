// Auto-generated API configuration
// Generated on: 8/9/2025, 1:58:25 PM
// Detected IP: 10.25.16.105

export const API_BASE_URL = 'http://10.25.16.105:3001';

// Backup configurations
export const API_CONFIGS = {
  AUTO_DETECTED: 'http://10.25.16.105:3001',
  LOCALHOST: 'http://localhost:3001',
  MANUAL_OVERRIDE: '', 
};

export const getApiUrl = () => {
  return API_CONFIGS.MANUAL_OVERRIDE || API_CONFIGS.AUTO_DETECTED;
};
