import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  SafeAreaView,
  ScrollView,
  Platform,
  StatusBar,
} from "react-native";

import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import PerfilHeader from "../components/perfil/perfilHeader";
import PerfilMeetingModal from "../components/perfil/PerfilMeetingModal";
import PerfilMedicalModal from "../components/perfil/PerfilMedicalModal";
import PerfilAction from "../components/perfil/PerfilAction";
import { authenticatedFetch } from "../services/api";

const humorOptions = {
  angry: {
    id: 1,
    image: require("../assets/angry.png"),
    text: "Raiva",
  },

  sad: {
    id: 2,
    image: require("../assets/sad.png"),
    text: "Triste",
  },

  neutral: {
    id: 3,
    image: require("../assets/neutral.png"),
    text: "Neutra",
  },

  good: {
    id: 4,
    image: require("../assets/good.png"),
    text: "Muito Feliz",
  },

  happy: {
    id: 5,
    image: require("../assets/happy.png"),
    text: "Feliz",
  },
};

export function Emotions() {
  const router = useRouter();

  const [humorSelecionado, setHumorSelecionado] =
    useState<number | null>(null);
  const [jaRegistrouHoje, setJaRegistrouHoje] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{
    type: "success" | "info" | "error";
    text: string;
  } | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [occurrenceModalVisible, setOccurrenceModalVisible] = useState(false);

  const [subject, setSubject] = useState("");
  const [salvandoHumor, setSalvandoHumor] = useState(false);

  // Carrega o humor já registrado hoje pelo próprio usuário logado, se houver
  useEffect(() => {
    const loadTodayHumor = async () => {
      try {
        const [userRes, res] = await Promise.all([
          authenticatedFetch("/dashboard/user").catch(() => null),
          authenticatedFetch("/wellbeing"),
        ]);

        let myId: number | null = null;
        if (userRes && userRes.ok) {
          const userBody = await userRes.json().catch(() => ({}));
          myId = userBody.data?.id ?? null;
        }

        if (res.ok) {
          const body = await res.json();
          const allHumores = body.data || [];
          const humores = myId
            ? allHumores.filter((h: any) => !h.fk_id_func || h.fk_id_func === myId)
            : allHumores;
          if (humores.length > 0) {
            const ultimo = humores[0];
            const dataUltimo = new Date(ultimo.dth_humor);
            const hoje = new Date();
            const ehHoje =
              dataUltimo.getDate() === hoje.getDate() &&
              dataUltimo.getMonth() === hoje.getMonth() &&
              dataUltimo.getFullYear() === hoje.getFullYear();

            if (ehHoje) {
              setHumorSelecionado(ultimo.humor_func);
              setJaRegistrouHoje(true);
              setFeedbackMsg({
                type: "info",
                text: "Você já registrou seu humor hoje! Cada colaborador pode registrar uma vez por dia.",
              });
            }
          }
        }
      } catch (e) {
        console.error("Erro ao carregar humor de hoje:", e);
      }
    };

    loadTodayHumor();
  }, []);

  const handleSelectHumor = async (humorId: number) => {
    if (salvandoHumor) return;

    if (jaRegistrouHoje) {
      setFeedbackMsg({
        type: "info",
        text: "Você já registrou seu humor hoje. Volte amanhã para um novo registro!",
      });
      return;
    }

    try {
      setSalvandoHumor(true);
      const res = await authenticatedFetch("/wellbeing", {
        method: "POST",
        body: JSON.stringify({ humor_func: humorId }),
      });

      const body = await res.json().catch(() => ({}));

      if (res.ok) {
        setHumorSelecionado(humorId);
        setJaRegistrouHoje(true);
        setFeedbackMsg({
          type: "success",
          text: "Humor registrado com sucesso! Obrigado pelo seu registro.",
        });
      } else if (res.status === 409) {
        setJaRegistrouHoje(true);
        setFeedbackMsg({
          type: "info",
          text: body.message || "Você já registrou seu humor hoje.",
        });
      } else {
        setFeedbackMsg({
          type: "error",
          text: body.message || "Não foi possível registrar o humor.",
        });
      }
    } catch (e) {
      setFeedbackMsg({
        type: "error",
        text: "Erro ao conectar com o servidor.",
      });
    } finally {
      setSalvandoHumor(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <PerfilHeader onBack={() => router.replace("/dashboard")} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Seção das emoções */}
        <View style={styles.emotionSection}>
          <Text style={styles.title}>
            Como você está se sentindo hoje?
          </Text>

          <View style={styles.emotionsContainer}>
            {Object.values(humorOptions).map((humor) => {
              const isSelected = humorSelecionado === humor.id;
              return (
                <TouchableOpacity
                  key={humor.id}
                  style={[
                    styles.emotionButton,
                    isSelected && styles.emotionButtonSelected,
                    jaRegistrouHoje && !isSelected && styles.emotionButtonDisabled,
                  ]}
                  onPress={() => handleSelectHumor(humor.id)}
                  activeOpacity={0.7}
                  disabled={salvandoHumor}
                >
                  <Image
                    source={humor.image}
                    style={styles.emotionImage}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          {feedbackMsg && (
            <View
              style={[
                styles.feedbackBanner,
                feedbackMsg.type === "success" && styles.feedbackSuccess,
                feedbackMsg.type === "info" && styles.feedbackInfo,
                feedbackMsg.type === "error" && styles.feedbackError,
              ]}
            >
              <Text
                style={[
                  styles.feedbackText,
                  feedbackMsg.type === "success" && styles.feedbackTextSuccess,
                  feedbackMsg.type === "info" && styles.feedbackTextInfo,
                  feedbackMsg.type === "error" && styles.feedbackTextError,
                ]}
              >
                {feedbackMsg.text}
              </Text>
            </View>
          )}
        </View>

        {/* Card Histórico Médico */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => setOccurrenceModalVisible(true)}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.cardTitle}>Histórico Médico</Text>
            <Text style={styles.cardContent}>
              Consulte seu histórico de saúde, licenças e afastamentos registrados.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#285A71" />
        </TouchableOpacity>

        {/* Card Atestados Médicos */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => setOccurrenceModalVisible(true)}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.cardTitle}>Atestados Médicos</Text>
            <Text style={styles.cardContent}>
              Envie atestados médicos e acompanhe o status de validação junto ao RH.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#285A71" />
        </TouchableOpacity>

        {/* Ferramentas do perfil */}
        <View style={styles.actionsContainer}>
          <PerfilAction
            icon="calendar-outline"
            text="solicitar reunião"
            onPress={() => setModalVisible(true)}
            showAdd={false}
          />

          <PerfilAction
            icon="alert-circle-outline"
            text="relatar ocorrência"
            onPress={() => setOccurrenceModalVisible(true)}
            showAdd={false}
          />
        </View>
      </ScrollView>

      {/* Modal de reunião */}
      <PerfilMeetingModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        subject={subject}
        setSubject={setSubject}
      />

      <PerfilMedicalModal
        visible={occurrenceModalVisible}
        onClose={() => setOccurrenceModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 28) : 0,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  emotionSection: {
    alignItems: "center",
  },

  title: {
    marginHorizontal: 20,
    marginTop: 6,
    marginBottom: 18,
    fontSize: 20,
    fontWeight: "700",
    color: "#285A71",
    textAlign: "center",
  },

  emotionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "90%",
  },

  emotionButton: {
    padding: 5,
    borderRadius: 50,
  },

  emotionButtonSelected: {
    backgroundColor: "#E2E8F0",
    borderWidth: 2,
    borderColor: "#285A71",
  },

  emotionButtonDisabled: {
    opacity: 0.45,
  },

  feedbackBanner: {
    marginHorizontal: 20,
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    width: "90%",
    alignItems: "center",
  },

  feedbackSuccess: {
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#86EFAC",
  },

  feedbackInfo: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FCD34D",
  },

  feedbackError: {
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },

  feedbackText: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },

  feedbackTextSuccess: {
    color: "#15803D",
  },

  feedbackTextInfo: {
    color: "#B45309",
  },

  feedbackTextError: {
    color: "#B91C1C",
  },

  emotionImage: {
    width: 50,
    height: 50,
    resizeMode: "contain",
  },

  card: {
    marginHorizontal: 20,
    marginTop: 20,
    padding: 18,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#285A71",
  },

  cardContent: {
    marginTop: 10,
    fontSize: 14,
    color: "#555555",
  },

  actionsContainer: {
    marginTop: 20,
    marginHorizontal: 20,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
});

export default Emotions;