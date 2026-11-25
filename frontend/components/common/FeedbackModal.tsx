import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Clipboard,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type FeedbackModalProps = {
  visible: boolean;
  type?: "success" | "error" | "info";
  title: string;
  message: string;
  detailsTitle?: string;
  details?: string;
  buttonText?: string;
  onClose: () => void;
};

export default function FeedbackModal({
  visible,
  type = "success",
  title,
  message,
  detailsTitle = "Código de Ativação / Credenciais:",
  details,
  buttonText = "Entendido",
  onClose,
}: FeedbackModalProps) {
  const handleCopyDetails = async () => {
    if (details) {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(details).catch(() => Clipboard.setString(details));
      } else {
        Clipboard.setString(details);
      }
      Alert.alert("Copiado!", "Credenciais copiadas para a área de transferência.");
    }
  };

  const getIconConfig = () => {
    switch (type) {
      case "error":
        return {
          name: "alert-circle" as const,
          color: "#DC2626",
          bg: "#FEE2E2",
        };
      case "info":
        return {
          name: "information-circle" as const,
          color: "#2563EB",
          bg: "#DBEAFE",
        };
      case "success":
      default:
        return {
          name: "checkmark-circle" as const,
          color: "#16A34A",
          bg: "#DCFCE7",
        };
    }
  };

  const iconConfig = getIconConfig();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Ícone Indicador */}
          <View style={[styles.iconBg, { backgroundColor: iconConfig.bg }]}>
            <Ionicons name={iconConfig.name} size={36} color={iconConfig.color} />
          </View>

          {/* Título e Mensagem */}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          {/* Bloco de Detalhes Copiáveis */}
          {details ? (
            <View style={styles.detailsBox}>
              <Text style={styles.detailsTitle}>{detailsTitle}</Text>
              <View style={styles.copyRow}>
                <Text style={styles.detailsContent} selectable numberOfLines={2}>
                  {details}
                </Text>
                <TouchableOpacity style={styles.copyBtn} onPress={handleCopyDetails}>
                  <Ionicons name="copy-outline" size={16} color="#285A71" />
                  <Text style={styles.copyBtnText}>Copiar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {/* Botão de Fechamento */}
          <TouchableOpacity style={styles.actionBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.actionBtnText}>{buttonText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 43, 61, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  container: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowColor: "#0F2B3D",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 6,
  },
  iconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F2B3D",
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    fontSize: 13,
    color: "#475569",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 16,
  },
  detailsBox: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
  },
  detailsTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  copyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  detailsContent: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECEFDA",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#285A71",
  },
  actionBtn: {
    width: "100%",
    backgroundColor: "#285A71",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
