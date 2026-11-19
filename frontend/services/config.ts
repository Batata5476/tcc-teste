import Constants from 'expo-constants';
import { Platform } from 'react-native';

function resolveApiUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  // 1. Se uma URL externa HTTPS (ex: túnel ngrok / produção) foi definida explicitamente, prioriza ela
  if (envUrl && envUrl.startsWith('https://')) {
    return envUrl.replace(/\/+$/, '');
  }

  // 2. No navegador (Web), usa sempre o mesmo hostname da barra de endereços (localhost ou IP da máquina)
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    return `http://${window.location.hostname}:3000`;
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
