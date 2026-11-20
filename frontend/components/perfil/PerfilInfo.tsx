import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

type PerfilInfoProps = {
  email?: string;
  cpf?: string;
  telefone?: string;
};

export default function PerfilInfo({ email, cpf, telefone }: PerfilInfoProps) {
  return (
    <View style={styles.infoContainer}>
      <View style={styles.infoRow}>
        <Ionicons name="mail" size={16} color="#285A71" />
        <Text style={styles.infoText}>{email || "Não informado"}</Text>
      </View>

      <View style={styles.infoRow}>
        <Ionicons name="card" size={16} color="#285A71" />
        <Text style={styles.infoText}>{cpf || "000.000.000-00"}</Text>
      </View>

      <View style={styles.infoRow}>
        <Ionicons name="call" size={16} color="#285A71" />
        <Text style={styles.infoText}>{telefone || "(00) 00000-0000"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  infoContainer: {
    marginHorizontal: 20,
    marginVertical: 10,
    padding: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
    elevation: 1,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  infoText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#285A71",
  },
});