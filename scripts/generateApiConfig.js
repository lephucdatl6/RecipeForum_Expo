const os = require('os');
const fs = require('fs');
const path = require('path');

/**
 * Get the first non-internal IPv4 address.
 * Priority: Wi-Fi, Ethernet, then others.
 * @returns {string}
 */
const getLocalIPAddress = () => {
  const interfaces = os.networkInterfaces();
  const priorityOrder = ['Wi-Fi', 'Ethernet', 'en0', 'eth0', 'wlan0'];

  for (const name of priorityOrder) {
    if (interfaces[name]) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
  }
  // Fallback: search all interfaces
  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
};

/**
 * Generate the API config file for the frontend.
 */
const generateApiConfig = () => {
  const ipAddress = getLocalIPAddress();
  const port = process.env.PORT || 3001;
  const NGROK_URL = process.env.NGROK_URL || 'https://hornish-anisha-unsoulish.ngrok-free.dev';

  // Main config content
  const configContent = `// Auto-generated API configuration
// Generated on: ${new Date().toLocaleString()}
// Detected IP: ${ipAddress}

export const API_BASE_URL = '${NGROK_URL}';

// --- Legacy/local development logic ---
// Uncomment below if you want to use local IP for API.
/*
import { Platform } from 'react-native';
import Constants from 'expo-constants';

export const API_MODE = 'AUTO';
export const API_CONFIGS = {
  AUTO_DETECTED: 'http://${ipAddress}:${port}',
  LOCALHOST: 'http://localhost:${port}',
  EMULATOR: 'http://10.0.2.2:${port}',
  MANUAL_OVERRIDE: ''
};

let detectedApiUrl = API_CONFIGS.AUTO_DETECTED;

if (API_MODE === 'AUTO') {
  if (Platform.OS === 'android') {
    const deviceName = Constants.deviceName || '';
    detectedApiUrl = deviceName.toLowerCase().includes('emulator') || !deviceName
      ? API_CONFIGS.EMULATOR
      : API_CONFIGS.AUTO_DETECTED;
  } else if (Platform.OS === 'ios') {
    const deviceName = Constants.deviceName || '';
    detectedApiUrl = deviceName.toLowerCase().includes('simulator')
      ? API_CONFIGS.LOCALHOST
      : API_CONFIGS.AUTO_DETECTED;
  }
}
export const API_BASE_URL =
  API_CONFIGS.MANUAL_OVERRIDE ||
  (API_MODE === 'AUTO' ? detectedApiUrl : API_CONFIGS[API_MODE]) ||
  API_CONFIGS.AUTO_DETECTED;
*/
`;

  const configDir = path.resolve(__dirname, '..', 'config');
  const configPath = path.join(configDir, 'apiConfig.ts');

  try {
    // Ensure config directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(configPath, configContent);
    console.log('API configuration generated successfully!');
    console.log(`Detected IP: ${ipAddress}`);
    console.log(`API URL: http://${ipAddress}:${port}`);
    console.log(`Config file: ${configPath}`);
    return { ipAddress, port, apiUrl: `http://${ipAddress}:${port}`, configPath };
  } catch (err) {
    console.error('Error writing API config file:', err);
    return null;
  }
};

module.exports = { getLocalIPAddress, generateApiConfig };

if (require.main === module) {
  generateApiConfig();
}