import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Clipboard,
} from "react-native";
import { useRouter } from "expo-router";
import { authenticatedFetch } from "../services/api";
import FeedbackModal from "../components/common/FeedbackModal";

type SectorOption = {
  id: number;
  nome: string;
};

export default function CadastroFuncionario() {
  const router = useRouter();

  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [cargo, setCargo] = useState("");
  const [setorId, setSetorId] = useState("");
  const [sectors, setSectors] = useState<SectorOption[]>([]);
  const [newSectorName, setNewSectorName] = useState("");
  const [creatingSector, setCreatingSector] = useState(false);
  const [roleName, setRoleName] = useState("Funcionário"); // 'Funcionário' ou 'Administrador'
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadSectors = async () => {
      try {
        const res = await authenticatedFetch("/company/sectors");
        if (res.ok) {
          const body = await res.json();
          const list: SectorOption[] = body.data ?? [];
          setSectors(list);
          if (list.length > 0) {
            setSetorId((prev) => prev || String(list[0].id));
          }
        }
      } catch (err) {
        console.error("Erro ao carregar setores:", err);
      }
    };
    loadSectors();
  }, []);

  const handleAddSector = async () => {
    if (!newSectorName.trim() || creatingSector) return;
    try {
      setCreatingSector(true);
      const res = await authenticatedFetch("/company/sectors", {
        method: "POST",
        body: JSON.stringify({ nome: newSectorName.trim() }),
      });
      if (res.ok) {
        const body = await res.json();
        const created: SectorOption = body.data;
        setSectors((prev) => {
          const exists = prev.some((s) => s.id === created.id);
          return exists ? prev : [...prev, created];
        });
        setSetorId(String(created.id));
        setNewSectorName("");
      }
    } catch (err) {
      console.error("Erro ao criar setor:", err);
    } finally {
      setCreatingSector(false);
    }
  };
  // Estado do FeedbackModal
  const [feedback, setFeedback] = useState<{
    visible: boolean;
    type: "success" | "error" | "info";
    title: string;
    message: string;
    details?: string;
  }>({
    visible: false,
    type: "success",
    title: "",
    message: "",
  });

  // Se toods os campos tiveram preenchidos, manda uma modal true 
  const handleRegister = async () => {
    if (!nome.trim() || !cpf.trim() || !email.trim() || !cargo.trim() || !setorId.trim()) {
      setFeedback({
        visible: true,
        type: "error",
        title: "Campos Obrigatórios",
        message: "Por favor, preencha todos os campos obrigatórios (*).",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await authenticatedFetch("/users", {
        method: "POST",
        body: JSON.stringify({
          nome: nome.trim(),
          cpf: cpf.replace(/\D/g, ""),
          email: email.trim(),
          cargo: cargo.trim(),
          setor_id: Number(setorId),
          role_name: roleName,
          permissions: [],
        }),
      });

      const body = await response.json();

      if (response.ok) {
        let codeDetails = undefined;
        if (body._dev_?.code) {
          codeDetails = `Código de Ativação: ${body._dev_.code}`;
        }

        setFeedback({
          visible: true,
          type: "success",
          title: "Cadastro Concluído! ",
          message: `O colaborador "${nome.trim()}" foi registrado com sucesso.`,
          details: codeDetails,
        });

        // Limpar formulário mantendo o setor padrão selecionado
        setNome("");
        setCpf("");
        setEmail("");
        setCargo("");
        setSetorId(sectors[0] ? String(sectors[0].id) : "");
      } else {
        setFeedback({
          visible: true,
          type: "error",
          title: "Falha no Cadastro",
          message: body.message || "Não foi possível cadastrar o funcionário.",
        });
      }
    }
    // Erro de conexão com o backend 
    catch (error) {
      console.error(error);
      setFeedback({
        visible: true,
        type: "error",
        title: "Erro de Conexão",
        message: "Não foi possível conectar ao servidor backend.",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCpf = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  };

  const copyToClipboard = (text: string) => {
    Clipboard.setString(text);
    Alert.alert("Copiado!", "Copiado para a área de transferência.");
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Cadastrar Novo Colaborador</Text>
      <Text style={styles.subtitle}>
        O colaborador receberá um convite por e-mail com as credenciais de primeiro acesso.
      </Text>

      <View style={styles.form}>
        <Text style={styles.label}>Nome Completo *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: João Silva"
          value={nome}
          onChangeText={setNome}
        />

        <Text style={styles.label}>CPF *</Text>
        <TextInput
          style={styles.input}
          placeholder="000.000.000-00"
          keyboardType="numeric"
          maxLength={14}
          value={cpf}
          onChangeText={(text) => setCpf(formatCpf(text))}
        />

        <Text style={styles.label}>E-mail *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: joao@empresa.com"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Cargo *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: Desenvolvedor"
          value={cargo}
          onChangeText={setCargo}
        />

        <Text style={styles.label}>Setor *</Text>
        {sectors.length > 0 ? (
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              {sectors.map((sec) => {
                const selected = setorId === String(sec.id);
                return (
                  <TouchableOpacity
                    key={sec.id}
                    onPress={() => setSetorId(String(sec.id))}
                    style={[
                      styles.roleBtn,
                      { flexGrow: 0, flexShrink: 0, flexBasis: "auto", paddingHorizontal: 16, paddingVertical: 9 },
                      selected && styles.roleBtnActive,
                    ]}
                  >
                    <Text style={[styles.roleText, selected && styles.roleTextActive]}>
                      {sec.nome}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0, paddingVertical: 9 }]}
                placeholder="Novo setor (opcional)"
                value={newSectorName}
                onChangeText={setNewSectorName}
              />
              <TouchableOpacity
                onPress={handleAddSector}
                disabled={creatingSector || !newSectorName.trim()}
                style={[
                  styles.button,
                  { paddingHorizontal: 14, paddingVertical: 10 },
                  (!newSectorName.trim() || creatingSector) && styles.disabled,
                ]}
              >
                <Text style={styles.buttonText}>{creatingSector ? "..." : "+ Criar"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TextInput
            style={styles.input}
            placeholder="ID do Setor (Ex: 1)"
            keyboardType="numeric"
            value={setorId}
            onChangeText={setSetorId}
          />
        )}

        <Text style={styles.label}>Tipo de Perfil *</Text>
        <View style={styles.roleContainer}>
          <TouchableOpacity
            style={[styles.roleBtn, roleName === "Funcionário" && styles.roleBtnActive]}
            onPress={() => setRoleName("Funcionário")}
          >
            <Text style={[styles.roleText, roleName === "Funcionário" && styles.roleTextActive]}>
              Funcionário
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.roleBtn, roleName === "Administrador" && styles.roleBtnActive]}
            onPress={() => setRoleName("Administrador")}
          >
            <Text style={[styles.roleText, roleName === "Administrador" && styles.roleTextActive]}>
              Administrador
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.disabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Cadastrar Colaborador</Text>
          )}
        </TouchableOpacity>
      

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace("/gestaoFuncionarios");
          }
        }}
      >
        <Text style={styles.secondaryButtonText}>Voltar</Text>
      </TouchableOpacity>

</View>
          
      <FeedbackModal
        visible={feedback.visible}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        details={feedback.details}
        onClose={() => setFeedback((prev) => ({ ...prev, visible: false }))}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: "#FEFDF9",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f2b3d",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#78909c",
    lineHeight: 20,
    marginBottom: 24,
  },
  form: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#f1f3f5",
    shadowColor: "#0f2b3d",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#546e7a",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cfd8dc",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#0f2b3d",
    backgroundColor: "#fcfdfe",
    marginBottom: 16,
  },
  roleContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  roleBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#cfd8dc",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  roleBtnActive: {
    borderColor: "#285A71",
    backgroundColor: "#f0f6fa",
  },
  roleText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#78909c",
  },
  roleTextActive: {
    color: "#285A71",
  },
  button: {
    backgroundColor: "#285A71",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  disabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#f7f7f7ff",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    backgroundColor: "#285A71",
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: 20,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#ffffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  credentialsCard: {
    marginTop: 24,
    backgroundColor: "#ffffffff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#d5deb3",
  },
  credentialsTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#285A71",
    marginBottom: 12,
  },
  credRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  credLabel: {
    fontSize: 13,
    color: "#4a5a63",
    fontWeight: "500",
  },
  credValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#285A71",
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e1e9c2",
    overflow: "hidden",
  },
  credentialsHint: {
    fontSize: 11,
    color: "#5c6d77",
    marginTop: 10,
    lineHeight: 16,
  },
});