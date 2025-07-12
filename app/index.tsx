import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

export default function Index() {
  useEffect(() => {
    // Redirect to login screen on app start
    router.replace('./screens/LoginScreen');
  }, []);

  return <View />;
}
