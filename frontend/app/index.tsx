import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Modal, ActivityIndicator, StatusBar, Dimensions, useWindowDimensions, } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, withSpring, Easing,SharedValue, } from "react-native-reanimated";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { login, validateFirstAccess, activateFirstAccess, forgotPassword } from "../services/auth";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const CARD_MAX = 350;

type ModalStep =
  | "none"
  | "firstAccess_credentials"
  | "firstAccess_password"
  | "forgotPassword_email"
  | "forgotPassword_reset"
  | "feedback";

  // Particulas
const particleData = [
  // Top-Left
  { left: 0.03, top: 0.06, size: 8, opacity: 0.7, color: "#5F9F82" },
  { left: 0.08, top: 0.12, size: 5, opacity: 0.5, color: "#9BCB72" },
  { left: 0.12, top: 0.05, size: 10, opacity: 0.6, color: "#78B58D" },
  { left: 0.04, top: 0.18, size: 6, opacity: 0.4, color: "#A8CF83" },
  { left: 0.14, top: 0.15, size: 8, opacity: 0.6, color: "#4F9078" },
  // Bottom-Left
  { left: 0.03, top: 0.82, size: 6, opacity: 0.5, color: "#79B48B" },
  { left: 0.09, top: 0.88, size: 9, opacity: 0.6, color: "#5A9A7F" },
  { left: 0.14, top: 0.78, size: 5, opacity: 0.4, color: "#A8CF83" },
  { left: 0.05, top: 0.94, size: 8, opacity: 0.5, color: "#6AA886" },
  // Top-Right
  { left: 0.86, top: 0.05, size: 6, opacity: 0.4, color: "#78B58D" },
  { left: 0.92, top: 0.10, size: 10, opacity: 0.7, color: "#4F9078" },
  { left: 0.84, top: 0.18, size: 6, opacity: 0.5, color: "#9BCB72" },
  { left: 0.96, top: 0.12, size: 8, opacity: 0.6, color: "#5F9F82" },
  { left: 0.88, top: 0.22, size: 5, opacity: 0.4, color: "#A8CF83" },
  // Bottom-Right
  { left: 0.85, top: 0.80, size: 8, opacity: 0.5, color: "#5A9A7F" },
  { left: 0.91, top: 0.86, size: 5, opacity: 0.4, color: "#A8CF83" },
  { left: 0.96, top: 0.78, size: 9, opacity: 0.6, color: "#6AA886" },
  { left: 0.88, top: 0.92, size: 8, opacity: 0.5, color: "#5F9F82" },
];

// --- COMPONENTES AUXILIARES FORA DO COMPONENTE PRINCIPAL ---

const EyeIcon = ({ visible }: { visible: boolean }) => (
  <View style={eyeStyles.container}>
    <View style={[eyeStyles.outerEye, visible ? eyeStyles.activeBorder : eyeStyles.inactiveBorder]} />
    <View style={[eyeStyles.pupil, visible ? eyeStyles.activePupil : eyeStyles.inactivePupil]} />
    {!visible && <View style={eyeStyles.slash} />}
  </View>
);

const PlainField = ({ label, value, onChangeText, placeholder, keyboardType, autoCapitalize }: any) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={ms.fieldWrapper}>
      <Text style={ms.fieldLabel}>{label}</Text>
      <TextInput
        style={[ms.input, focused && ms.focusedInput]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || ""}
        placeholderTextColor="#bbb"
        keyboardType={keyboardType || "default"}
        autoCapitalize={autoCapitalize ?? "none"}
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </View>
  );
};

const PasswordField = ({ label, value, onChangeText, visible, onToggle, placeholder }: any) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={ms.fieldWrapper}>
      <Text style={ms.fieldLabel}>{label}</Text>
      <View style={[ms.passwordRow, focused && ms.focusedRow]}>
        <TextInput
          style={ms.passwordInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder || "••••••••"}
          placeholderTextColor="#bbb"
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <TouchableOpacity onPress={onToggle} style={ms.eyeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <EyeIcon visible={visible} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const PasswordStrength = ({ password }: { password: string }) => {
  if (!password) return null;
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const colors = ["#e74c3c", "#e74c3c", "#f39c12", "#2ecc71", "#27ae60"];
  const labels = ["", "Muito fraca", "Fraca", "Média", "Forte", "Muito forte"];
  return (
    <View style={{ marginBottom: 12, marginTop: -4 }}>
      <View style={{ flexDirection: "row", gap: 4, marginBottom: 4 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: i < score ? colors[score - 1] : "#e0e0e0",
            }}
          />
        ))}
      </View>
      <Text style={{ fontSize: 11, fontWeight: "600", color: colors[score - 1] || "#ccc" }}>
        {labels[score]}
      </Text>
    </View>
  );
};

