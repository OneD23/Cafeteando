import { Platform } from 'react-native';
import Constants from 'expo-constants';

const RAILWAY_API_URL = 'https://cafeteando-production.up.railway.app/api';

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

  return RAILWAY_API_URL;
};

const normalizeApiUrl = (url: string): string => {
  const trimmed = url.replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

export const API_URL = normalizeApiUrl(process.env.EXPO_PUBLIC_API_URL || resolveDevApiUrl());
