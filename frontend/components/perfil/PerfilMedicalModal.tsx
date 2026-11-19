
import React, { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import PerfilButton from "./PerfilButton";
import { authenticatedFetch } from "../../services/api";
import PieChartCard from "../common/PieChartCard";

type Occurrence = {
  pk_id_his_medico: number;
  ocorrencias?: string;
  atestado_func?: string;
  dth_ocorrencia?: string;
  fk_id_func?: number;
};

type EmployeeOption = {
  id: number;
  nome: string;
  status?: string;
};

type PerfilMedicalModalProps = {
  visible: boolean;
  onClose: () => void;
  isAdmin?: boolean;
};

function showAlert(title: string, message: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}: ${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function PerfilMedicalModal({
  visible,
  onClose,
  isAdmin = false,
}: PerfilMedicalModalProps) {
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selectedFuncId, setSelectedFuncId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Formulário de justificativa
  const [justificativa, setJustificativa] = useState("");
  const [atestadoText, setAtestadoText] = useState("");
  const [editingOccurrence, setEditingOccurrence] =
    useState<Occurrence | null>(null);

  const atestadosCount = occurrences.filter(
    (o) => !!o.atestado_func
  ).length;

  const justificativasCount = occurrences.length - atestadosCount;

  const chartData = [
    {
      label: "Com Atestado Médicos",
      value: atestadosCount,
      color: "#16A34A",
    },
    {
      label: "Justificativas de Faltas",
      value: justificativasCount,
      color: "#3B82F6",
    },
  ];

  const fetchOccurrences = async () => {
    try {
      setLoading(true);

      const res = await authenticatedFetch("/occurrences");

      if (res.ok) {
        const body = await res.json();
        const list = Array.isArray(body) ? body : body.data ?? [];

        setOccurrences(list);
      }

      if (isAdmin) {
        const empRes = await authenticatedFetch("/users").catch(() => null);
        if (empRes && empRes.ok) {
          const empBody = await empRes.json().catch(() => ({}));
          const activeList: EmployeeOption[] = (empBody.data ?? []).filter(
            (u: any) => u.status !== "DELETED"
          );
          setEmployees(activeList);
          setSelectedFuncId((prev) => prev ?? (activeList[0]?.id ?? null));
        }
      }
    } catch (err) {
      console.error("Erro ao buscar ocorrências médicas:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchOccurrences();
    }
  }, [visible]);

  const handleSendJustificativa = async () => {
    if (!justificativa.trim() && !atestadoText.trim()) {
      showAlert(
        "Atenção",
        "Preencha o motivo/justificativa ou as informações do atestado."
      );
      return;
    }

    if (isAdmin && !selectedFuncId) {
      showAlert("Atenção", "Selecione o colaborador para vincular o registro.");
      return;
    }

    try {
      setSubmitting(true);

      const payload: Record<string, any> = {
        ocorrencias:
          justificativa.trim() || "Justificativa de ausência",
        atestado_func: atestadoText.trim() || undefined,
      };
      if (isAdmin && selectedFuncId) {
        payload.fk_id_func = selectedFuncId;
      }

      const res = await authenticatedFetch("/occurrences", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || "Erro ao registrar justificativa médica.");
      }

      showAlert(
        "Sucesso",
        "Justificativa/Atestado registrado com sucesso!"
      );

      setJustificativa("");
      setAtestadoText("");
      setEditingOccurrence(null);

      fetchOccurrences();
    } catch (err: any) {
      showAlert("Erro", err.message || "Não foi possível enviar.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateOccurrence = async (
    id: number,
    ocorrencias: string,
    atestado_func?: string
  ) => {
    const res = await authenticatedFetch(`/occurrences/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        ocorrencias,
        atestado_func,
      }),
    });

    if (!res.ok) {
      throw new Error("Não foi possível atualizar o registro.");
    }

    await fetchOccurrences();
  };

  const handleDeleteOccurrence = async (id: number) => {
    const executeDelete = async () => {
      try {
        const res = await authenticatedFetch(`/occurrences/${id}`, {
          method: "DELETE",
        });

        if (!res.ok) {
          throw new Error("Não foi possível excluir o registro.");
        }

        await fetchOccurrences();
      } catch (err: any) {
        const errorMsg = err.message || "Não foi possível excluir o registro.";
        if (Platform.OS === "web") {
          window.alert(`Erro: ${errorMsg}`);
        } else {
          Alert.alert("Erro", errorMsg);
        }
      }
    };

    if (Platform.OS === "web") {
      const confirmed = window.confirm("Tem certeza que deseja excluir este registro médico?");
      if (confirmed) {
        executeDelete();
      }
    } else {
      Alert.alert(
        "Excluir registro",
        "Tem certeza que deseja excluir este registro médico?",
        [
          {
            text: "Cancelar",
            style: "cancel",
          },
          {
            text: "Excluir",
            style: "destructive",
            onPress: executeDelete,
          },
        ]
      );
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
          style={{ width: "100%", justifyContent: "center", alignItems: "center" }}
        >
          <View style={styles.modalBox}>
          {/* Cabeçalho */}
          <View style={styles.modalHeader}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Ionicons
                name="medkit"
                size={20}
                color="#285A71"
              />

              <Text style={styles.modalTitle}>
                Histórico Médico & Ausências
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              disabled={submitting}
            >
              <Ionicons
                name="close-outline"
                size={24}
                color="#263238"
              />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ maxHeight: 440 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Gráfico de Estatísticas de Ausências e Atestados */}
            <PieChartCard
              title="Resumo de Ocorrências Médicas"
              subtitle="Distribuição entre atestados e justificativas salvas"
              data={chartData}
              size={130}
            />

            {/* Lista de Registros */}
            <Text style={styles.sectionLabel}>
              Registros Anteriores
            </Text>

            {loading ? (
              <ActivityIndicator
                color="#285A71"
                style={{ marginVertical: 12 }}
              />
            ) : occurrences.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={28}
                  color="#16A34A"
                />

                <Text style={styles.emptyText}>
                  Nenhuma falta ou ocorrência registrada.
                </Text>
              </View>
            ) : (
              occurrences.map((item) => (
                <View
                  key={item.pk_id_his_medico}
                  style={styles.occurrenceWrapper}
                >
                  <View style={styles.occurrenceCard}>
                    <Ionicons
                      name="document-text-outline"
                      size={20}
                      color="#285A71"
                    />

                    <View style={{ flex: 1 }}>
                      <Text style={styles.occurrenceTitle}>
                        {item.ocorrencias ||
                          "Ausência/Justificativa"}
                      </Text>

                      {item.atestado_func && (
                        <Text style={styles.occurrenceDetail}>
                          Atestado: {item.atestado_func}
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.occurrenceActions}>
                    <PerfilButton
                      text="editar"
                      type="confirm"
                      onPress={() => {
                        setEditingOccurrence(item);
                        setJustificativa(
                          item.ocorrencias || ""
                        );
                        setAtestadoText(
                          item.atestado_func || ""
                        );
                      }}
                    />

                    <PerfilButton
                      text="excluir"
                      type="cancel"
                      onPress={() =>
                        handleDeleteOccurrence(
                          item.pk_id_his_medico
                        )
                      }
                    />
                  </View>
                </View>
              ))
            )}

            {/* Formulário de Envio */}
            <View style={styles.formArea}>
              <Text style={styles.sectionLabel}>
                {editingOccurrence
                  ? "Editar Justificativa ou Atestado"
                  : "Anexar Justificativa ou Atestado"}
              </Text>

              {isAdmin && !editingOccurrence && employees.length > 0 && (
                <View style={{ marginBottom: 10 }}>
                  <Text style={styles.inputLabel}>Colaborador:</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                  >
                    {employees.map((emp) => {
                      const selected = selectedFuncId === emp.id;
                      return (
                        <TouchableOpacity
                          key={emp.id}
                          onPress={() => setSelectedFuncId(emp.id)}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 16,
                            borderWidth: 1,
                            borderColor: selected ? "#285A71" : "#CBD5E1",
                            backgroundColor: selected ? "#285A71" : "#F8FAFC",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: "600",
                              color: selected ? "#FFFFFF" : "#334155",
                            }}
                          >
                            {emp.nome}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              <Text style={styles.inputLabel}>
                Motivo / Justificativa:
              </Text>

              <TextInput
                value={justificativa}
                onChangeText={setJustificativa}
                maxLength={255}
                placeholder="Ex: Consulta médica de rotina / Falta justificada"
                placeholderTextColor="#7A7A7A"
                style={styles.textInput}
              />

              <Text style={styles.inputLabel}>
                Número ou Descrição do Atestado:
              </Text>

              <TextInput
                value={atestadoText}
                onChangeText={setAtestadoText}
                placeholder="Ex: Atestado CRM-12345 (2 dias de repouso)"
                placeholderTextColor="#7A7A7A"
                style={styles.textInput}
              />
            </View>
          </ScrollView>

          {/* Botões do Modal */}
          <View style={styles.modalButtons}>
            {submitting ? (
              <ActivityIndicator color="#285A71" />
            ) : (
              <>
                <PerfilButton
                  text="fechar"
                  type="cancel"
                  onPress={onClose}
                />

                <PerfilButton
                  text={
                    editingOccurrence
                      ? "salvar alteração"
                      : "enviar justificativa"
                  }
                  type="confirm"
                  onPress={async () => {
                    if (editingOccurrence) {
                      try {
                        setSubmitting(true);

                        await handleUpdateOccurrence(
                          editingOccurrence.pk_id_his_medico,
                          justificativa.trim() ||
                            "Justificativa de ausência",
                          atestadoText.trim() || undefined
                        );

                        showAlert(
                          "Sucesso",
                          "Registro atualizado com sucesso!"
                        );

                        setEditingOccurrence(null);
                        setJustificativa("");
                        setAtestadoText("");
                      } catch (err: any) {
                        showAlert(
                          "Erro",
                          err.message ||
                            "Não foi possível atualizar."
                        );
                      } finally {
                        setSubmitting(false);
                      }
                    } else {
                      await handleSendJustificativa();
                    }
                  }}
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
    maxHeight: "85%",
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

  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#285A71",
    marginTop: 8,
    marginBottom: 8,
  },

  emptyState: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F0FDF4",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },

  emptyText: {
    fontSize: 12,
    color: "#166534",
    fontWeight: "500",
  },

  occurrenceWrapper: {
    marginBottom: 8,
  },

  occurrenceCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    padding: 10,
  },

  occurrenceTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1E293B",
  },

  occurrenceDetail: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },

  occurrenceActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },

  formArea: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },

  inputLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 4,
    marginTop: 6,
  },

  textInput: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: "#1E293B",
    backgroundColor: "#F8FAFC",
  },

  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 16,
    gap: 8,
  },
});