// Interação das particulas
const InteractiveParticleItem = ({
  particle,
  touchX,
  touchY,
  isTouched,
}: {
  particle: any;
  touchX: SharedValue<number>;
  touchY: SharedValue<number>;
  isTouched: SharedValue<boolean>;
}) => {
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const posX = particle.left * winWidth;
  const posY = particle.top * winHeight;

  const floatY = useSharedValue(0);

  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    let offsetX = 0;
    let offsetY = 0;

    if (isTouched.value) {
      const dx = posX - touchX.value;
      const dy = posY - touchY.value;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const radius = 140;

      if (dist < radius && dist > 0) {
        const force = ((radius - dist) / radius) * 45;
        offsetX = (dx / dist) * force;
        offsetY = (dy / dist) * force;
      }
    }

    return {
      transform: [
        { translateX: withSpring(offsetX, { damping: 12, stiffness: 90 }) },
        { translateY: withSpring(offsetY + floatY.value, { damping: 12, stiffness: 90 }) },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: posX,
          top: posY,
          width: particle.size,
          height: particle.size,
          borderRadius: particle.size / 2,
          backgroundColor: particle.color,
          opacity: particle.opacity,
        },
        animatedStyle,
      ]}
    />
  );
};

const BackgroundParticles = ({ children }: { children: React.ReactNode }) => {
  const touchX = useSharedValue(0);
  const touchY = useSharedValue(0);
  const isTouched = useSharedValue(false);

  const gesture = Gesture.Pan()
    .manualActivation(false)
    .onStart((e: any) => {
      touchX.value = e.x;
      touchY.value = e.y;
      isTouched.value = true;
    })
    .onUpdate((e: any) => {
      touchX.value = e.x;
      touchY.value = e.y;
    })
    .onEnd(() => {
      isTouched.value = false;
    })
    .onFinalize(() => {
      isTouched.value = false;
    });

  const handleMouseMove = (e: any) => {
    if (Platform.OS === "web") {
      touchX.value = e.nativeEvent.locationX || e.nativeEvent.offsetX;
      touchY.value = e.nativeEvent.locationY || e.nativeEvent.offsetY;
      isTouched.value = true;
    }
  };

  const handleMouseLeave = () => {
    if (Platform.OS === "web") {
      isTouched.value = false;
    }
  };

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={particleStyles.container}
        // @ts-ignore
        onMouseMove={handleMouseMove}
        // @ts-ignore
        onMouseLeave={handleMouseLeave}
      >
        <View style={[particleStyles.glow, particleStyles.glowTopLeft]} pointerEvents="none" />
        <View style={[particleStyles.glow, particleStyles.glowBottomRight]} pointerEvents="none" />

        {particleData.map((p, i) => (
          <InteractiveParticleItem
            key={`p-${i}`}
            particle={p}
            touchX={touchX}
            touchY={touchY}
            isTouched={isTouched}
          />
        ))}

        {children}
      </View>
    </GestureDetector>
  );
};

// --- COMPONENTE PRINCIPAL ---

