import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import WebAlertHost, { installWebAlert } from "../components/common/WebAlertHost";

installWebAlert();

export default function RootLayout() {
  const router = useRouter();

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

  const renderBackToDashboard = () => (
    <TouchableOpacity
      onPress={() => router.replace("/dashboard")}
      style={{ marginRight: 12, padding: 4 }}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Ionicons name="arrow-back" size={22} color="#285A71" />
    </TouchableOpacity>
  );

  const renderBackToLogin = () => (
    <TouchableOpacity
      onPress={() => router.replace("/")}
      style={{ marginRight: 12, padding: 4 }}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Ionicons name="arrow-back" size={22} color="#285A71" />
    </TouchableOpacity>
  );

  return (
    <>
      <Stack
        screenOptions={{
          animation: Platform.OS === "web" ? "fade" : "default",
          headerStyle: {
            backgroundColor: "#ECEFDA",
          },
          headerTintColor: "#285A71",
          headerBackVisible: false,
          headerLeft: renderBackToDashboard,
        }}
      >
        <Stack.Screen
          name="index"
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen
          name="loginEmpresa"
          options={{ title: "Empresa", headerLeft: renderBackToLogin }}
        />
        <Stack.Screen
          name="inserirTokenEmpresa"
          options={{ title: "Inserir token", headerLeft: renderBackToLogin }}
        />
        <Stack.Screen
          name="loginFuncionario"
          options={{ title: "Funcionario", headerLeft: renderBackToLogin }}
        />
        <Stack.Screen
          name="cadastroEmpresa"
          options={{ title: "Cadastro empresa", headerLeft: renderBackToLogin }}
        />
        <Stack.Screen
          name="cadastroFuncionario"
          options={{ title: "Cadastro funcionario", headerLeft: renderBackToDashboard }}
        />
        <Stack.Screen
          name="dashboard"
          options={{
            title: "Dashboard",
            headerBackVisible: false,
            headerLeft: () => null,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="ponto-e"
          options={{ title: "Ponto-E", headerLeft: renderBackToDashboard }}
        />
        <Stack.Screen name="chat" options={{ title: "Conversas", headerShown: false }} />
        <Stack.Screen name="perfilAdm" options={{ title: "Perfil Administrativo", headerShown: false }} />
        <Stack.Screen name="gestaoFuncionarios" options={{ title: "Gestão de Colaboradores", headerShown: false }} />
        <Stack.Screen name="perfilFunc" options={{ title: "Perfil Colaborador", headerShown: false }} />
        <Stack.Screen name="DadosTrabalhistas" options={{ title: "Dados Trabalhistas", headerShown: false }} />
        <Stack.Screen name="bemEstar" options={{ title: "Bem-Estar", headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: "modal", headerLeft: renderBackToDashboard }} />
      </Stack>

      <WebAlertHost />
      <StatusBar style="dark" />
    </>
  );
}
