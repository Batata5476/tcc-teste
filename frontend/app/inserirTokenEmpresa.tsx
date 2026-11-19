import React, { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { saveToken } from "../services/auth";

export default function InserirTokenEmpresa() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState(params.token ?? "");

  const handleLoginWithToken = async () => {
    const cleanToken = token.trim();

    if (!cleanToken) {
      Alert.alert("Erro", "Informe o token.");
      return;
    }

    try {
      await saveToken(cleanToken);
      Alert.alert("Sucesso", "Login realizado com sucesso!");
      router.replace("/dashboard");
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Nao foi possivel entrar.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Insira o Token</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Token</Text>
        <TextInput
          placeholder="Token JWT gerado"
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
          autoCorrect={false}
          multiline
          style={styles.input}
        />

        <TouchableOpacity style={styles.button} onPress={handleLoginWithToken}>
          <Text style={styles.buttonText}>Entrar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  title: {
    color: "#111",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  label: {
    marginBottom: 6,
    color: "#333",
  },
  input: {
    backgroundColor: "#FEFDF9",
    minHeight: 48,
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    textAlignVertical: "top",
  },
  button: {
    backgroundColor: "#285A71",
    padding: 14,
    borderRadius: 10,
    marginTop: 10,
  },
  buttonText: {
    color: "#ECEFDA",
    textAlign: "center",
    fontWeight: "600",
  },
});
