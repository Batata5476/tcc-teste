import Constants from 'expo-constants';
import { Platform } from 'react-native';

function resolveApiUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  // 1. Se uma URL externa HTTPS (ex: Vercel / produção / túnel ngrok) foi definida explicitamente, prioriza ela
  if (envUrl && envUrl.startsWith('https://')) {
    return envUrl.replace(/\/+$/, '');
  }

  // 2. No navegador (Web), detecta se é ambiente local (usa porta 3000) ou produção (usa EXPO_PUBLIC_API_URL / origin)
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname;
    const isLocal =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      host.startsWith('172.');

    if (isLocal) {
      return `http://${host}:3000`;
    }
    if (envUrl) {
      return envUrl.replace(/\/+$/, '');
    }
    return window.location.origin;
  }

  // 3. No Expo Go / celular físico, hostUri traz automaticamente o IP atual do PC no Wi-Fi ou Roteador 4G
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:3000`;
  }

  // 4. Se foi definido explicitamente no .env (ex: emulador sem hostUri)
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }

  // 5. Fallback local padrão
  return 'http://localhost:3000';
}

export const API_URL = resolveApiUrl();
