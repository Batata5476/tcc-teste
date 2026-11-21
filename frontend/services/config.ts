import Constants from "expo-constants";
import { Platform } from "react-native";

function resolveApiUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, "");
  }

  if (Platform.OS === "web" && typeof window !== "undefined" && window.location) {
    const origin = window.location.origin;
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return "http://localhost:3000";
    }
    return origin;
  }

  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(":")[0];
    return `http://${ip}:3000`;
  }

  return "http://localhost:3000";
}

export const API_URL = resolveApiUrl();
