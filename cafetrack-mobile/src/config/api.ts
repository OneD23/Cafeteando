import { Platform } from 'react-native';
import Constants from 'expo-constants';

const resolveDevApiUrl = (): string => {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any)?.manifest2?.extra?.expoClient?.hostUri ||
    '';
  const host = hostUri.split(':')[0];

  if (host) {
    return `http://${host}:5000/api`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000/api';
  }

  return 'http://localhost:5000/api';
};

export const API_URL = process.env.EXPO_PUBLIC_API_URL || resolveDevApiUrl();
