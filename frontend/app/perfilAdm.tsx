import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import PerfilAction from "../components/perfil/PerfilAction";
import PerfilAvatar from "../components/perfil/PerfilAvatar";
import PerfilHeader from "../components/perfil/perfilHeader";
import PerfilInfo from "../components/perfil/PerfilInfo";
import PerfilMeetingModal from "../components/perfil/PerfilMeetingModal";
import PerfilMedicalModal from "../components/perfil/PerfilMedicalModal";
import PerfilPointsModal from "../components/perfil/PerfilPointsModal";
import PerfilBackupModal from "../components/perfil/PerfilBackupModal";
import PieChartCard from "../components/common/PieChartCard";
import EmotionsPieChartCard from "../components/common/EmotionsPieChartCard";
import { authenticatedFetch } from "../services/api";

type UserProfile = {
  id: number;
  nome: string;
  email: string;
  cpf?: string;
  telefone?: string;
  foto?: string | null;
  pontos?: number;
};
// Tipo parar armazenar latitude e longitude da empresa de tipo número ou string
type CompanyLocation = {
  id: number;
  latitude: number | string | null;
  longitude: number | string | null;
};

export default function PerfilAdm() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [companyLocation, setCompanyLocation] = useState<CompanyLocation | null>(null);
  const [savingCompanyLocation, setSavingCompanyLocation] = useState(false);


  const [tasks, setTasks] = useState<any[]>([]);

  // Estados dos Modais
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [medicalOpen, setMedicalOpen] = useState(false);
  const [pointsOpen, setPointsOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [subject, setSubject] = useState("");

  const loadProfile = async () => {
    try {
      setLoading(true);
      const res = await authenticatedFetch("/dashboard/user");
      if (res.ok) {
        const body = await res.json();
        setUser(body.data);
      }

      const tasksRes = await authenticatedFetch("/tasks/company-tasks");
      if (tasksRes.ok) {
        const tasksBody = await tasksRes.json();
        setTasks(tasksBody.data ?? []);
      } else {
        const fallbackRes = await authenticatedFetch("/tasks/my-tasks");
        if (fallbackRes.ok) {
          const fallbackBody = await fallbackRes.json();
          setTasks(fallbackBody.data ?? []);
        }
      }


      // Carrega a localização da empresa do usuário logado
      const companyRes = await authenticatedFetch("/company");
      if (companyRes.ok) {
        const companyBody = await companyRes.json();
        setCompanyLocation(companyBody.data?.[0] ?? null);
      }
    } catch (err) {
      console.error("Erro ao carregar perfil adm:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  // Estatísticas calculadas dinamicamente com base nas tarefas reais do banco
  const concluidasCount = tasks.filter((t) => t.status === 1).length;
  const emAndamentoCount = tasks.filter((t) => t.status === 2).length;
  const pendentesCount = tasks.filter((t) => t.status === 3).length;

  const taskChartData = [
    { label: "Concluídas", value: concluidasCount, color: "#10B981" },
    { label: "Em Andamento", value: emAndamentoCount, color: "#3B82F6" },
    { label: "Pendentes", value: pendentesCount, color: "#EF4444" },
  ];

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

    if (result.canceled || !result.assets?.[0]?.base64 || !user?.id) return;

    const asset = result.assets[0];
    const mimeType = asset.mimeType || "image/jpeg";
    const photoDataUri = `data:${mimeType};base64,${asset.base64}`;

    setUser((prev) => (prev ? { ...prev, foto: photoDataUri } : null));
    setUploadingPhoto(true);

    try {
      const res = await authenticatedFetch(`/users/${user.id}`, {
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

  // Função para salvar a localização da empresa com latitude e longitude atuais do GPS do dispositivo
  const handleSaveCompanyLocation = () => {
    const confirmationText = "Deseja realmente atualizar a localização da empresa para a sua posição atual? Isso afetará a validação do registro de ponto dos funcionários.";
    if (Platform.OS === "web") {
      const confirmed = window.confirm(confirmationText);
      if (confirmed) {
        performSaveCompanyLocation();
      }
    } else {
      Alert.alert(
        "Confirmar Localização",
        confirmationText,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Sim, atualizar", onPress: performSaveCompanyLocation },
        ]
      );
    }
  };

  const performSaveCompanyLocation = async () => {
    if (savingCompanyLocation) return;

    if (!companyLocation?.id) {
      const msg = "Empresa não encontrada. Recarregue a página e tente novamente.";
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert("Empresa não encontrada", msg);
      }
      return;
    }

    setSavingCompanyLocation(true);
    try {
      let latitude: number | null = null;
      let longitude: number | null = null;

      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.geolocation) {
        // Fallback nativo do navegador para geolocalização precisa
        const pos: any = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
          });
        }).catch((err) => {
          throw new Error(
            err.code === 1
              ? "Permissão de localização negada no navegador. Permita o acesso ao GPS na barra de endereços."
              : "Não foi possível obter as coordenadas GPS pelo navegador."
          );
        });
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } else {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) {
          throw new Error("Permita o acesso à localização para continuar.");
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      }

      if (latitude !== null && longitude !== null) {
        const response = await authenticatedFetch(`/company/${companyLocation.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            latitude,
            longitude,
          }),
        });
        const body = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(body.message || "Não foi possível salvar a localização.");
        }

        // Atualiza o estado local com a Localização
        setCompanyLocation(body.data);
        const successMsg = "A localização da sede foi atualizada com sucesso!";
        if (Platform.OS === "web") {
          window.alert(successMsg);
        } else {
          Alert.alert("Localização salva", successMsg);
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Não foi possível obter o GPS.";
      if (Platform.OS === "web") {
        window.alert(`Erro: ${errorMsg}`);
      } else {
        Alert.alert("Erro", errorMsg);
      }
    } finally {
      setSavingCompanyLocation(false);
    }
  };
  // Verifica se está definida a loc da empresa
  const companyLocationIsSet = companyLocation?.latitude !== null
    && companyLocation?.latitude !== undefined
    && companyLocation?.longitude !== null
    && companyLocation?.longitude !== undefined;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <PerfilHeader />

        {/* TÍTULO */}
        <Text style={styles.title}>Perfil Administrativo</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#285A71" style={{ marginVertical: 30 }} />
        ) : (
          <>
            <PerfilAvatar
              fotoUrl={user?.foto}
              onPickPhoto={handlePickPhoto}
              uploading={uploadingPhoto}
            />

            <View style={styles.nameHeaderCard}>
              <Text style={styles.userName}>{user?.nome || "Administrador Master"}</Text>
              <Text style={styles.userRole}>Gestor Corporativo</Text>
            </View>

            <PerfilInfo
              email={user?.email}
              cpf={user?.cpf}
              telefone={user?.telefone}
            />
          </>
        )}

        {/* GRÁFICO DE ESTATÍSTICAS DO ADM */}
        <PieChartCard
          title="Status das Atividades Gerais"
          subtitle="Acompanhamento em tempo real das tarefas da equipe"
          data={taskChartData}
          size={140}
        />

        {/* GRÁFICO DE EMOÇÕES DA EQUIPE (totais agregados) */}
        <EmotionsPieChartCard />

        {/* SEÇÃO DE FERRAMENTAS & GESTÃO DA EMPRESA */}
        <View style={styles.sectionHeaderWrapper}>
          <Text style={styles.sectionCategory}>ÁREA ADMINISTRATIVA</Text>
          <Text style={styles.sectionHeaderTitle}>Ferramentas e recursos</Text>
          <Text style={styles.sectionHeaderSubtitle}>
            Acesse rapidamente as ferramentas de gestão e recursos da empresa.
          </Text>
        </View>

        <View style={styles.gridContainer}>
          <PerfilAction
            icon="location-outline"
            title="Localização da empresa"
            subtitle={
              savingCompanyLocation
                ? "Salvando GPS..."
                : companyLocationIsSet
                ? `GPS Salvo (${Number(companyLocation?.latitude).toFixed(3)}, ${Number(companyLocation?.longitude).toFixed(3)})`
                : "Definir sede para ponto (50m)"
            }
            badge={companyLocationIsSet ? "Ativo" : undefined}
            onPress={handleSaveCompanyLocation}
          />

          <PerfilAction
            icon="calendar-outline"
            title="Solicitar reunião"
            subtitle="Agende um horário"
            onPress={() => setMeetingOpen(true)}
          />

          <PerfilAction
            icon="briefcase-outline"
            title="Dados trabalhistas"
            subtitle="Salário e banco de horas"
            onPress={() => router.push("/DadosTrabalhistas")}
          />

          <PerfilAction
            icon="trophy-outline"
            title="Sistema de pontuações"
            subtitle="Metas e pontuação da equipe"
            onPress={() => setPointsOpen(true)}
          />

          <PerfilAction
            icon="medkit-outline"
            title="Histórico médico"
            subtitle="Saúde e atestados da equipe"
            onPress={() => setMedicalOpen(true)}
          />

          <PerfilAction
            icon="person-add-outline"
            title="Cadastro de equipe"
            subtitle="Admissão de colaborador"
            onPress={() => router.push("/cadastroFuncionario")}
          />

          <PerfilAction
            icon="people-outline"
            title="Gestão da equipe"
            subtitle="Colaboradores e cargos"
            onPress={() => router.push("/gestaoFuncionarios")}
          />

          <PerfilAction
            icon="heart-outline"
            title="Humor e bem-estar"
            subtitle="Clima organizacional"
            onPress={() => router.push("/bemEstar")}
          />

          <PerfilAction
            icon="cloud-upload-outline"
            title="Backup da empresa"
            subtitle="Segurança e restauração"
            onPress={() => setBackupOpen(true)}
          />
        </View>
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
        isAdmin={true}
      />

      <PerfilPointsModal
        visible={pointsOpen}
        onClose={() => setPointsOpen(false)}
        pontos={user?.pontos ?? 0}
      />

      <PerfilBackupModal
        visible={backupOpen}
        onClose={() => setBackupOpen(false)}
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
  userRole: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500",
  },
  sectionHeaderWrapper: {
    marginHorizontal: 16,
    marginTop: 22,
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