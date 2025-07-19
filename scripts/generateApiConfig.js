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
      // Skip internal (localhost) and non-IPv4 addresses
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

export const API_BASE_URL = 'http://${ipAddress}:${port}';

// Backup configurations
export const API_CONFIGS = {
  AUTO_DETECTED: 'http://${ipAddress}:${port}',
  LOCALHOST: 'http://localhost:${port}',
  MANUAL_OVERRIDE: '', 
};

export const getApiUrl = () => {
  return API_CONFIGS.MANUAL_OVERRIDE || API_CONFIGS.AUTO_DETECTED;
};
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
