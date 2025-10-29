const os = require('os');
const fs = require('fs');
const path = require('path');

function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  
  // Priority order: Wi-Fi, Ethernet, then others
  const priorityOrder = ['Wi-Fi', 'Ethernet', 'en0', 'eth0', 'wlan0'];
  
  // First, try to find IP from priority interfaces
  for (const interfaceName of priorityOrder) {
    if (interfaces[interfaceName]) {
      for (const iface of interfaces[interfaceName]) {
        // Skip internal (localhost) and non-IPv4 addresses
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
  }
  
  // If no priority interface found, search all interfaces
  for (const interfaceName in interfaces) {
    for (const iface of interfaces[interfaceName]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  
  // Fallback to localhost if no external IP found
  return 'localhost';
}

function generateApiConfig() {
  const ipAddress = getLocalIPAddress();
  const port = process.env.PORT || 3001;
  
  const configContent = `// Auto-generated API configuration
// Generated on: ${new Date().toLocaleString()}
// Detected IP: ${ipAddress}

import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Set API_MODE to one of: 'AUTO_DETECTED', 'LOCALHOST', 'EMULATOR', 'MANUAL_OVERRIDE', or 'AUTO'
export const API_MODE = 'AUTO';

export const API_CONFIGS = {
  AUTO_DETECTED: 'http://${ipAddress}:${port}',
  LOCALHOST: 'http://localhost:${port}',
  EMULATOR: 'http://10.0.2.2:${port}',
  MANUAL_OVERRIDE: '',
};

let detectedApiUrl = API_CONFIGS.AUTO_DETECTED;

if (API_MODE === 'AUTO') {
  if (Platform.OS === 'android') {
    const deviceName = Constants.deviceName || '';
    if (deviceName.toLowerCase().includes('emulator') || !deviceName) {
      detectedApiUrl = API_CONFIGS.EMULATOR;
    } else {
      detectedApiUrl = API_CONFIGS.AUTO_DETECTED;
    }
  } else if (Platform.OS === 'ios') {
    const deviceName = Constants.deviceName || '';
    if (deviceName.toLowerCase().includes('simulator')) {
      detectedApiUrl = API_CONFIGS.LOCALHOST;
    } else {
      detectedApiUrl = API_CONFIGS.AUTO_DETECTED;
    }
  } else {
    detectedApiUrl = API_CONFIGS.AUTO_DETECTED;
  }
}

export const API_BASE_URL =
  API_CONFIGS.MANUAL_OVERRIDE ||
  (API_MODE === 'AUTO' ? detectedApiUrl : API_CONFIGS[API_MODE]) ||
  API_CONFIGS.AUTO_DETECTED;

`;

  const configDir = path.join(__dirname, '..', 'config');
  const configPath = path.join(configDir, 'apiConfig.ts');
  
  // Ensure config directory exists
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  // Write the config file
  fs.writeFileSync(configPath, configContent);
  
  console.log(`API configuration generated successfully!`);
  console.log(`Detected IP: ${ipAddress}`);
  console.log(`API URL: http://${ipAddress}:${port}`);
  console.log(`Config file: ${configPath}`);
  
  return {
    ipAddress,
    port,
    apiUrl: `http://${ipAddress}:${port}`,
    configPath
  };
}

// Export for use in other files
module.exports = {
  getLocalIPAddress,
  generateApiConfig
};

// If run directly, generate the config
if (require.main === module) {
  generateApiConfig();
}
