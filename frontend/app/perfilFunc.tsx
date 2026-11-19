import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import PerfilHeader from "../components/perfil/perfilHeader";
import PerfilAvatar from "../components/perfil/PerfilAvatar";
import PerfilInfo from "../components/perfil/PerfilInfo";
import PerfilAction from "../components/perfil/PerfilAction";
import PerfilMeetingModal from "../components/perfil/PerfilMeetingModal";
import PerfilMedicalModal from "../components/perfil/PerfilMedicalModal";
import PerfilPointsModal from "../components/perfil/PerfilPointsModal";
import { authenticatedFetch } from "../services/api";

type UserData = {
  id: number;
  nome: string;
  email: string;
  cpf?: string;
  telefone?: string;
  pontos: number;
  foto: string | null;
  tarefasPendentes: number;
  tarefasConcluidas: number;
  cargo?: string;
  setor?: string;
};

export default function PerfilFunc() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Estados dos Modais
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [medicalOpen, setMedicalOpen] = useState(false);
  const [pointsOpen, setPointsOpen] = useState(false);
  const [subject, setSubject] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await authenticatedFetch("/dashboard/user");
      if (res.ok) {
        const body = await res.json();
        setUserData(body.data);
      }
    } catch (err) {
      console.error("Erro ao carregar dados em perfilFunc:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Upload e Salvar Foto de Perfil
  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permissão negada", "Precisamos de acesso à galeria para alterar sua foto.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]?.base64 || !userData?.id) return;

    const asset = result.assets[0];
    const mimeType = asset.mimeType || "image/jpeg";
    const photoDataUri = `data:${mimeType};base64,${asset.base64}`;

    setUserData((prev) => (prev ? { ...prev, foto: photoDataUri } : null));
    setUploadingPhoto(true);

    try {
      const res = await authenticatedFetch(`/users/${userData.id}`, {
        method: "PATCH",
        body: JSON.stringify({ foto: photoDataUri, foto_func: photoDataUri }),
      });

      if (!res.ok) {
        throw new Error("Erro ao salvar foto no banco.");
      }
      Alert.alert("Sucesso", "Foto de perfil atualizada com sucesso!");
    } catch (err: any) {
      Alert.alert("Atenção", err.message || "Não foi possível salvar a foto.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <PerfilHeader />

        {/* TÍTULO DA TELA */}
        <Text style={styles.title}>Perfil do Colaborador</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#285A71" style={{ marginVertical: 30 }} />
        ) : (
          <>
            {/* AVATAR COM EDITAR FOTO */}
            <PerfilAvatar
              fotoUrl={userData?.foto}
              onPickPhoto={handlePickPhoto}
              uploading={uploadingPhoto}
            />

            {/* NOME E CÓDIGO */}
            <View style={styles.nameHeaderCard}>
              <Text style={styles.userName}>{userData?.nome || "Nome do funcionário"}</Text>
              <Text style={styles.userCode}>
                Código ID: #{userData?.id ? String(userData.id).padStart(4, "0") : "----"}
              </Text>
            </View>

            {/* CARGO E SETOR */}
            <View style={styles.positionCard}>
              <View style={styles.positionBadge}>
                <Ionicons name="briefcase-outline" size={14} color="#285A71" />
                <Text style={styles.positionText}>{userData?.cargo || "Colaborador"}</Text>
              </View>
              <View style={styles.positionBadge}>
                <Ionicons name="business-outline" size={14} color="#285A71" />
                <Text style={styles.positionText}>{userData?.setor || "Operacional"}</Text>
              </View>
            </View>

            {/* INFORMAÇÕES PESSOAIS */}
            <PerfilInfo
              email={userData?.email}
              cpf={userData?.cpf}
              telefone={userData?.telefone}
            />

            {/* CARDS DE RESUMO / PONTOS / TAREFAS */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Ionicons name="trophy" size={22} color="#D97706" />
                <Text style={styles.statNumber}>{userData?.pontos ?? 0}</Text>
                <Text style={styles.statLabel}>Pontos</Text>
              </View>

              <View style={styles.statCard}>
                <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
                <Text style={styles.statNumber}>{userData?.tarefasConcluidas ?? 0}</Text>
                <Text style={styles.statLabel}>Concluídas</Text>
              </View>

              <View style={styles.statCard}>
                <Ionicons name="time" size={22} color="#285A71" />
                <Text style={styles.statNumber}>{userData?.tarefasPendentes ?? 0}</Text>
                <Text style={styles.statLabel}>Pendentes</Text>
              </View>
            </View>

            {/* AÇÕES E RECURSOS - ESTILO MODERNO DE CARDS */}
            <View style={styles.sectionHeaderWrapper}>
              <Text style={styles.sectionCategory}>ÁREA DO COLABORADOR</Text>
              <Text style={styles.sectionHeaderTitle}>Ferramentas e recursos</Text>
              <Text style={styles.sectionHeaderSubtitle}>
                Acesse rapidamente seus recursos e informações.
              </Text>
            </View>

            <View style={styles.gridContainer}>
              <PerfilAction
                icon="calendar-outline"
                title="Solicitar reunião"
                subtitle="Agende um horário"
                onPress={() => setMeetingOpen(true)}
              />

              <PerfilAction
                icon="briefcase-outline"
                title="Dados trabalhistas"
                subtitle="Consulte seus dados"
                onPress={() => router.push("/DadosTrabalhistas")}
              />

              <PerfilAction
                icon="trophy-outline"
                title="Sistema de pontuações"
                subtitle="Acompanhe seus pontos"
                onPress={() => setPointsOpen(true)}
              />

              <PerfilAction
                icon="medkit-outline"
                title="Histórico médico"
                subtitle="Saúde e ausências"
                onPress={() => setMedicalOpen(true)}
              />

              <PerfilAction
                icon="heart-outline"
                title="Humor e bem-estar"
                subtitle="Registre como se sente"
                onPress={() => router.push("/bemEstar")}
              />

              <PerfilAction
                icon="list-outline"
                title="Minhas tarefas"
                subtitle="Veja suas pendências"
                onPress={() => router.push("/dashboard")}
              />
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modais */}
      <PerfilMeetingModal
        visible={meetingOpen}
        onClose={() => setMeetingOpen(false)}
        subject={subject}
        setSubject={setSubject}
      />

      <PerfilMedicalModal
        visible={medicalOpen}
        onClose={() => setMedicalOpen(false)}
      />

      <PerfilPointsModal
        visible={pointsOpen}
        onClose={() => setPointsOpen(false)}
        pontos={userData?.pontos ?? 0}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollContent: {
    paddingBottom: 40,
    width: "100%",
  },
  title: {
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 12,
    fontSize: 20,
    fontWeight: "700",
    color: "#285A71",
  },
  nameHeaderCard: {
    marginHorizontal: 16,
    marginTop: 4,
    alignItems: "center",
  },
  userName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
  },
  userCode: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500",
  },
  positionCard: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginTop: 10,
    marginBottom: 6,
  },
  positionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ECEFDA",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  positionText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#285A71",
  },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginVertical: 12,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    elevation: 1,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
    marginTop: 4,
  },
  statLabel: {
    fontSize: 10,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500",
  },
  sectionHeaderWrapper: {
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 14,
  },
  sectionCategory: {
    fontSize: 11,
    fontWeight: "700",
    color: "#285A71",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  sectionHeaderTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#285A71",
    marginBottom: 3,
  },
  sectionHeaderSubtitle: {
    fontSize: 12.5,
    color: "#64748B",
    fontWeight: "400",
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginHorizontal: 16,
  },
});