export default function LoginScreen() {
  const router = useRouter();

  const [loginInput, setLoginInput] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [senhaVisible, setSenhaVisible] = useState(false);

  const [modalStep, setModalStep] = useState<ModalStep>("none");
  const [feedback, setFeedback] = useState<{
    title: string;
    message: string;
    onClose?: () => void;
  } | null>(null);

  const [faCode, setFaCode] = useState("");
  const [faToken, setFaToken] = useState("");
  const [faNovaSenha, setFaNovaSenha] = useState("");
  const [faConfirmaSenha, setFaConfirmaSenha] = useState("");
  const [faLoading, setFaLoading] = useState(false);
  const [faSenhaVisible, setFaSenhaVisible] = useState(false);

  const [fpEmail, setFpEmail] = useState("");
  const [fpCode, setFpCode] = useState("");
  const [fpToken, setFpToken] = useState("");
  const [fpNovaSenha, setFpNovaSenha] = useState("");
  const [fpConfirmaSenha, setFpConfirmaSenha] = useState("");
  const [fpLoading, setFpLoading] = useState(false);
  const [fpSenhaVisible, setFpSenhaVisible] = useState(false);

  const [loginFocused, setLoginFocused] = useState(false);
  const [senhaFocused, setSenhaFocused] = useState(false);

  const validatePassword = (p: string): string | null => {
    if (p.length < 8) return "Mínimo de 8 caracteres";
    if (!/[A-Z]/.test(p)) return "Deve conter uma letra maiúscula";
    if (!/[a-z]/.test(p)) return "Deve conter uma letra minúscula";
    if (!/[0-9]/.test(p)) return "Deve conter um número";
    if (!/[^A-Za-z0-9]/.test(p)) return "Deve conter um caractere especial";
    return null;
  };

  const closeModal = () => {
    setModalStep("none");
    setFeedback(null);
    setFaCode("");
    setFaToken("");
    setFaNovaSenha("");
    setFaConfirmaSenha("");
    setFpEmail("");
    setFpCode("");
    setFpToken("");
    setFpNovaSenha("");
    setFpConfirmaSenha("");
  };

  const showFeedback = (title: string, message: string, onClose?: () => void) => {
    setFeedback({ title, message, onClose });
    setModalStep("feedback");
  };

  const closeFeedback = () => {
    const onClose = feedback?.onClose;
    setFeedback(null);
    setModalStep("none");
    onClose?.();
  };

  const handleLogin = async () => {
    if (!loginInput.trim() || !senha) {
      showFeedback("Atenção", "Preencha o ID e a senha.");
      return;
    }
    setLoading(true);
    try {
      await login(loginInput.trim(), senha);
      router.replace("/dashboard");
    } catch (err: any) {
      if (err.message === "PRIMEIRO_ACESSO_REQUERIDO") {
        setModalStep("firstAccess_credentials");
      } else {
        showFeedback("Erro no login", err.message || "Não foi possível fazer login.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleValidateFirstAccess = async () => {
    if (!faCode.trim() || !faToken.trim()) {
      showFeedback("Atenção", "Preencha o Código de Ativação e o Token.");
      return;
    }
    setFaLoading(true);
    try {
      await validateFirstAccess(faCode.trim().toUpperCase(), faToken.trim().toUpperCase());
      setModalStep("firstAccess_password");
    } catch (err: any) {
      showFeedback("Dados inválidos", err.message || "Código ou token incorreto.");
    } finally {
      setFaLoading(false);
    }
  };

  const handleActivateFirstAccess = async () => {
    const err = validatePassword(faNovaSenha);
    if (err) {
      showFeedback("Senha fraca", err);
      return;
    }
    if (faNovaSenha !== faConfirmaSenha) {
      showFeedback("Atenção", "As senhas não coincidem.");
      return;
    }
    setFaLoading(true);
    try {
      await activateFirstAccess(faCode.trim().toUpperCase(), faToken.trim().toUpperCase(), faNovaSenha);
      closeModal();
      router.replace("/dashboard");
    } catch (err: any) {
      showFeedback("Erro", err.message || "Não foi possível ativar a conta.");
    } finally {
      setFaLoading(false);
    }
  };

  const handleForgotPasswordEmail = async () => {
    if (!fpEmail.trim()) {
      showFeedback("Atenção", "Informe seu e-mail.");
      return;
    }
    setFpLoading(true);
    try {
      await forgotPassword(fpEmail.trim());
      showFeedback("Instruções enviadas", "Verifique seu e-mail.", () =>
        setModalStep("forgotPassword_reset"),
      );
    } catch (err: any) {
      showFeedback("Erro", err.message || "Erro ao solicitar redefinição.");
    } finally {
      setFpLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!fpCode.trim() || !fpToken.trim()) {
      showFeedback("Atenção", "Preencha o código e o token.");
      return;
    }
    const err = validatePassword(fpNovaSenha);
    if (err) {
      showFeedback("Senha fraca", err);
      return;
    }
    if (fpNovaSenha !== fpConfirmaSenha) {
      showFeedback("Atenção", "As senhas não coincidem.");
      return;
    }
    setFpLoading(true);
    try {
      await activateFirstAccess(fpCode.trim().toUpperCase(), fpToken.trim().toUpperCase(), fpNovaSenha);
      closeModal();
      showFeedback("Sucesso", "Senha redefinida! Faça login com a nova senha.");
    } catch (err: any) {
      showFeedback("Erro", err.message || "Não foi possível redefinir a senha.");
    } finally {
      setFpLoading(false);
    }
  };

  const renderModal = () => {
    switch (modalStep) {
      case "feedback":
        return (
          <>
            <Text style={ms.title}>{feedback?.title}</Text>
            <Text style={ms.subtitle}>{feedback?.message}</Text>
            <TouchableOpacity style={ms.primaryBtn} onPress={closeFeedback}>
              <Text style={ms.primaryBtnText}>Entendi</Text>
            </TouchableOpacity>
          </>
        );
      case "firstAccess_credentials":
        return (
          <>
            <Text style={ms.title}>Primeiro acesso</Text>
            <Text style={ms.subtitle}>Digite os dados recebidos por e-mail.</Text>
            <PlainField
              label="Código de Ativação"
              value={faCode}
              onChangeText={(t: string) => setFaCode(t.toUpperCase())}
              placeholder="Ex: TESTE001"
              autoCapitalize="characters"
            />
            <PlainField
              label="Token"
              value={faToken}
              onChangeText={(t: string) => setFaToken(t.toUpperCase())}
              placeholder="Ex: ABCD1234"
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={[ms.primaryBtn, faLoading && ms.disabled]}
              onPress={handleValidateFirstAccess}
              disabled={faLoading}
            >
              {faLoading ? <ActivityIndicator color="#fff" /> : <Text style={ms.primaryBtnText}>Validar</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={ms.cancelBtn} onPress={closeModal}>
              <Text style={ms.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </>
        );
      case "firstAccess_password":
        return (
          <>
            <Text style={ms.title}>Crie sua senha</Text>
            <Text style={ms.subtitle}>Mínimo 8 caracteres, com maiúscula, minúscula, número e símbolo.</Text>
            <PasswordField
              label="Nova senha"
              value={faNovaSenha}
              onChangeText={setFaNovaSenha}
              visible={faSenhaVisible}
              onToggle={() => setFaSenhaVisible((v) => !v)}
            />
            <PasswordStrength password={faNovaSenha} />
            <PasswordField
              label="Confirmar senha"
              value={faConfirmaSenha}
              onChangeText={setFaConfirmaSenha}
              visible={faSenhaVisible}
              onToggle={() => setFaSenhaVisible((v) => !v)}
            />
            <TouchableOpacity
              style={[ms.primaryBtn, faLoading && ms.disabled]}
              onPress={handleActivateFirstAccess}
              disabled={faLoading}
            >
              {faLoading ? <ActivityIndicator color="#fff" /> : <Text style={ms.primaryBtnText}>Salvar</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={ms.cancelBtn} onPress={closeModal}>
              <Text style={ms.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </>
        );
      case "forgotPassword_email":
        return (
          <>
            <Text style={ms.title}>Recuperar senha</Text>
            <Text style={ms.subtitle}>Informe seu e-mail cadastrado.</Text>
            <PlainField
              label="E-mail"
              value={fpEmail}
              onChangeText={setFpEmail}
              placeholder="seu@email.com"
              keyboardType="email-address"
            />
            <TouchableOpacity
              style={[ms.primaryBtn, fpLoading && ms.disabled]}
              onPress={handleForgotPasswordEmail}
              disabled={fpLoading}
            >
              {fpLoading ? <ActivityIndicator color="#fff" /> : <Text style={ms.primaryBtnText}>Enviar instruções</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={ms.cancelBtn} onPress={closeModal}>
              <Text style={ms.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </>
        );
      case "forgotPassword_reset":
        return (
          <>
            <Text style={ms.title}>Redefinir senha</Text>
            <Text style={ms.subtitle}>Insira o código e token recebidos por e-mail.</Text>
            <PlainField
              label="Código de Ativação"
              value={fpCode}
              onChangeText={(t: string) => setFpCode(t.toUpperCase())}
              placeholder="Ex: TESTE001"
              autoCapitalize="characters"
            />
            <PlainField
              label="Token"
              value={fpToken}
              onChangeText={(t: string) => setFpToken(t.toUpperCase())}
              placeholder="Ex: ABCD1234"
              autoCapitalize="characters"
            />
            <PasswordField
              label="Nova senha"
              value={fpNovaSenha}
              onChangeText={setFpNovaSenha}
              visible={fpSenhaVisible}
              onToggle={() => setFpSenhaVisible((v) => !v)}
            />
            <PasswordStrength password={fpNovaSenha} />
            <PasswordField
              label="Confirmar senha"
              value={fpConfirmaSenha}
              onChangeText={setFpConfirmaSenha}
              visible={fpSenhaVisible}
              onToggle={() => setFpSenhaVisible((v) => !v)}
            />
            <TouchableOpacity
              style={[ms.primaryBtn, fpLoading && ms.disabled]}
              onPress={handleResetPassword}
              disabled={fpLoading}
            >
              {fpLoading ? <ActivityIndicator color="#fff" /> : <Text style={ms.primaryBtnText}>Redefinir senha</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={ms.cancelBtn} onPress={closeModal}>
              <Text style={ms.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />
      <BackgroundParticles>
        <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={s.inner}>
              <Text style={s.greeting}>Olá! Seja bem{"\n"}vindo(a) de volta</Text>

              <View style={s.card}>
                <Text style={s.label}>ID</Text>
                <TextInput
                  style={[s.input, loginFocused && s.focusedInput]}
                  value={loginInput}
                  onChangeText={setLoginInput}
                  placeholder="CNPJ, CPF ou e-mail"
                  placeholderTextColor="#b0bec5"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  onFocus={() => setLoginFocused(true)}
                  onBlur={() => setLoginFocused(false)}
                />

                <Text style={[s.label, { marginTop: 18 }]}>Senha</Text>
                <View style={[s.passwordRow, senhaFocused && s.focusedRow]}>
                  <TextInput
                    style={[s.input, { flex: 1, marginBottom: 0, borderWidth: 0, backgroundColor: "transparent" }]}
                    value={senha}
                    onChangeText={setSenha}
                    placeholder="••••••••"
                    placeholderTextColor="#b0bec5"
                    secureTextEntry={!senhaVisible}
                    autoCapitalize="none"
                    onFocus={() => setSenhaFocused(true)}
                    onBlur={() => setSenhaFocused(false)}
                  />
                  <TouchableOpacity
                    onPress={() => setSenhaVisible((v) => !v)}
                    style={s.eyeBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <EyeIcon visible={senhaVisible} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={s.forgotLink} onPress={() => setModalStep("forgotPassword_email")}>
                  <Text style={s.forgotText}>Esqueci minha senha</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.loginBtn, loading && s.disabled]}
                  onPress={handleLogin}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.loginBtnText}>Entrar</Text>}
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.registerCompanyLink}
                  onPress={() => router.push("/cadastroEmpresa")}
                  activeOpacity={0.8}
                >
                  <Text style={s.registerCompanyText}>Cadastrar nova empresa</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ marginTop: 12, alignItems: "center" }}
                  onPress={() => setModalStep("firstAccess_credentials")}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: "#64748B", fontSize: 13, textDecorationLine: "underline" }}>
                    Primeiro acesso? Ative sua conta aqui
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </BackgroundParticles>

      <Modal visible={modalStep !== "none"} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={ms.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ width: "100%", justifyContent: "flex-end" }}
          >
            <View style={ms.sheet}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                style={{ maxHeight: SCREEN_HEIGHT * 0.75 }}
                contentContainerStyle={{ paddingBottom: 24 }}
              >
                {renderModal()}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
}

// --- ESTILOS FORA DAS FUNÇÕES DE COMPONENTE ---

const eyeStyles = StyleSheet.create({
  container: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },
  outerEye: { position: "absolute", width: 18, height: 11, borderRadius: 6, borderWidth: 1.8 },
  activeBorder: { borderColor: "#285A71" },
  inactiveBorder: { borderColor: "#99abb5" },
  pupil: { position: "absolute", width: 6, height: 6, borderRadius: 3 },
  activePupil: { backgroundColor: "#285A71" },
  inactivePupil: { backgroundColor: "#99abb5" },
  slash: {
    position: "absolute",
    width: 20,
    height: 1.8,
    backgroundColor: "#99abb5",
    transform: [{ rotate: "-45deg" }],
  },
});

const particleStyles = StyleSheet.create({
  container: { flex: 1, width: "100%", overflow: "hidden", backgroundColor: "#FEFDF9" },
  glow: { position: "absolute", borderRadius: 999 },
  glowTopLeft: {
    width: 400,
    height: 400,
    top: -200,
    left: -180,
    backgroundColor: "rgba(155, 203, 114, 0.12)",
  },
  glowBottomRight: {
    width: 450,
    height: 450,
    right: -220,
    bottom: -220,
    backgroundColor: "rgba(95, 159, 130, 0.1)",
  },
});

const s = StyleSheet.create({
  root: { flex: 1, width: "100%" },
  scroll: { flexGrow: 1, width: "100%" },
  inner: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 48,
    minHeight: SCREEN_HEIGHT,
  },
  greeting: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0F2B3D",
    marginBottom: 28,
    lineHeight: 32,
    width: "100%",
    maxWidth: CARD_MAX,
    letterSpacing: -0.5,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 28,
    width: "100%",
    maxWidth: CARD_MAX,
    shadowColor: "#0f2b3d",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#f1f3f5",
  },
  label: { fontSize: 13, fontWeight: "600", color: "#546e7a", marginBottom: 7, letterSpacing: 0.1 },
  input: {
    borderWidth: 1,
    borderColor: "#cfd8dc",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: "#0f2b3d",
    backgroundColor: "#fcfdfe",
    marginBottom: 2,
  },
  focusedInput: { borderColor: "#285A71", backgroundColor: "#fff" },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#cfd8dc",
    borderRadius: 12,
    backgroundColor: "#fcfdfe",
    marginBottom: 2,
  },
  focusedRow: { borderColor: "#285A71", backgroundColor: "#fff" },
  eyeBtn: { paddingHorizontal: 14, paddingVertical: 14 },
  forgotLink: { alignSelf: "flex-end", marginTop: 8, marginBottom: 24 },
  forgotText: { fontSize: 13, color: "#285A71", fontWeight: "600" },
  loginBtn: {
    backgroundColor: "#285A71",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#285A71",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  disabled: { opacity: 0.55 },
  loginBtnText: { color: "#fff", fontSize: 15, fontWeight: "700", letterSpacing: 0.2 },
  firstAccessBtn: { backgroundColor: "#ECEFDA", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  firstAccessText: { color: "#285A71", fontSize: 14, fontWeight: "600" },
  registerCompanyLink: { alignItems: "center", marginTop: 14, paddingVertical: 6 },
  registerCompanyText: { color: "#285A71", fontSize: 13, fontWeight: "600" },
});

const ms = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(15, 43, 61, 0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 28,
    maxHeight: "92%",
  },
  title: { fontSize: 22, fontWeight: "700", color: "#0f2b3d", marginBottom: 6 },
  subtitle: { fontSize: 13, color: "#78909c", marginBottom: 22, lineHeight: 18 },
  fieldWrapper: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#546e7a", marginBottom: 7 },
  input: {
    borderWidth: 1,
    borderColor: "#cfd8dc",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: "#0f2b3d",
    backgroundColor: "#fcfdfe",
  },
  focusedInput: { borderColor: "#285A71", backgroundColor: "#fff" },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#cfd8dc",
    borderRadius: 12,
    backgroundColor: "#fcfdfe",
  },
  focusedRow: { borderColor: "#285A71", backgroundColor: "#fff" },
  passwordInput: { flex: 1, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: "#0f2b3d" },
  eyeBtn: { paddingHorizontal: 14, paddingVertical: 14 },
  primaryBtn: { backgroundColor: "#285A71", borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 6 },
  disabled: { opacity: 0.55 },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  cancelBtn: { paddingVertical: 14, alignItems: "center" },
  cancelText: { color: "#90a4ae", fontSize: 14, fontWeight: "600" },
});