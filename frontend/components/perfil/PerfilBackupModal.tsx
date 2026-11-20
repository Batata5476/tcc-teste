import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { authenticatedFetch } from "../../services/api";

type BackupItem = {
  filename: string;
  sizeBytes: number;
  sizeFormatted: string;
  createdAt: string;
  formattedDate: string;
};

type PerfilBackupModalProps = {
  visible: boolean;
  onClose: () => void;
};

export default function PerfilBackupModal({
  visible,
  onClose,
}: PerfilBackupModalProps) {
  const router = useRouter();

  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoringFile, setRestoringFile] = useState<string | null>(null);

  // Modais de Diálogo Internos (100% funcionais no PC/Web e no Celular)
  const [confirmRestoreItem, setConfirmRestoreItem] = useState<BackupItem | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState<boolean>(false);
  const [feedbackDialog, setFeedbackDialog] = useState<{
    type: "success" | "error";
    title: string;
    message: string;
  } | null>(null);

  const fetchBackups = async () => {
    try {
      setLoading(true);
      const res = await authenticatedFetch("/backup/list");
      if (res.ok) {
        const json = await res.json();
        setBackups(json.data || []);
      }
    } catch (e: any) {
      console.error("Erro ao listar backups:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchBackups();
      setConfirmRestoreItem(null);
      setRestoreSuccess(false);
      setFeedbackDialog(null);
    }
  }, [visible]);

  const latestBackup = backups.length > 0 ? backups[0] : null;

  const handleCreateBackup = async () => {
    try {
      setCreating(true);
      const res = await authenticatedFetch("/backup/create", {
        method: "POST",
      });

      const json = await res.json();

      if (res.ok) {
        setFeedbackDialog({
          type: "success",
          title: "Backup Concluído",
          message: `Cópia de segurança gerada com sucesso!\n\nData: ${json.data.formattedDate}\nTamanho: ${json.data.sizeFormatted}`,
        });
        await fetchBackups();
      } else {
        setFeedbackDialog({
          type: "error",
          title: "Falha no Backup",
          message: json.message || "Não foi possível gerar a cópia de segurança.",
        });
      }
    } catch (e: any) {
      setFeedbackDialog({
        type: "error",
        title: "Erro de Conexão",
        message: e.message || "Não foi possível conectar ao servidor.",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleConfirmRestore = (item: BackupItem) => {
    setConfirmRestoreItem(item);
  };

  const executeRestore = async (filename: string) => {
    try {
      setRestoringFile(filename);
      const res = await authenticatedFetch("/backup/restore", {
        method: "POST",
        body: JSON.stringify({ filename }),
      });

      const json = await res.json();

      if (res.ok) {
        setConfirmRestoreItem(null);
        setRestoreSuccess(true);
        await fetchBackups();
      } else {
        setConfirmRestoreItem(null);
        setFeedbackDialog({
          type: "error",
          title: "Falha na Restauração",
          message: json.message || "Erro ao restaurar o backup.",
        });
      }
    } catch (e: any) {
      setConfirmRestoreItem(null);
      setFeedbackDialog({
        type: "error",
        title: "Erro de Conexão",
        message: e.message || "Falha na comunicação com o servidor durante a restauração.",
      });
    } finally {
      setRestoringFile(null);
    }
  };

  const handleRestartSystem = () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.href = "/";
      window.location.reload();
    } else {
      onClose();
      router.replace("/");
    }
  };

  const isBusy = creating || !!restoringFile;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="server-outline" size={20} color="#285A71" />
              </View>
              <View>
                <Text style={styles.modalTitle}>Backup da Empresa</Text>
                <Text style={styles.modalSubtitle}>
                  Cópias de segurança e restauração
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              disabled={isBusy}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            {/* Card Último Backup */}
            <View style={styles.lastBackupCard}>
              <View style={styles.lastBackupHeader}>
                <View style={styles.cloudBadge}>
                  <Ionicons
                    name={latestBackup ? "cloud-done" : "cloud-outline"}
                    size={28}
                    color="#285A71"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lastBackupLabel}>Último Backup</Text>
                  <Text style={styles.lastBackupTime}>
                    {latestBackup ? latestBackup.formattedDate : "Nenhum backup encontrado"}
                  </Text>
                  {latestBackup && (
                    <Text style={styles.lastBackupMeta}>
                      Tamanho: {latestBackup.sizeFormatted}
                    </Text>
                  )}
                </View>
              </View>

              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: latestBackup ? "#ECFDF5" : "#FFFBEB" },
                ]}
              >
                <Ionicons
                  name={
                    latestBackup
                      ? "checkmark-circle"
                      : "alert-circle-outline"
                  }
                  size={15}
                  color={latestBackup ? "#059669" : "#D97706"}
                />
                <Text
                  style={[
                    styles.statusPillText,
                    { color: latestBackup ? "#059669" : "#D97706" },
                  ]}
                >
                  {latestBackup
                    ? "Cópia disponível para restauração"
                    : "Nenhum backup registrado"}
                </Text>
              </View>
            </View>

            {/* Ações Principais */}
            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity
                style={[styles.primaryActionBtn, creating && styles.btnDisabled]}
                onPress={handleCreateBackup}
                disabled={isBusy}
                activeOpacity={0.8}
              >
                {creating ? (
                  <View style={styles.btnLoadingRow}>
                    <ActivityIndicator color="#FFFFFF" size="small" />
                    <Text style={styles.primaryActionText}>
                      Gerando backup...
                    </Text>
                  </View>
                ) : (
                  <View style={styles.btnRow}>
                    <Ionicons name="cloud-upload" size={18} color="#FFFFFF" />
                    <Text style={styles.primaryActionText}>Fazer Backup Agora</Text>
                  </View>
                )}
              </TouchableOpacity>

              {latestBackup && (
                <TouchableOpacity
                  style={[
                    styles.restoreLatestBtn,
                    restoringFile === latestBackup.filename && styles.btnDisabled,
                  ]}
                  onPress={() => handleConfirmRestore(latestBackup)}
                  disabled={isBusy}
                  activeOpacity={0.8}
                >
                  {restoringFile === latestBackup.filename ? (
                    <View style={styles.btnLoadingRow}>
                      <ActivityIndicator color="#DC2626" size="small" />
                      <Text style={styles.restoreLatestText}>
                        Restaurando banco...
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.btnRow}>
                      <Ionicons name="arrow-undo" size={18} color="#DC2626" />
                      <Text style={styles.restoreLatestText}>
                        Restaurar Último Backup
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Histórico de backups */}
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>
                Histórico de Backups
              </Text>
              <TouchableOpacity onPress={fetchBackups} disabled={loading || isBusy}>
                <Ionicons name="refresh" size={17} color="#285A71" />
              </TouchableOpacity>
            </View>

            {loading ? (
              <ActivityIndicator
                size="small"
                color="#285A71"
                style={{ marginVertical: 16 }}
              />
            ) : backups.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="folder-open-outline" size={32} color="#94A3B8" />
                <Text style={styles.emptyText}>
                  Nenhum backup disponível.
                </Text>
              </View>
            ) : (
              backups.map((item, index) => {
                const isRestoringThis = restoringFile === item.filename;
                const isLatest = index === 0;

                return (
                  <View key={item.filename} style={styles.historyCard}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Ionicons
                          name="time-outline"
                          size={15}
                          color="#285A71"
                        />
                        <Text style={styles.historyCardDate}>
                          {item.formattedDate}
                        </Text>
                        {isLatest && (
                          <View style={styles.latestTag}>
                            <Text style={styles.latestTagText}>Mais Recente</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.historyCardSize}>
                        {item.sizeFormatted} • {item.filename}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.historyRestoreBtn,
                        isRestoringThis && styles.btnDisabled,
                      ]}
                      onPress={() => handleConfirmRestore(item)}
                      disabled={isBusy}
                      activeOpacity={0.7}
                    >
                      {isRestoringThis ? (
                        <ActivityIndicator size="small" color="#285A71" />
                      ) : (
                        <Text style={styles.historyRestoreBtnText}>
                          Restaurar
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Botão Fechar */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            disabled={isBusy}
            activeOpacity={0.7}
          >
            <Text style={styles.closeBtnText}>Fechar</Text>
          </TouchableOpacity>

          {/* Diálogo de Confirmação de Restauração (Web e Mobile) */}
          {confirmRestoreItem && (
            <View style={styles.alertOverlay}>
              <View style={styles.alertCard}>
                <View style={[styles.alertIconCircle, { backgroundColor: "#FEE2E2" }]}>
                  <Ionicons name="warning" size={32} color="#DC2626" />
                </View>
                <Text style={styles.alertTitle}>Restaurar Backup?</Text>
                <Text style={styles.alertSubtitle}>
                  O banco de dados será restaurado com os dados da cópia selecionada:
                </Text>

                <View style={styles.backupMetaBox}>
                  <Text style={styles.backupMetaBoxDate}>
                    📅 {confirmRestoreItem.formattedDate}
                  </Text>
                  <Text style={styles.backupMetaBoxSize}>
                    💾 {confirmRestoreItem.sizeFormatted} • {confirmRestoreItem.filename}
                  </Text>
                </View>

                <Text style={styles.alertWarningText}>
                  ⚠️ Todos os dados atuais serão substituídos pelo conteúdo deste backup.
                </Text>

                <View style={styles.alertBtnRow}>
                  <TouchableOpacity
                    style={styles.alertCancelBtn}
                    onPress={() => setConfirmRestoreItem(null)}
                    disabled={!!restoringFile}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.alertCancelBtnText}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.alertDestructiveBtn, !!restoringFile && styles.btnDisabled]}
                    onPress={() => executeRestore(confirmRestoreItem.filename)}
                    disabled={!!restoringFile}
                    activeOpacity={0.8}
                  >
                    {restoringFile ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.alertDestructiveBtnText}>Restaurar</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Diálogo de Restauração Concluída com Botão para Reiniciar o Sistema */}
          {restoreSuccess && (
            <View style={styles.alertOverlay}>
              <View style={styles.alertCard}>
                <View style={[styles.alertIconCircle, { backgroundColor: "#DCFCE7" }]}>
                  <Ionicons name="checkmark-circle" size={36} color="#16A34A" />
                </View>
                <Text style={styles.alertTitle}>Restauração Concluída!</Text>
                <Text style={styles.alertSubtitle}>
                  O banco de dados foi recuperado com sucesso. Para recarregar todas as tabelas, permissões e sessões de usuários, reinicie o sistema agora.
                </Text>

                <TouchableOpacity
                  style={styles.restartBtn}
                  onPress={handleRestartSystem}
                  activeOpacity={0.85}
                >
                  <Ionicons name="refresh" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.restartBtnText}>Reiniciar Sistema Agora</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Diálogo de Feedback Geral (Backup Concluído / Erro) */}
          {feedbackDialog && (
            <View style={styles.alertOverlay}>
              <View style={styles.alertCard}>
                <View
                  style={[
                    styles.alertIconCircle,
                    {
                      backgroundColor:
                        feedbackDialog.type === "success" ? "#DCFCE7" : "#FEE2E2",
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      feedbackDialog.type === "success"
                        ? "checkmark-circle"
                        : "alert-circle"
                    }
                    size={36}
                    color={feedbackDialog.type === "success" ? "#16A34A" : "#DC2626"}
                  />
                </View>
                <Text style={styles.alertTitle}>{feedbackDialog.title}</Text>
                <Text style={styles.alertSubtitle}>{feedbackDialog.message}</Text>

                <TouchableOpacity
                  style={[
                    styles.restartBtn,
                    {
                      backgroundColor:
                        feedbackDialog.type === "success" ? "#285A71" : "#475569",
                    },
                  ]}
                  onPress={() => setFeedbackDialog(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.restartBtnText}>Entendi</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  modalBox: {
    width: "100%",
    maxWidth: 500,
    maxHeight: "90%",
    backgroundColor: "#FEFDF9",
    borderRadius: 22,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 10,
    position: "relative",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#E2EDF3",
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F2B3D",
  },
  modalSubtitle: {
    fontSize: 12,
    color: "#64748B",
  },
  lastBackupCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    marginBottom: 16,
  },
  lastBackupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  cloudBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E2EDF3",
    justifyContent: "center",
    alignItems: "center",
  },
  lastBackupLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  lastBackupTime: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F2B3D",
    marginTop: 2,
  },
  lastBackupMeta: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "600",
  },
  actionButtonsContainer: {
    gap: 8,
    marginBottom: 18,
  },
  primaryActionBtn: {
    backgroundColor: "#285A71",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  restoreLatestBtn: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  restoreLatestText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "700",
  },
  btnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  btnLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  historyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  historyCardDate: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1E293B",
  },
  latestTag: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  latestTagText: {
    color: "#15803D",
    fontSize: 10,
    fontWeight: "700",
  },
  historyCardSize: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  historyRestoreBtn: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  historyRestoreBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#285A71",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 18,
    gap: 6,
  },
  emptyText: {
    fontSize: 12,
    color: "#94A3B8",
  },
  closeBtn: {
    marginTop: 12,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
  },
  closeBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  alertOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    zIndex: 999,
  },
  alertCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  alertIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F2B3D",
    textAlign: "center",
    marginBottom: 8,
  },
  alertSubtitle: {
    fontSize: 13,
    color: "#475569",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 12,
  },
  backupMetaBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    width: "100%",
    marginBottom: 10,
    gap: 4,
  },
  backupMetaBoxDate: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
  },
  backupMetaBoxSize: {
    fontSize: 11,
    color: "#64748B",
  },
  alertWarningText: {
    fontSize: 11,
    color: "#DC2626",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 18,
    lineHeight: 16,
  },
  alertBtnRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  alertCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
  },
  alertCancelBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  alertDestructiveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#DC2626",
    alignItems: "center",
  },
  alertDestructiveBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  restartBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#16A34A",
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 20,
    width: "100%",
    marginTop: 8,
  },
  restartBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
