import { Platform } from "react-native";

export type PointsConfig = {
  enabled: boolean;
  meta: number;
  pontosNormal: number;
  pontosUrgente: number;
};

const DEFAULT_CONFIG: PointsConfig = {
  enabled: true,
  meta: 500,
  pontosNormal: 100,
  pontosUrgente: 200,
};

const STORAGE_KEY = "@coopera:points_config";

export async function getPointsConfig(): Promise<PointsConfig> {
  try {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
      }
    }
  } catch {
    // Fallback para defaults
  }
  return DEFAULT_CONFIG;
}

export async function savePointsConfig(config: PointsConfig): Promise<void> {
  try {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    }
  } catch {
    // Ignora erro de escrita local
  }
}
