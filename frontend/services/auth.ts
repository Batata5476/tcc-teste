import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { API_URL } from "./config";

const isWeb = Platform.OS === "web";

export async function saveToken(token: string, userType?: string): Promise<void> {
  if (isWeb && typeof window !== "undefined") {
    localStorage.setItem("access_token", token);
    if (userType) {
      localStorage.setItem("user_type", userType);
    }
  } else {
    await SecureStore.setItemAsync("access_token", token);
    if (userType) {
      await SecureStore.setItemAsync("user_type", userType);
    }
  }
}

export async function getToken(): Promise<string | null> {
  if (isWeb && typeof window !== "undefined") {
    return localStorage.getItem("access_token");
  }
  return SecureStore.getItemAsync("access_token");
}

export async function getUserType(): Promise<string | null> {
  if (isWeb && typeof window !== "undefined") {
    return localStorage.getItem("user_type");
  }
  return SecureStore.getItemAsync("user_type");
}

export async function logout(): Promise<void> {
  if (isWeb && typeof window !== "undefined") {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_type");
  } else {
    await SecureStore.deleteItemAsync("access_token");
    await SecureStore.deleteItemAsync("user_type");
  }
}

export async function login(loginInput: string, senha: string): Promise<any> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login: loginInput, senha }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (
      response.status === 401 &&
      (data.message === "PRIMEIRO_ACESSO_REQUERIDO" ||
        data.error === "PRIMEIRO_ACESSO_REQUERIDO")
    ) {
      throw new Error("PRIMEIRO_ACESSO_REQUERIDO");
    }
    const message = Array.isArray(data.message)
      ? data.message.join(", ")
      : data.message || "Credenciais inválidas ou erro no login.";
    throw new Error(message);
  }

  const token = data.data?.access_token || data.access_token;
  const userType = data.data?.type || data.type || "user";

  if (token) {
    await saveToken(token, userType);
  }

  return data;
}

export async function validateFirstAccess(
  activationCode: string,
  token: string
): Promise<any> {
  const response = await fetch(`${API_URL}/auth/first-access/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activation_code: activationCode, token }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = Array.isArray(data.message)
      ? data.message.join(", ")
      : data.message || "Código ou token inválido.";
    throw new Error(message);
  }

  return data;
}

export async function activateFirstAccess(
  activationCode: string,
  token: string,
  novaSenha: string
): Promise<any> {
  const response = await fetch(`${API_URL}/auth/first-access/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      activation_code: activationCode,
      token,
      senha: novaSenha,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = Array.isArray(data.message)
      ? data.message.join(", ")
      : data.message || "Não foi possível ativar a conta.";
    throw new Error(message);
  }

  const accessToken = data.data?.access_token || data.access_token;
  const userType = data.data?.type || data.type || "user";
  if (accessToken) {
    await saveToken(accessToken, userType);
  }

  return data;
}

export async function forgotPassword(email: string): Promise<any> {
  const response = await fetch(`${API_URL}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = Array.isArray(data.message)
      ? data.message.join(", ")
      : data.message || "Erro ao solicitar redefinição.";
    throw new Error(message);
  }

  return data;
}
