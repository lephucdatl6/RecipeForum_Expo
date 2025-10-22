// Auto-generated API configuration
// Generated on: 10/22/2025, 3:54:36 PM
// Detected IP: 192.168.100.194

export const API_BASE_URL = 'http://192.168.100.194:3001';

// Backup configurations
export const API_CONFIGS = {
  AUTO_DETECTED: 'http://192.168.100.194:3001',
  LOCALHOST: 'http://localhost:3001',
  MANUAL_OVERRIDE: '', 
};

export const getApiUrl = () => {
  return API_CONFIGS.MANUAL_OVERRIDE || API_CONFIGS.AUTO_DETECTED;
};
