import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { authenticatedFetch } from "./api";

const STORAGE_KEY = "coopera_points_enabled";
let memoryPointsEnabled: boolean | null = null;

async function readLocalPointsEnabled(): Promise<boolean> {
  if (memoryPointsEnabled !== null) {
    return memoryPointsEnabled;
  }
  try {
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw !== null) {
          memoryPointsEnabled = raw === "true";
          return memoryPointsEnabled;
        }
      }
    } else {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      if (raw !== null) {
        memoryPointsEnabled = raw === "true";
        return memoryPointsEnabled;
      }
    }
  } catch {
    // Fallback para true
  }
  return true;
}

async function writeLocalPointsEnabled(enabled: boolean): Promise<void> {
  memoryPointsEnabled = enabled;
  try {
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY, String(enabled));
      }
    } else {
      await SecureStore.setItemAsync(STORAGE_KEY, String(enabled));
    }
  } catch {
    // Ignora falha de escrita local
  }
}

export async function getCachedPointsEnabled(): Promise<boolean> {
  return readLocalPointsEnabled();
}

export async function syncPointsEnabledFromServer(): Promise<boolean> {
  try {
    const res = await authenticatedFetch("/company/points-settings");
    if (res.ok) {
      const body = await res.json();
      if (typeof body?.data?.pointsEnabled === "boolean") {
        await writeLocalPointsEnabled(body.data.pointsEnabled);
        return body.data.pointsEnabled;
      }
    }
  } catch {
    // Em caso de falha de rede, mantém o valor em cache local
  }
  return readLocalPointsEnabled();
}

export async function updatePointsEnabledSetting(enabled: boolean): Promise<boolean> {
  await writeLocalPointsEnabled(enabled);
  try {
    const res = await authenticatedFetch("/company/points-settings", {
      method: "PATCH",
      body: JSON.stringify({ pointsEnabled: enabled }),
    });
    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      if (typeof body?.data?.pointsEnabled === "boolean") {
        await writeLocalPointsEnabled(body.data.pointsEnabled);
        return body.data.pointsEnabled;
      }
    }
  } catch {
    // Mantém preferência salva localmente caso offline ou colaborador sem permissão admin
  }
  return enabled;
}
