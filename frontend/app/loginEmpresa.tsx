// Tela legada — fluxo unificado na tela inicial (index.tsx)
import { useEffect } from "react";
import { useRouter } from "expo-router";

export default function LoginEmpresa() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, []);
  return null;
}
