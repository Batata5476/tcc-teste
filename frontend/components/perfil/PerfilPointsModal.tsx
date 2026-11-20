import React, { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import PerfilButton from "./PerfilButton";

type PerfilPointsModalProps = {
  visible: boolean;
  onClose: () => void;
  pontos?: number;
};

export default function PerfilPointsModal({
  visible,
  onClose,
  pontos = 0,
}: PerfilPointsModalProps) {
  const [pointsEnabled, setPointsEnabled] = useState(true);

  const handleToggleSwitch = (value: boolean) => {
    setPointsEnabled(value);
    const msg = value
      ? "Pontuação ativada! Atividades concluídas gerarão pontos normalmente."
      : "Pontuação desativada. As atividades concluídas não acumularão pontos.";
    if (Platform.OS === "web") {
      window.alert(msg);
    } else {
      Alert.alert("Sistema de Pontuações", msg);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          {/* Cabeçalho */}
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="trophy" size={20} color="#D97706" />
              <Text style={styles.modalTitle}>Sistema de Pontuações</Text>
            </View>

            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close-outline" size={24} color="#263238" />
            </TouchableOpacity>
          </View>

          {/* Saldo de Pontos */}
          <View style={styles.pointsCard}>
            <Text style={styles.pointsLabel}>Seu Saldo Atual</Text>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
              <Text style={styles.pointsValue}>{pontos}</Text>
              <Text style={styles.pointsUnit}>pontos</Text>
            </View>
          </View>

          {/* Toggle de Ativação */}
          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.switchTitle}>Pontuar Atividades Concluídas</Text>
              <Text style={styles.switchSub}>
                Gera pontos automaticamente ao finalizar tarefas do dia.
              </Text>
            </View>
            <Switch
              trackColor={{ false: "#CBD5E1", true: "#285A71" }}
              thumbColor={pointsEnabled ? "#ECEFDA" : "#F1F5F9"}
              onValueChange={handleToggleSwitch}
              value={pointsEnabled}
            />
          </View>

          {/* Regras */}
          <View style={styles.rulesContainer}>
            <Text style={styles.rulesHeader}>Tabela de Pontuação:</Text>
            <View style={styles.ruleItem}>
              <Ionicons name="alert-circle-outline" size={16} color="#D97706" />
              <Text style={styles.ruleText}>Tarefa Urgente: +100 pontos</Text>
            </View>
            <View style={styles.ruleItem}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#16A34A" />
              <Text style={styles.ruleText}>Tarefa Normal: +100 pontos</Text>
            </View>
          </View>

          {/* Botão de Fechar */}
          <View style={styles.modalButtons}>
            <PerfilButton text="concluído" type="confirm" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(38, 50, 56, 0.40)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalBox: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#285A71",
  },
  pointsCard: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FCD34D",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  pointsLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#92400E",
    marginBottom: 4,
  },
  pointsValue: {
    fontSize: 32,
    fontWeight: "800",
    color: "#B45309",
  },
  pointsUnit: {
    fontSize: 14,
    fontWeight: "600",
    color: "#B45309",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  switchTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
  },
  switchSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  rulesContainer: {
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  rulesHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 2,
  },
  ruleItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ruleText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "500",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
});
