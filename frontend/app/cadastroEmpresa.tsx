import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from "react-native";
import React, { useState } from "react";
import { useRouter } from "expo-router";
import { API_URL } from "../services/config";
import FeedbackModal from "../components/common/FeedbackModal";

type InputProps = {
  placeholder: string;
  secureTextEntry?: boolean;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: "default" | "numeric" | "email-address";
  maxLength?: number;
};

function Input({ placeholder, secureTextEntry, value, onChangeText, keyboardType, maxLength }: InputProps) {
  return (
    <TextInput
      placeholder={placeholder}
      secureTextEntry={secureTextEntry}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType || "default"}
      maxLength={maxLength}
      style={styles.input}
    />
  );
}

export default function CadastroEmpresa() {
  const router = useRouter();
  
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [tipo, setTipo] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");

  const formatCnpj = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 14);
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
    if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
    if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
  };

 // Feedback com modal para sucesso, erro, ou informações
  const [feedback, setFeedback] = useState<{
    visible: boolean;
    type: "success" | "error" | "info";
    title: string;
    message: string;
    onCloseAction?: () => void;
  }>({
    visible: false,
    type: "success",
    title: "",
    message: "",
  });

  const handleRegister = async () => {
    const cleanCnpj = cnpj.replace(/\D/g, "");

    if (!nome || !cleanCnpj || !email || !tipo || !senha) {
      // Feedback para caso de campos incompletos
      setFeedback({
        visible: true,
        type: "error",
        title: "Campos Incompletos",
        message: "Por favor, preencha todos os campos do formulário.",
      });
      return;
    }

    if (cleanCnpj.length !== 14) {
      setFeedback({
        visible: true,
        type: "error",
        title: "CNPJ Inválido",
        message: "Informe um CNPJ válido com exatamente 14 dígitos numéricos.",
      });
      return;
    }

    if (senha !== confirmarSenha) {
      setFeedback({
        visible: true,
        type: "error",
        title: "Senhas Divergentes",
        message: "A senha e a confirmação de senha não coincidem.",
      });
      return;
    }

    const minLength = senha.length >= 8;
    const hasUpper = /[A-Z]/.test(senha);
    const hasLower = /[a-z]/.test(senha);
    const hasNumber = /[0-9]/.test(senha);
    const hasSymbol = /[^A-Za-z0-9]/.test(senha);

    if (!minLength || !hasUpper || !hasLower || !hasNumber || !hasSymbol) {
      setFeedback({
        visible: true,
        type: "error",
        title: "Senha Fraca",
        message:
          "A senha deve conter no mínimo 8 caracteres, incluindo letra maiúscula, minúscula, número e caractere especial.",
      });
      return;
    }

    try {
      const response = await fetch(`${API_URL}/company`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome,
          cnpj: cleanCnpj,
          email,
          tipo_empresa: tipo,
          senha_empresa: senha,
        }),
      });

      const rawText = await response.text();
      let data: any = {};
      if (rawText) {
        try {
          data = JSON.parse(rawText);
        } catch {
          data = {
            message: `Resposta inválida do servidor (HTTP ${response.status} em ${API_URL}). Verifique EXPO_PUBLIC_API_URL.`,
          };
        }
      } else if (!response.ok) {
        data = {
          message: `Servidor da API indisponível ou não configurado (HTTP ${response.status} em ${API_URL}).`,
        };
      }

      // Exibe feedback de sucesso se o cadastro for realizado ou de erro caso contrário
      if (response.ok) {
        setFeedback({
          visible: true,
          type: "success",
          title: "Empresa Cadastrada! ",
          message: `A empresa "${nome}" foi registrada com sucesso. Você já pode fazer login.`,
          onCloseAction: () => router.replace("/"),
        });
      } else {
        setFeedback({
          visible: true,
          type: "error",
          title: "Falha no Cadastro",
          message: Array.isArray(data.message) ? data.message.join("\n") : (data.message || "Erro ao efetuar o cadastro da empresa."),
        });
      }
    }
    // Feedback para retornar erro de conexão com Backend 
    catch (error) {
      console.error(error);
      setFeedback({
        visible: true,
        type: "error",
        title: "Erro de Conexão",
        message: "Não foi possível conectar ao servidor backend.",
      });
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Olá! Seja bem vindo(a)!</Text>

      <Input placeholder="Nome da empresa" value={nome} onChangeText={setNome} />
      <Input
        placeholder="CNPJ (00.000.000/0000-00)"
        value={cnpj}
        onChangeText={(text) => setCnpj(formatCnpj(text))}
        keyboardType="numeric"
        maxLength={18}
      />
      <Input
        placeholder="E-mail empresarial"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
      />
      <Input placeholder="Tipo de empresa" value={tipo} onChangeText={setTipo} />
      <Input placeholder="Código da empresa (Senha)" secureTextEntry value={senha} onChangeText={setSenha} />
      <Input placeholder="Confirmar código" secureTextEntry value={confirmarSenha} onChangeText={setConfirmarSenha} />

      <TouchableOpacity style={styles.button} onPress={handleRegister}>
        <Text style={styles.buttonText}>Cadastrar</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => router.replace("/")}
      >
        <Text style={styles.secondaryButtonText}>Voltar</Text>
      </TouchableOpacity>

      <FeedbackModal
        visible={feedback.visible}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        onClose={() => {
          setFeedback((prev) => ({ ...prev, visible: false }));
          if (feedback.onCloseAction) {
            feedback.onCloseAction();
          }
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: "center", padding: 24 },
  title: { textAlign: "center", marginBottom: 20 },
  input: {
    backgroundColor: "#FEFDF9",
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
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
  },
  secondaryButton: {
    backgroundColor: "#ECEFDA",
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  secondaryButtonText: {
    textAlign: "center",
    color: "#285A71",
  },
});
