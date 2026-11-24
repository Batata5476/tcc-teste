import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const styleId = "hide-floating-dev-icons";
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.innerHTML = `
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
            headerShown: false,
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

      <StatusBar style="dark" />
    </>
  );
}
