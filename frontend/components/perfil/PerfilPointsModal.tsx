import React, { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import PerfilButton from "./PerfilButton";
import { getPointsConfig, savePointsConfig, PointsConfig } from "../../services/points";

type PerfilPointsModalProps = {
  visible: boolean;
  onClose: () => void;
  pontos?: number;
  onConfigChange?: (config: PointsConfig) => void;
};

export default function PerfilPointsModal({
  visible,
  onClose,
  pontos = 0,
  onConfigChange,
}: PerfilPointsModalProps) {
  const [pointsEnabled, setPointsEnabled] = useState(true);
  const [metaPontos, setMetaPontos] = useState("500");
  const [pontosNormal, setPontosNormal] = useState("100");
  const [pontosUrgente, setPontosUrgente] = useState("200");

  useEffect(() => {
    if (visible) {
      getPointsConfig().then((cfg) => {
        setPointsEnabled(cfg.enabled);
        setMetaPontos(String(cfg.meta));
        setPontosNormal(String(cfg.pontosNormal));
        setPontosUrgente(String(cfg.pontosUrgente));
      });
    }
  }, [visible]);

  const handleToggleSwitch = (value: boolean) => {
    setPointsEnabled(value);
  };

  const handleSave = async () => {
    const metaNum = parseInt(metaPontos, 10) || 500;
    const normalNum = parseInt(pontosNormal, 10) || 100;
    const urgenteNum = parseInt(pontosUrgente, 10) || 200;

    const newConfig: PointsConfig = {
      enabled: pointsEnabled,
      meta: metaNum,
      pontosNormal: normalNum,
      pontosUrgente: urgenteNum,
    };

    await savePointsConfig(newConfig);
    onConfigChange?.(newConfig);

    const msg = pointsEnabled
      ? `Configurações salvas! Meta: ${metaNum} pontos. Tarefas gerarão pontos normalmente.`
      : "Sistema de pontuação desativado. Os símbolos de pontos serão ocultados das tarefas.";

    if (Platform.OS === "web") {
      window.alert(msg);
    } else {
      Alert.alert("Sistema de Pontuações", msg);
    }

    onClose();
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

          {/* Saldo de Pontos e Meta Atual */}
          <View style={styles.pointsCard}>
            <Text style={styles.pointsLabel}>Saldo Atual da Equipe / Meta</Text>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
              <Text style={styles.pointsValue}>{pontos}</Text>
              <Text style={styles.pointsUnit}>/ {metaPontos} pts</Text>
            </View>
          </View>

          {/* Toggle de Ativação Geral */}
          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.switchTitle}>Ativar Sistema de Pontos</Text>
              <Text style={styles.switchSub}>
                {pointsEnabled
                  ? "Exibe pontos nas tarefas e pontua ao concluir."
                  : "Desativado: oculta pontuação e símbolos de tarefas."}
              </Text>
            </View>
            <Switch
              trackColor={{ false: "#CBD5E1", true: "#285A71" }}
              thumbColor={pointsEnabled ? "#ECEFDA" : "#F1F5F9"}
              onValueChange={handleToggleSwitch}
              value={pointsEnabled}
            />
          </View>

          {/* Configuração de Metas e Valores (Visível para o Administrador) */}
          {pointsEnabled && (
            <View style={styles.configContainer}>
              <Text style={styles.configHeader}>Definição de Pontos pelo Administrador:</Text>

              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Meta de Pontos da Equipe:</Text>
                <TextInput
                  style={styles.textInput}
                  value={metaPontos}
                  onChangeText={setMetaPontos}
                  keyboardType="numeric"
                  placeholder="500"
                />
              </View>

              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Pontos por Tarefa Normal:</Text>
                <TextInput
                  style={styles.textInput}
                  value={pontosNormal}
                  onChangeText={setPontosNormal}
                  keyboardType="numeric"
                  placeholder="100"
                />
              </View>

              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Pontos por Tarefa Urgente:</Text>
                <TextInput
                  style={styles.textInput}
                  value={pontosUrgente}
                  onChangeText={setPontosUrgente}
                  keyboardType="numeric"
                  placeholder="200"
                />
              </View>
            </View>
          )}

          {/* Botão de Fechar e Salvar */}
          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <PerfilButton text="Salvar" type="confirm" onPress={handleSave} />
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
    maxWidth: 440,
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
    padding: 14,
    alignItems: "center",
    marginBottom: 14,
  },
  pointsLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#92400E",
    marginBottom: 4,
  },
  pointsValue: {
    fontSize: 28,
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
    padding: 12,
    marginBottom: 14,
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
  configContainer: {
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    gap: 10,
  },
  configHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 4,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inputLabel: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "600",
    flex: 1,
  },
  textInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12,
    color: "#1E293B",
    width: 75,
    textAlign: "center",
    fontWeight: "700",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  cancelBtnText: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
  },
});
