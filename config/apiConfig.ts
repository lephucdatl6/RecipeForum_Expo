// Auto-generated API configuration
// Generated on: 10/29/2025, 2:15:38 PM
// Detected IP: 192.168.100.194

import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Set API_MODE to one of: 'AUTO_DETECTED', 'LOCALHOST', 'EMULATOR', 'MANUAL_OVERRIDE', or 'AUTO'
export const API_MODE = 'AUTO';

export const API_CONFIGS = {
  AUTO_DETECTED: 'http://192.168.100.194:3001',
  LOCALHOST: 'http://localhost:3001',
  EMULATOR: 'http://10.0.2.2:3001',
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

