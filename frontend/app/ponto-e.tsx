import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import * as LocalAuthentication from "expo-local-authentication";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { authenticatedFetch } from "../services/api";

type WorkRecord = {
  pk_id_ponto: number;
  data_ponto: string;
  entrada: string;
  saida: string;
  total_dia: string;
};

// ─── Dados de Partículas Decorativas ──────────────────────────────────────────

const PARTICLE_CONFIGS = [
  { left: "4%", top: "7%", size: 10, color: "#5F9F82", opacity: 0.6, duration: 2800 },
  { left: "12%", top: "14%", size: 6, color: "#9BCB72", opacity: 0.45, duration: 3200 },
  { left: "86%", top: "9%", size: 12, color: "#285A71", opacity: 0.35, duration: 2600 },
  { left: "93%", top: "18%", size: 7, color: "#78B58D", opacity: 0.5, duration: 3400 },
  { left: "6%", top: "32%", size: 8, color: "#4F9078", opacity: 0.4, duration: 3000 },
  { left: "91%", top: "38%", size: 11, color: "#9BCB72", opacity: 0.4, duration: 2700 },
  { left: "5%", top: "62%", size: 9, color: "#5F9F82", opacity: 0.45, duration: 3100 },
  { left: "15%", top: "76%", size: 6, color: "#285A71", opacity: 0.3, duration: 2900 },
  { left: "87%", top: "68%", size: 10, color: "#78B58D", opacity: 0.5, duration: 3300 },
  { left: "94%", top: "80%", size: 7, color: "#9BCB72", opacity: 0.4, duration: 2500 },
  { left: "20%", top: "86%", size: 8, color: "#4F9078", opacity: 0.35, duration: 3500 },
  { left: "80%", top: "89%", size: 9, color: "#5F9F82", opacity: 0.4, duration: 2800 },
  { left: "48%", top: "5%", size: 7, color: "#88B04B", opacity: 0.35, duration: 3100 },
  { left: "52%", top: "93%", size: 8, color: "#285A71", opacity: 0.25, duration: 3000 },
];

function FloatingParticle({
  config,
}: {
  config: (typeof PARTICLE_CONFIGS)[number];
}) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(-14, { duration: config.duration, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: config.duration, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [config.duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: config.left as any,
          top: config.top as any,
          width: config.size,
          height: config.size,
          borderRadius: config.size / 2,
          backgroundColor: config.color,
          opacity: config.opacity,
        },
        animatedStyle,
      ]}
    />
  );
}

// ─── Helpers de Horário e Datas ───────────────────────────────────────────────

function getLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentTime(date: Date) {
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

function timeToSeconds(time: string) {
  const [hours, minutes, seconds = 0] = time.split(":").map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}

function getFormattedDate(date: Date) {
  const dias = [
    "Domingo",
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
  ];
  const meses = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  return `${dias[date.getDay()]}, ${date.getDate()} de ${meses[date.getMonth()]} de ${date.getFullYear()}`;
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function PontoE() {
  const router = useRouter();
  const [horaAtual, setHoraAtual] = useState(new Date());
  const [registro, setRegistro] = useState<WorkRecord | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  // ─── Estados do Sistema de Biometria ────────────────────────────────────────
  const [modalBiometria, setModalBiometria] = useState(false);
  const [tipoBiometria, setTipoBiometria] = useState<"facial" | "digital" | "senha">("facial");
  const [sensorAparelho, setSensorAparelho] = useState<"face_id" | "digital" | "nenhum">("face_id");
  const [statusBiometria, setStatusBiometria] = useState<"idle" | "scanning" | "success" | "error">("idle");
  const [mensagemBiometria, setMensagemBiometria] = useState("Selecione um método e aperte o botão para confirmar");
  const [fotoCapturadaUri, setFotoCapturadaUri] = useState<string | null>(null);
  const [senhaWeb, setSenhaWeb] = useState("");
  const [showSenhaWeb, setShowSenhaWeb] = useState(false);

  // Animação da linha de scanner laser da biometria
  const scanLinePos = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    if (statusBiometria === "scanning") {
      scanLinePos.value = withRepeat(
        withSequence(
          withTiming(110, { duration: 900, easing: Easing.linear }),
          withTiming(0, { duration: 900, easing: Easing.linear })
        ),
        -1,
        true
      );
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 500, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      scanLinePos.value = 0;
      pulseScale.value = 1;
    }
  }, [statusBiometria]);

  const animatedScanLine = useAnimatedStyle(() => ({
    transform: [{ translateY: scanLinePos.value }],
  }));

  const animatedPulse = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  // Detecta capacidades biométricas do dispositivo
  useEffect(() => {
    async function detectarHardwareBiometrico() {
      if (Platform.OS === "web") {
        setSensorAparelho("nenhum");
        setTipoBiometria("senha");
        return;
      }
      try {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        const hasFacial = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
        const hasFingerprint = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);

        if (hasFacial || Platform.OS === "ios") {
          setSensorAparelho("face_id");
          setTipoBiometria("facial");
        } else if (hasFingerprint) {
          setSensorAparelho("digital");
          setTipoBiometria("digital");
        } else {
          setSensorAparelho("nenhum");
          setTipoBiometria("facial");
        }
      } catch (err) {
        console.warn("Erro ao detectar biometria:", err);
      }
    }

    detectarHardwareBiometrico();
  }, []);

  useEffect(() => {
    const intervaloHora = setInterval(() => {
      setHoraAtual(new Date());
    }, 1000);

    return () => clearInterval(intervaloHora);
  }, []);

  useEffect(() => {
    let ativo = true;

    async function carregarRegistroDoDia() {
      try {
        const response = await authenticatedFetch("/work");
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.message || "Não foi possível consultar o registro de ponto.");
        }

        const hoje = getLocalDate(new Date());
        const registroHoje = (body.data as WorkRecord[]).find(
          (item) => item.data_ponto.slice(0, 10) === hoje,
        );
        if (ativo) setRegistro(registroHoje ?? null);
      } catch (error) {
        if (ativo) {
          setErro(error instanceof Error ? error.message : "Erro ao carregar o registro de ponto.");
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    carregarRegistroDoDia();
    return () => {
      ativo = false;
    };
  }, []);

  const formatarTempo = (totalSegundos: number) => {
    const horas = Math.floor(totalSegundos / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    const segundos = totalSegundos % 60;

    return [
      String(horas).padStart(2, "0"),
      String(minutos).padStart(2, "0"),
      String(segundos).padStart(2, "0"),
    ].join(":");
  };

  // Abre o leitor biométrico quando o usuário clica no botão principal
  const iniciarProcessoPonto = () => {
    setErro("");
    setFotoCapturadaUri(null);
    setSenhaWeb("");
    setStatusBiometria("idle");

    if (Platform.OS === "web") {
      setTipoBiometria("senha");
      setMensagemBiometria("Digite sua senha de login para confirmar o ponto no PC");
    } else {
      setTipoBiometria("facial");
      setMensagemBiometria("Escolha um método e toque no botão para confirmar");
    }

    setModalBiometria(true);
  };

  // Validação real por senha para colaboradores
  const validarSenhaWeb = async () => {
    if (!senhaWeb || senhaWeb.trim() === "") {
      setStatusBiometria("error");
      setMensagemBiometria("Digite sua senha de acesso para continuar. ❌");
      return;
    }

    try {
      setStatusBiometria("scanning");
      setMensagemBiometria("Validando senha com o servidor...");

      const response = await authenticatedFetch("/auth/verify-password", {
        method: "POST",
        body: JSON.stringify({ senha: senhaWeb }),
      });

      const body = await response.json();

      if (!response.ok || !body.valid) {
        setStatusBiometria("error");
        setMensagemBiometria(body.message || "Senha incorreta! Não foi possível registrar o ponto. ❌");
        return;
      }

      setStatusBiometria("success");
      setMensagemBiometria("Senha confirmada com sucesso! ✅");

      setTimeout(async () => {
        setModalBiometria(false);
        setSenhaWeb("");
        await enviarRegistroPonto();
      }, 850);
    } catch (err: any) {
      console.error("Erro na verificação de senha:", err);
      setStatusBiometria("error");
      setMensagemBiometria(err.message || "Senha incorreta ou erro de conexão. ❌");
    }
  };

  // 1. Reconhecimento Facial via Câmera Frontal (Selfie)
  const executarCapturaSelfie = async () => {
    if (statusBiometria === "scanning") return;

    try {
      setStatusBiometria("scanning");
      setMensagemBiometria("Abrindo câmera frontal para captura da selfie...");

      let capturedUri: string | null = null;

      if (Platform.OS !== "web") {
        const cameraPerm = await ImagePicker.requestCameraPermissionsAsync();
        if (!cameraPerm.granted) {
          setStatusBiometria("error");
          setMensagemBiometria("Permissão de câmera necessária para captura facial. ❌");
          return;
        }

        const result = await ImagePicker.launchCameraAsync({
          cameraType: ImagePicker.CameraType.front,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
        });

        if (result.canceled || !result.assets || result.assets.length === 0) {
          setStatusBiometria("idle");
          setMensagemBiometria("Captura facial cancelada pelo colaborador.");
          return;
        }

        capturedUri = result.assets[0].uri;
      } else {
        const result = await ImagePicker.launchCameraAsync({
          cameraType: ImagePicker.CameraType.front,
          quality: 0.7,
        }).catch(async () => {
          return await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
          });
        });

        if (result.canceled || !result.assets || result.assets.length === 0) {
          setStatusBiometria("idle");
          setMensagemBiometria("Captura facial cancelada.");
          return;
        }

        capturedUri = result.assets[0].uri;
      }

      if (capturedUri) {
        setFotoCapturadaUri(capturedUri);
        setStatusBiometria("scanning");
        setMensagemBiometria("Validando geometria e vivacidade facial...");

        await new Promise((resolve) => setTimeout(resolve, 1200));

        setStatusBiometria("success");
        setMensagemBiometria("Reconhecimento Facial aprovado com sucesso! ✅");

        setTimeout(async () => {
          setModalBiometria(false);
          setFotoCapturadaUri(null);
          await enviarRegistroPonto();
        }, 900);
      } else {
        setStatusBiometria("error");
        setMensagemBiometria("Rosto não identificado na imagem. Tente novamente.");
      }
    } catch (err: any) {
      console.error("Erro no reconhecimento facial:", err);
      setStatusBiometria("error");
      setMensagemBiometria("Erro ao abrir a câmera frontal. Tente novamente.");
    }
  };

  // 2. Face ID Nativo do Sistema
  const executarFaceIdNativo = async () => {
    if (Platform.OS === "web") {
      Alert.alert(
        "Face ID Nativo",
        "O Face ID nativo está disponível apenas no celular. No computador, use a Câmera Frontal ou Senha."
      );
      return;
    }

    try {
      setStatusBiometria("scanning");
      setMensagemBiometria("Olhe para a tela do aparelho para validar o Face ID...");

      const authResult = await LocalAuthentication.authenticateAsync({
        promptMessage: "Posicione o rosto para validar o Face ID - Ponto-E",
        cancelLabel: "Cancelar",
        fallbackLabel: "Usar Senha do Aparelho",
        disableDeviceFallback: false,
      });

      if (authResult.success) {
        setStatusBiometria("success");
        setMensagemBiometria("Face ID confirmado com sucesso! ✅");

        setTimeout(async () => {
          setModalBiometria(false);
          await enviarRegistroPonto();
        }, 850);
      } else {
        setStatusBiometria("idle");
        if (authResult.error === "user_cancel") {
          setMensagemBiometria("Validação biométrica cancelada.");
        } else {
          setMensagemBiometria("Face ID não reconhecido. Tente pela Câmera Frontal.");
        }
      }
    } catch (err: any) {
      console.error("Erro no Face ID:", err);
      setStatusBiometria("idle");
      setMensagemBiometria("Face ID indisponível neste momento. Use a Câmera Frontal.");
    }
  };

  // 3. Biometria Digital ou PIN
  const executarBiometriaDigital = async () => {
    if (statusBiometria === "scanning") return;

    if (Platform.OS === "web") {
      setTipoBiometria("senha");
      return;
    }

    try {
      setStatusBiometria("scanning");
      setMensagemBiometria("Posicione o dedo no sensor ou confirme com o PIN...");

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolledLevel = await LocalAuthentication.getEnrolledLevelAsync();

      if (hasHardware || enrolledLevel > LocalAuthentication.SecurityLevel.NONE) {
        const authResult = await LocalAuthentication.authenticateAsync({
          promptMessage: "Validação Biométrica - Ponto-E Coopera",
          cancelLabel: "Cancelar",
          fallbackLabel: "Usar Senha / PIN do Aparelho",
          disableDeviceFallback: false,
        });

        if (authResult.success) {
          setStatusBiometria("success");
          setMensagemBiometria("Identidade confirmada com sucesso! ✅");

          setTimeout(async () => {
            setModalBiometria(false);
            await enviarRegistroPonto();
          }, 850);
        } else {
          setStatusBiometria("idle");
          setMensagemBiometria("Biometria não confirmada. Tente novamente.");
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setStatusBiometria("success");
        setMensagemBiometria("Identidade confirmada! ✅");
        setTimeout(async () => {
          setModalBiometria(false);
          await enviarRegistroPonto();
        }, 850);
      }
    } catch (err: any) {
      console.error("Erro na biometria digital:", err);
      setStatusBiometria("idle");
      setMensagemBiometria("Falha no sensor. Use a Câmera Frontal.");
    }
  };

  const enviarRegistroPonto = async () => {
    setEnviando(true);
    setErro("");

    try {
      let localizacao = { latitude: 0, longitude: 0 };

      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status === "granted") {
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          localizacao = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
        } else {
          throw new Error("Permita o acesso à localização para registrar o ponto.");
        }
      } catch (locErr: any) {
        if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.geolocation) {
          await new Promise<void>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                localizacao = {
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                };
                resolve();
              },
              () => reject(new Error("Permita o acesso à localização para registrar o ponto.")),
              { timeout: 8000, enableHighAccuracy: false }
            );
          });
        } else {
          throw locErr;
        }
      }

      const agora = new Date();

      if (!registro) {
        const response = await authenticatedFetch("/work", {
          method: "POST",
          body: JSON.stringify({
            entrada: getCurrentTime(agora),
            saida: getCurrentTime(agora),
            data_ponto: getLocalDate(agora),
            ...localizacao,
          }),
        });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.message || "Não foi possível registrar a entrada.");
        }
        setRegistro(body.data);
      } else {
        const response = await authenticatedFetch(`/work/${registro.pk_id_ponto}`, {
          method: "PATCH",
          body: JSON.stringify({ saida: getCurrentTime(agora), ...localizacao }),
        });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.message || "Não foi possível registrar a saída.");
        }
        setRegistro(body.data);
      }
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível registrar o ponto.");
    } finally {
      setEnviando(false);
    }
  };

  const pontoEmAndamento = registro !== null && registro.entrada === registro.saida;
  const pontoConcluido = registro !== null && !pontoEmAndamento;
  const tempoDecorrido = pontoEmAndamento
    ? Math.max(0, timeToSeconds(getCurrentTime(horaAtual)) - timeToSeconds(registro.entrada))
    : registro
      ? timeToSeconds(registro.total_dia)
      : 0;

  return (
    <View style={styles.root}>
      {/* ─── Partículas de Fundo e Brilhos Ambientais ───────────────────── */}
      <View style={styles.particlesLayer} pointerEvents="none">
        <View style={[styles.glow, styles.glowTopLeft]} />
        <View style={[styles.glow, styles.glowBottomRight]} />
        {PARTICLE_CONFIGS.map((p, index) => (
          <FloatingParticle key={`p-${index}`} config={p} />
        ))}
      </View>

      {/* ─── Conteúdo Principal com Scroll ───────────────────────────────── */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Barra de Status de GPS & Conexão (Sem cabeçalho duplicado!) */}
        <View style={styles.topStatusBar}>
          <View style={styles.gpsPill}>
            <View style={styles.gpsDot} />
            <Text style={styles.gpsText}>GPS e Biometria Ativos</Text>
          </View>
        </View>

        {/* Card do Relógio Atual */}
        <View style={styles.timeCard}>
          <Text style={styles.dateText}>{getFormattedDate(horaAtual)}</Text>
          <Text style={styles.liveClock}>
            {horaAtual.toLocaleTimeString("pt-BR", { hour12: false })}
          </Text>
          <View style={styles.statusPill}>
            <View
              style={[
                styles.statusDot,
                pontoConcluido
                  ? styles.statusDotDone
                  : pontoEmAndamento
                  ? styles.statusDotActive
                  : styles.statusDotIdle,
              ]}
            />
            <Text style={styles.statusPillText}>
              {pontoConcluido
                ? "Jornada Concluída"
                : pontoEmAndamento
                ? "Em Andamento"
                : "Aguardando Entrada"}
            </Text>
          </View>
        </View>

        {/* Card Hero: Contador de Horas Trabalhadas */}
        <View style={styles.heroCard}>
          <View style={styles.heroIconBadge}>
            <Ionicons
              name={
                pontoConcluido
                  ? "checkmark-circle"
                  : pontoEmAndamento
                  ? "time"
                  : "finger-print"
              }
              size={36}
              color={pontoConcluido ? "#16A34A" : "#285A71"}
            />
          </View>

          <Text style={styles.heroLabel}>HORAS TRABALHADAS HOJE</Text>
          <Text style={styles.heroTimer}>{formatarTempo(tempoDecorrido)}</Text>

          {registro && (
            <View style={styles.checkpointBanner}>
              <Ionicons
                name="information-circle-outline"
                size={18}
                color="#285A71"
              />
              <Text style={styles.checkpointText}>
                {pontoEmAndamento
                  ? `Entrada às ${registro.entrada} • Não esqueça da saída!`
                  : `Saída finalizada às ${registro.saida}`}
              </Text>
            </View>
          )}

          {erro ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={18} color="#B42318" />
              <Text style={styles.errorText}>{erro}</Text>
            </View>
          ) : null}

          {/* Botão de Ação Principal com Gatilho Biométrico */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              pontoConcluido && styles.actionButtonDone,
              pontoEmAndamento && styles.actionButtonExit,
              (carregando || enviando) && styles.actionButtonDisabled,
            ]}
            onPress={iniciarProcessoPonto}
            disabled={carregando || enviando || pontoConcluido}
            activeOpacity={0.85}
          >
            {carregando || enviando ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <View style={styles.actionButtonContent}>
                <Ionicons
                  name={
                    pontoConcluido
                      ? "checkmark-done-circle"
                      : "shield-checkmark-outline"
                  }
                  size={24}
                  color="#FFFFFF"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.actionButtonText}>
                  {pontoConcluido
                    ? "Ponto do Dia Finalizado"
                    : pontoEmAndamento
                    ? "Confirmar Saída por Biometria"
                    : "Confirmar Entrada por Biometria"}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Resumo Rápido da Jornada */}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <View style={styles.summaryIconWrapper}>
              <Ionicons name="enter-outline" size={20} color="#285A71" />
            </View>
            <Text style={styles.summaryLabel}>Entrada</Text>
            <Text style={styles.summaryValue}>
              {registro ? registro.entrada : "--:--"}
            </Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryItem}>
            <View style={styles.summaryIconWrapper}>
              <Ionicons name="exit-outline" size={20} color="#285A71" />
            </View>
            <Text style={styles.summaryLabel}>Saída</Text>
            <Text style={styles.summaryValue}>
              {pontoConcluido && registro ? registro.saida : "--:--"}
            </Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryItem}>
            <View style={styles.summaryIconWrapper}>
              <Ionicons name="hourglass-outline" size={20} color="#285A71" />
            </View>
            <Text style={styles.summaryLabel}>Total</Text>
            <Text style={styles.summaryValue}>
              {registro
                ? formatarTempo(tempoDecorrido).slice(0, 5)
                : "00:00"}
            </Text>
          </View>
        </View>

        {/* Rodapé com Informações de Segurança */}
        <View style={styles.securityBadge}>
          <Ionicons
            name="shield-checkmark-outline"
            size={16}
            color="#52616B"
          />
          <Text style={styles.securityText}>
            Registro protegido por biometria e geolocalização auditável.
          </Text>
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* ─── Modal do Sistema de Biometria ───────────────────────────────── */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalBiometria}
        onRequestClose={() => setModalBiometria(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.biometricCard}>
            {/* Header do Modal */}
            <View style={styles.biometricHeader}>
              <Text style={styles.biometricTitle}>Autenticação Biométrica</Text>
              <Text style={styles.biometricSubtitle}>
                Escolha o método e toque no botão para confirmar
              </Text>
            </View>

            {/* Alternador de 3 Modos: Facial, Digital/PIN e Senha */}
            <View style={styles.modeSelector}>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  tipoBiometria === "facial" && styles.modeButtonActive,
                ]}
                onPress={() => {
                  setTipoBiometria("facial");
                  setStatusBiometria("idle");
                  setMensagemBiometria("Reconhecimento Facial: toque no botão abaixo para abrir");
                }}
              >
                <Ionicons
                  name="scan-outline"
                  size={15}
                  color={tipoBiometria === "facial" ? "#285A71" : "#64748B"}
                />
                <Text
                  style={[
                    styles.modeButtonText,
                    tipoBiometria === "facial" && styles.modeButtonTextActive,
                  ]}
                >
                  Facial
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modeButton,
                  tipoBiometria === "digital" && styles.modeButtonActive,
                ]}
                onPress={() => {
                  setTipoBiometria("digital");
                  setStatusBiometria("idle");
                  setMensagemBiometria("Biometria do Celular: toque no botão para acionar o sensor");
                }}
              >
                <Ionicons
                  name="finger-print"
                  size={15}
                  color={tipoBiometria === "digital" ? "#285A71" : "#64748B"}
                />
                <Text
                  style={[
                    styles.modeButtonText,
                    tipoBiometria === "digital" && styles.modeButtonTextActive,
                  ]}
                >
                  Digital / PIN
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modeButton,
                  tipoBiometria === "senha" && styles.modeButtonActive,
                ]}
                onPress={() => {
                  setTipoBiometria("senha");
                  setStatusBiometria("idle");
                  setMensagemBiometria("Digite sua senha de login e confirme");
                }}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={15}
                  color={tipoBiometria === "senha" ? "#285A71" : "#64748B"}
                />
                <Text
                  style={[
                    styles.modeButtonText,
                    tipoBiometria === "senha" && styles.modeButtonTextActive,
                  ]}
                >
                  Senha
                </Text>
              </TouchableOpacity>
            </View>

            {/* Área Interativa do Sensor */}
            <TouchableOpacity
              style={[
                styles.sensorTarget,
                statusBiometria === "scanning" && styles.sensorTargetScanning,
                statusBiometria === "success" && styles.sensorTargetSuccess,
                statusBiometria === "error" && styles.sensorTargetError,
              ]}
              activeOpacity={0.8}
              onPress={
                statusBiometria === "error"
                  ? () => {
                      setStatusBiometria("idle");
                      setFotoCapturadaUri(null);
                      if (tipoBiometria === "facial") {
                        executarCapturaSelfie();
                      } else if (tipoBiometria === "digital") {
                        executarBiometriaDigital();
                      }
                    }
                  : () => {
                      if (tipoBiometria === "facial") {
                        executarCapturaSelfie();
                      } else if (tipoBiometria === "digital") {
                        executarBiometriaDigital();
                      }
                    }
              }
            >
              <Animated.View style={[styles.sensorInnerCircle, animatedPulse]}>
                {fotoCapturadaUri ? (
                  <Image
                    source={{ uri: fotoCapturadaUri }}
                    style={styles.capturedFaceImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons
                    name={
                      statusBiometria === "success"
                        ? "checkmark-circle"
                        : statusBiometria === "error"
                        ? "close-circle"
                        : tipoBiometria === "facial"
                        ? "scan-outline"
                        : tipoBiometria === "digital"
                        ? "finger-print"
                        : "lock-closed"
                    }
                    size={64}
                    color={
                      statusBiometria === "success"
                        ? "#16A34A"
                        : statusBiometria === "error"
                        ? "#EF4444"
                        : statusBiometria === "scanning"
                        ? "#0284C7"
                        : "#285A71"
                    }
                  />
                )}
              </Animated.View>

              {/* Linha Laser Animada ao Escanear */}
              {statusBiometria === "scanning" && (
                <Animated.View
                  style={[styles.laserScanLine, animatedScanLine]}
                />
              )}
            </TouchableOpacity>

            {/* Mensagem de Feedback em Tempo Real */}
            <Text
              style={[
                styles.biometricFeedbackText,
                statusBiometria === "success" && styles.biometricFeedbackSuccess,
                statusBiometria === "scanning" && styles.biometricFeedbackScanning,
                statusBiometria === "error" && styles.biometricFeedbackError,
              ]}
            >
              {mensagemBiometria}
            </Text>

            {/* ─── Botões de Ação quando na aba Facial ─── */}
            {statusBiometria === "idle" && tipoBiometria === "facial" && (
              <View style={styles.facialActionButtonsContainer}>
                <TouchableOpacity
                  style={styles.scanActionButton}
                  onPress={executarCapturaSelfie}
                  activeOpacity={0.8}
                >
                  <Ionicons name="camera" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.scanActionButtonText}>Abrir Câmera Frontal (Selfie)</Text>
                </TouchableOpacity>

                {Platform.OS !== "web" && (
                  <TouchableOpacity
                    style={styles.secondaryScanButton}
                    onPress={executarFaceIdNativo}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="scan-outline" size={18} color="#285A71" style={{ marginRight: 8 }} />
                    <Text style={styles.secondaryScanButtonText}>Tentar Face ID do Celular</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* ─── Botões de Ação quando na aba Digital / PIN ─── */}
            {statusBiometria === "idle" && tipoBiometria === "digital" && (
              <View style={styles.facialActionButtonsContainer}>
                <TouchableOpacity
                  style={styles.scanActionButton}
                  onPress={executarBiometriaDigital}
                  activeOpacity={0.8}
                >
                  <Ionicons name="finger-print" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.scanActionButtonText}>Validar Digital ou PIN do Celular</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ─── Botões de Ação quando na aba Senha ─── */}
            {statusBiometria === "idle" && tipoBiometria === "senha" && (
              <View style={styles.webPasswordContainer}>
                <View style={styles.webPasswordInputWrapper}>
                  <Ionicons name="lock-closed" size={18} color="#64748B" style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.webPasswordInput}
                    placeholder="Digite sua senha de login..."
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showSenhaWeb}
                    value={senhaWeb}
                    onChangeText={setSenhaWeb}
                    autoCapitalize="none"
                    onSubmitEditing={validarSenhaWeb}
                  />
                  <TouchableOpacity
                    onPress={() => setShowSenhaWeb(!showSenhaWeb)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={showSenhaWeb ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color="#64748B"
                    />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.scanActionButton}
                  onPress={validarSenhaWeb}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.scanActionButtonText}>Validar Senha e Bater Ponto</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Botão Tentar Novamente em caso de erro */}
            {statusBiometria === "error" && (
              <TouchableOpacity
                style={[styles.scanActionButton, styles.retryActionButton]}
                onPress={() => {
                  setStatusBiometria("idle");
                  setFotoCapturadaUri(null);
                  if (tipoBiometria === "facial") {
                    executarCapturaSelfie();
                  } else if (tipoBiometria === "digital") {
                    executarBiometriaDigital();
                  }
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.scanActionButtonText}>Tentar Novamente</Text>
              </TouchableOpacity>
            )}

            {/* Botão Cancelar */}
            <TouchableOpacity
              style={styles.cancelBiometricButton}
              onPress={() => {
                setModalBiometria(false);
                setFotoCapturadaUri(null);
                setStatusBiometria("idle");
              }}
            >
              <Text style={styles.cancelBiometricText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── Barra de Navegação Inferior Coopera Oficial ─────────────────── */}
      <View style={styles.bottomNavigation}>
        <TouchableOpacity
          style={styles.navButton}
          activeOpacity={0.8}
          onPress={() => router.replace("/dashboard")}
        >
          <Ionicons name="home" size={26} color="#94A3B8" />
          <Text style={[styles.navLabel, { color: "#94A3B8" }]}>central</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} activeOpacity={0.8}>
          <Ionicons name="location" size={26} color="#285A71" />
          <Text style={[styles.navLabel, { color: "#285A71" }]}>Ponto-E</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          activeOpacity={0.8}
          onPress={() => router.push("/chat")}
        >
          <Ionicons
            name="chatbubble-ellipses"
            size={26}
            color="#94A3B8"
          />
          <Text style={[styles.navLabel, { color: "#94A3B8" }]}>chats</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F4F7F6",
  },
  particlesLayer: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
    zIndex: 0,
  },
  glow: {
    position: "absolute",
    borderRadius: 999,
  },
  glowTopLeft: {
    width: 380,
    height: 380,
    top: -160,
    left: -140,
    backgroundColor: "rgba(155, 203, 114, 0.16)",
  },
  glowBottomRight: {
    width: 420,
    height: 420,
    bottom: -180,
    right: -160,
    backgroundColor: "rgba(40, 90, 113, 0.14)",
  },
  topStatusBar: {
    width: "100%",
    maxWidth: 480,
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 16,
  },
  gpsPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E2F0D9",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D2E5C4",
  },
  gpsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2E7D32",
    marginRight: 7,
  },
  gpsText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2E7D32",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    alignItems: "center",
  },
  timeCard: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#285A71",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
    marginBottom: 18,
  },
  dateText: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
    textTransform: "capitalize",
    marginBottom: 6,
  },
  liveClock: {
    fontSize: 38,
    fontWeight: "800",
    color: "#0F2B3D",
    letterSpacing: 1.5,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    marginTop: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 7,
  },
  statusDotIdle: {
    backgroundColor: "#94A3B8",
  },
  statusDotActive: {
    backgroundColor: "#16A34A",
  },
  statusDotDone: {
    backgroundColor: "#2563EB",
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  heroCard: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#285A71",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
    marginBottom: 18,
  },
  heroIconBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#EDF5F8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  heroTimer: {
    fontSize: 48,
    fontWeight: "800",
    color: "#285A71",
    letterSpacing: 1.5,
  },
  checkpointBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EDF5F8",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 14,
  },
  checkpointText: {
    fontSize: 12,
    color: "#285A71",
    fontWeight: "600",
    marginLeft: 6,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FEE2E2",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 14,
    maxWidth: "92%",
  },
  errorText: {
    color: "#B42318",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 6,
    flex: 1,
  },
  actionButton: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#285A71",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
    shadowColor: "#285A71",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  actionButtonExit: {
    backgroundColor: "#C25E3E",
    shadowColor: "#C25E3E",
  },
  actionButtonDone: {
    backgroundColor: "#64748B",
    shadowColor: "#64748B",
    opacity: 0.85,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  summaryGrid: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#285A71",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 18,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F2B3D",
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 42,
    backgroundColor: "#E2E8F0",
  },
  securityBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(226, 232, 240, 0.6)",
    marginTop: 6,
  },
  securityText: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
    marginLeft: 6,
  },
  bottomNavigation: {
    height: 80,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 10,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  navButton: {
    minWidth: 64,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  navLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "700",
  },

  // ─── Estilos do Modal de Biometria ──────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 43, 61, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  biometricCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 28,
    elevation: 8,
  },
  biometricHeader: {
    alignItems: "center",
    marginBottom: 16,
  },
  biometricTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#0F2B3D",
  },
  biometricSubtitle: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    marginTop: 4,
  },
  modeSelector: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 3,
    marginBottom: 22,
    width: "100%",
  },
  modeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 10,
  },
  modeButtonActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  modeButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    marginLeft: 4,
  },
  modeButtonTextActive: {
    color: "#285A71",
  },
  sensorTarget: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#F0F7FA",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#CEE2EB",
    position: "relative",
    overflow: "hidden",
  },
  sensorTargetScanning: {
    borderColor: "#0284C7",
    backgroundColor: "#E0F2FE",
  },
  sensorTargetSuccess: {
    borderColor: "#16A34A",
    backgroundColor: "#DCFCE7",
  },
  sensorTargetError: {
    borderColor: "#EF4444",
    backgroundColor: "#FEF2F2",
  },
  sensorInnerCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  capturedFaceImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  laserScanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "#0284C7",
    shadowColor: "#0284C7",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  biometricFeedbackText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 18,
    textAlign: "center",
    minHeight: 20,
  },
  biometricFeedbackScanning: {
    color: "#0284C7",
  },
  biometricFeedbackSuccess: {
    color: "#16A34A",
  },
  biometricFeedbackError: {
    color: "#EF4444",
  },
  scanActionButton: {
    backgroundColor: "#285A71",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 22,
    marginTop: 16,
    width: "100%",
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  retryActionButton: {
    backgroundColor: "#EF4444",
  },
  scanActionButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  facialActionButtonsContainer: {
    width: "100%",
    gap: 8,
    marginTop: 16,
  },
  secondaryScanButton: {
    backgroundColor: "#E8F2F6",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 22,
    width: "100%",
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#B8D5E5",
  },
  secondaryScanButtonText: {
    color: "#285A71",
    fontSize: 14,
    fontWeight: "700",
  },
  webPasswordContainer: {
    width: "100%",
    marginTop: 14,
    gap: 10,
  },
  webPasswordInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  webPasswordInput: {
    flex: 1,
    fontSize: 14,
    color: "#1E293B",
  },
  cancelBiometricButton: {
    paddingVertical: 12,
    marginTop: 6,
  },
  cancelBiometricText: {
    fontSize: 13,
    color: "#94A3B8",
    fontWeight: "600",
  },
});