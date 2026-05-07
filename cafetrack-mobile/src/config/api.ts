import { Platform } from 'react-native';
import Constants from 'expo-constants';

const resolveDevApiUrl = (): string => {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any)?.manifest2?.extra?.expoClient?.hostUri ||
    '';
  const host = hostUri.split(':')[0];

  if (host) {
    return `https://cafeteando-production.up.railway.app/api`;
  }

  if (Platform.OS === 'android') {
    return 'https://cafeteando-production.up.railway.app/api';
  }

  return 'https://cafeteando-production.up.railway.app/api';
};

export const API_URL = 'https://cafeteando-production.up.railway.app/api';