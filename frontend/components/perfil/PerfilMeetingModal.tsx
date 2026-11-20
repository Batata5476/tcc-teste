import React, { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import PerfilButton from "./PerfilButton";
import { authenticatedFetch } from "../../services/api";
import { getUserType } from "../../services/auth";
import CalendarDatePicker from "../common/CalendarDatePicker";
import TimePickerInput from "../common/TimePickerInput";

type PerfilMeetingModalProps = {
  visible: boolean;
  onClose: () => void;
  subject: string;
  setSubject: (subject: string) => void;
  onSuccess?: () => void;
};

export default function PerfilMeetingModal({
  visible,
  onClose,
  subject,
  setSubject,
  onSuccess,
}: PerfilMeetingModalProps) {
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [time, setTime] = useState("14:00");
  const [meetingLink, setMeetingLink] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<number[]>([]);
  const [userTypeState, setUserTypeState] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (visible) {
      setFeedbackMsg(null);
      (async () => {
        const type = await getUserType();
        setUserTypeState(type);

        try {
          const res = await authenticatedFetch("/users");
          if (res.ok) {
            const body = await res.json();
            setEmployees(body.data ?? []);
          }
        } catch {
          // fallback silencioso se não conseguir carregar usuários
        }
      })();
    }
  }, [visible]);

  const handleConfirm = async () => {
    setFeedbackMsg(null);

    if (!subject.trim()) {
      setFeedbackMsg({ type: "error", text: "Por favor, informe o assunto da reunião." });
      Alert.alert("Reunião não realizada ⚠️", "Por favor, informe o assunto da reunião.");
      return;
    }

    if (userTypeState === "company" && selectedParticipantIds.length === 0) {
      setFeedbackMsg({ type: "error", text: "Por favor, selecione ao menos um participante convidado." });
      Alert.alert("Reunião não realizada ⚠️", "Por favor, selecione ao menos um participante convidado.");
      return;
    }

    try {
      setSubmitting(true);
      const isCompany = userTypeState === "company";
      const endpoint = isCompany ? "/meetings" : "/meetings/request";
      const trimmedLink = meetingLink.trim();

      const res = await authenticatedFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({
          data_reuniao: date,
          horario_reuniao: time,
          assunto_reuniao: subject.trim(),
          link_reuniao: trimmedLink
            ? /^https?:\/\//i.test(trimmedLink)
              ? trimmedLink
              : `https://${trimmedLink}`
            : undefined,
          tipo_reuniao: "empresarial",
          participants: selectedParticipantIds,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "Erro ao agendar reunião.");
      }

      const successText = isCompany
        ? "Reunião agendada com sucesso! Participantes notificados."
        : "Sua solicitação de reunião foi enviada à administração!";

      setFeedbackMsg({ type: "success", text: successText });
      Alert.alert("Reunião marcada com sucesso 🎉", successText);

      setTimeout(() => {
        setSubject("");
        setMeetingLink("");
        setSelectedParticipantIds([]);
        setFeedbackMsg(null);
        onClose();
        if (onSuccess) onSuccess();
      }, 1200);
    } catch (err: any) {
      const errorText = err.message || "Não foi possível registrar a reunião no sistema.";
      setFeedbackMsg({ type: "error", text: errorText });
      Alert.alert("Reunião não realizada ⚠️", errorText);
    } finally {
      setSubmitting(false);
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
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ width: "100%", alignItems: "center" }}
        >
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {userTypeState === "company" ? "Agendar Reunião" : "Solicitar Reunião"}
              </Text>

              <TouchableOpacity onPress={onClose} disabled={submitting}>
                <Ionicons
                  name="close-outline"
                  size={23}
                  color="#263238"
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 460 }}
              contentContainerStyle={{ paddingBottom: 10 }}
            >
              {/* Calendário Interativo */}
              <CalendarDatePicker
                value={date}
                onChange={setDate}
                label="data da reunião"
              />

              {/* Seletor Numérico de Horário */}
              <TimePickerInput
                value={time}
                onChange={setTime}
                label="horário"
              />

              <View style={styles.subjectArea}>
                <View style={styles.subjectTitleRow}>
                  <Ionicons name="link-outline" size={20} color="#263238" />
                  <Text style={styles.optionTitle}>link da reunião (opcional)</Text>
                </View>
                <TextInput
                  value={meetingLink}
                  onChangeText={setMeetingLink}
                  placeholder="https://meet.google.com/..."
                  placeholderTextColor="#7A7A7A"
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.subjectInput, { height: 44, textAlignVertical: "center" }]}
                />
              </View>

              <View style={styles.subjectArea}>
                <View style={styles.subjectTitleRow}>
                  <Ionicons
                    name="chatbox-outline"
                    size={20}
                    color="#263238"
                  />
                  <Text style={styles.optionTitle}>assunto da reunião</Text>
                </View>

                <TextInput
                  value={subject}
                  onChangeText={setSubject}
                  placeholder="Digite o assunto..."
                  placeholderTextColor="#7A7A7A"
                  multiline
                  style={styles.subjectInput}
                />
              </View>

              {employees.length > 0 && (
                <View style={{ marginTop: 12 }}>
                  <Text style={[styles.optionTitle, { marginBottom: 6 }]}>
                    participantes / colaboradores
                  </Text>

                  <ScrollView style={{ maxHeight: 110, borderWidth: 1, borderColor: "#D8D3D8", borderRadius: 6, padding: 4 }} nestedScrollEnabled>
                    {employees.map((emp) => {
                      const sel = selectedParticipantIds.includes(emp.id);
                      return (
                        <TouchableOpacity
                          key={emp.id}
                          style={[
                            styles.empRow,
                            sel && styles.empRowActive,
                          ]}
                          onPress={() => {
                            if (sel) {
                              setSelectedParticipantIds((prev) => prev.filter((id) => id !== emp.id));
                            } else {
                              setSelectedParticipantIds((prev) => [...prev, emp.id]);
                            }
                          }}
                        >
                          <Text style={[styles.empText, sel && styles.empTextActive]}>
                            {emp.nome}
                          </Text>
                          {sel && <Ionicons name="checkmark" size={14} color="#285A71" />}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {feedbackMsg && (
                <View
                  style={[
                    styles.feedbackBox,
                    feedbackMsg.type === "success"
                      ? styles.feedbackSuccess
                      : styles.feedbackError,
                  ]}
                >
                  <Ionicons
                    name={
                      feedbackMsg.type === "success"
                        ? "checkmark-circle"
                        : "alert-circle"
                    }
                    size={18}
                    color={feedbackMsg.type === "success" ? "#16A34A" : "#DC2626"}
                  />
                  <Text
                    style={[
                      styles.feedbackText,
                      feedbackMsg.type === "success"
                        ? styles.feedbackTextSuccess
                        : styles.feedbackTextError,
                    ]}
                  >
                    {feedbackMsg.text}
                  </Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalButtons}>
              {submitting ? (
                <ActivityIndicator color="#285A71" />
              ) : (
                <>
                  <PerfilButton text="cancelar" type="cancel" onPress={onClose} />
                  <PerfilButton
                    text="confirmar reunião"
                    type="confirm"
                    onPress={handleConfirm}
                  />
                </>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  feedbackBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  feedbackSuccess: {
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  feedbackError: {
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  feedbackText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
  },
  feedbackTextSuccess: {
    color: "#15803D",
  },
  feedbackTextError: {
    color: "#B91C1C",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(38, 50, 56, 0.30)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 22,
  },

  modalBox: {
    width: "100%",
    backgroundColor: "#FFFDFD",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  modalTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#263238",
  },

  meetingOption: {
    minHeight: 46,
    borderBottomWidth: 1,
    borderBottomColor: "#D8D3D8",
    flexDirection: "row",
    alignItems: "center",
  },

  optionIcon: {
    width: 34,
    justifyContent: "center",
  },

  optionTitle: {
    flex: 1,
    fontSize: 11,
    color: "#263238",
    fontWeight: "600",
  },

  optionInput: {
    fontSize: 11,
    color: "#263238",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "#D8D3D8",
    borderRadius: 4,
    minWidth: 90,
    textAlign: "center",
  },

  subjectArea: {
    marginTop: 13,
  },

  subjectTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },

  subjectInput: {
    height: 55,
    borderWidth: 1,
    borderColor: "#CEC8CE",
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 11,
    color: "#263238",
    textAlignVertical: "top",
    backgroundColor: "#F5F5F5",
  },

  empRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 2,
  },

  empRowActive: {
    backgroundColor: "#E2E8F0",
  },

  empText: {
    fontSize: 11,
    color: "#475569",
  },

  empTextActive: {
    fontWeight: "700",
    color: "#285A71",
  },

  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 17,
    gap: 7,
  },
});