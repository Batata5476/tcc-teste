import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  Platform,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import WebAlertHost, { installWebAlert } from "../components/common/WebAlertHost";

installWebAlert();

type HeaderMeta = {
  title: string;
  subtitle: string;
  backTarget?: "/dashboard" | "/" | "auto" | null;
};

const ROUTE_HEADER_META: Record<string, HeaderMeta> = {
  dashboard: {
    title: "Dashboard",
    subtitle: "Central de atividades Coopera",
    backTarget: null,
  },
  "ponto-e": {
    title: "Ponto-E",
    subtitle: "Registro de ponto eletrônico Coopera",
    backTarget: "/dashboard",
  },
  cadastroFuncionario: {
    title: "Novo Colaborador",
    subtitle: "Gestão de equipe Coopera",
    backTarget: "auto",
  },
  cadastroEmpresa: {
    title: "Cadastro de Empresa",
    subtitle: "Ambiente corporativo Coopera",
    backTarget: "/",
  },
  inserirTokenEmpresa: {
    title: "Inserir Token",
    subtitle: "Autenticação corporativa Coopera",
    backTarget: "/",
  },
  modal: {
    title: "Detalhes",
    subtitle: "Sistema Coopera",
    backTarget: "/dashboard",
  },
};

function ChatStyleStackHeader({
  routeName,
  optionsTitle,
}: {
  routeName: string;
  optionsTitle?: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const meta = ROUTE_HEADER_META[routeName] ?? {
    title: optionsTitle || routeName,
    subtitle: "Ambiente corporativo Coopera",
    backTarget: "/dashboard" as const,
  };

  const handleBack = () => {
    if (meta.backTarget === "/") {
      router.replace("/");
      return;
    }
    if (meta.backTarget === "auto") {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/dashboard");
      }
      return;
    }
    router.replace("/dashboard");
  };

  const paddingTop =
    Platform.OS === "web"
      ? 16
      : Math.max(
          insets.top,
          Platform.OS === "android" ? RNStatusBar.currentHeight || 24 : 20,
        ) + 8;

  return (
    <View style={[styles.headerContainer, { paddingTop }]}>
      <View style={styles.headerLeft}>
        {meta.backTarget ? (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={handleBack}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={20} color="#285A71" />
          </TouchableOpacity>
        ) : null}
        <View>
          <Text style={styles.headerTitle}>{meta.title}</Text>
          <Text style={styles.headerSubtitle}>{meta.subtitle}</Text>
        </View>
      </View>
    </View>
  );
}

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      // Ajusta meta viewport em tempo de execução (dev e produção) para evitar zoom involuntário no iOS
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        viewport.setAttribute(
          "content",
          "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        );
      }

      const styleId = "coopera-web-mobile-fixes";
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.innerHTML = `
          html, body {
            -webkit-text-size-adjust: 100%;
            touch-action: manipulation;
          }
          /* Remove o retângulo azul nativo de foco (focus ring / outline) do navegador nos inputs internos */
          input, textarea, select,
          input:focus, textarea:focus, select:focus,
          input:focus-visible, textarea:focus-visible, select:focus-visible {
            outline: none !important;
            outline-width: 0 !important;
            outline-style: none !important;
            box-shadow: none !important;
          }
          @media screen and (max-width: 768px) {
            input, textarea, select {
              font-size: 16px !important;
            }
          }
          [data-expo-dev-menu],
          [aria-label="Developer Menu"],
          div[class*="dev-menu"],
          div[class*="DevTools"],
          div[class*="react-scan"],
          div[class*="devtools-"],
          div[class*="floating-tools"],
          button[class*="dev-menu"] {
            display: none !important;
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

  return (
    <>
      <Stack
        screenOptions={{
          animation: Platform.OS === "web" ? "fade" : "default",
          header: ({ route, options }) => (
            <ChatStyleStackHeader
              routeName={route.name}
              optionsTitle={typeof options.title === "string" ? options.title : undefined}
            />
          ),
        }}
      >
        <Stack.Screen
          name="index"
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen
          name="loginEmpresa"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="inserirTokenEmpresa"
          options={{ title: "Inserir Token" }}
        />
        <Stack.Screen
          name="loginFuncionario"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="cadastroEmpresa"
          options={{ title: "Cadastro de Empresa" }}
        />
        <Stack.Screen
          name="cadastroFuncionario"
          options={{ title: "Novo Colaborador" }}
        />
        <Stack.Screen
          name="dashboard"
          options={{
            title: "Dashboard",
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="ponto-e"
          options={{ title: "Ponto-E" }}
        />
        <Stack.Screen name="chat" options={{ title: "Conversas", headerShown: false }} />
        <Stack.Screen name="perfilAdm" options={{ title: "Perfil Administrativo", headerShown: false }} />
        <Stack.Screen name="gestaoFuncionarios" options={{ title: "Gestão de Colaboradores", headerShown: false }} />
        <Stack.Screen name="perfilFunc" options={{ title: "Perfil Colaborador", headerShown: false }} />
        <Stack.Screen name="DadosTrabalhistas" options={{ title: "Dados Trabalhistas", headerShown: false }} />
        <Stack.Screen name="bemEstar" options={{ title: "Bem-Estar", headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: "modal", title: "Detalhes" }} />
      </Stack>

      <WebAlertHost />
      <StatusBar style="dark" />
    </>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F2B3D",
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: "#64748B",
    fontWeight: "500",
    marginTop: 1,
  },
});
