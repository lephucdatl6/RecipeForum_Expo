// Auto-generated API configuration
// Generated on: 8/23/2025, 2:02:45 PM
// Detected IP: 10.25.34.44

export const API_BASE_URL = 'http://10.25.34.44:3001';

// Backup configurations
export const API_CONFIGS = {
  AUTO_DETECTED: 'http://10.25.34.44:3001',
  LOCALHOST: 'http://localhost:3001',
  MANUAL_OVERRIDE: '', 
};

export const getApiUrl = () => {
  return API_CONFIGS.MANUAL_OVERRIDE || API_CONFIGS.AUTO_DETECTED;
};
