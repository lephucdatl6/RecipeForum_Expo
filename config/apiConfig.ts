// Auto-generated API configuration
// Generated on: 10/29/2025, 6:10:09 PM
// Detected IP: 192.168.100.194

export const API_BASE_URL = 'https://hornish-anisha-unsoulish.ngrok-free.dev';

// --- Legacy/local development logic ---
// Uncomment below if you want to use local IP for API.
/*
import { Platform } from 'react-native';
import Constants from 'expo-constants';

export const API_MODE = 'AUTO';
export const API_CONFIGS = {
  AUTO_DETECTED: 'http://192.168.100.194:3001',
  LOCALHOST: 'http://localhost:3001',
  EMULATOR: 'http://10.0.2.2:3001',
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
