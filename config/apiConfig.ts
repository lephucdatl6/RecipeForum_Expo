// Auto-generated API configuration
// Generated on: 8/8/2025, 2:00:09 PM
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
