import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { authenticatedFetch } from "../services/api";

type WorkRecord = {
  pk_id_ponto: number;
  fk_id_func?: number;
  data_ponto: string;
  entrada: string;
  saida: string;
  total_dia: string;
};

function formatDatePtBr(rawDate?: string): string {
  if (!rawDate) return "--/--/----";
  const match = String(rawDate).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return String(rawDate);
  return parsed.toLocaleDateString("pt-BR");
}

export default function DadosTrabalhistas() {
  const router = useRouter();
  const [agora] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [ultimoPonto, setUltimoPonto] = useState<WorkRecord | null>(null);

  useEffect(() => {
    fetchPonto();
  }, []);

  const fetchPonto = async () => {
    try {
      setLoading(true);
      const [userRes, res] = await Promise.all([
        authenticatedFetch("/dashboard/user").catch(() => null),
        authenticatedFetch("/work"),
      ]);

      let myId: number | null = null;
      if (userRes && userRes.ok) {
        const userBody = await userRes.json().catch(() => ({}));
        myId = userBody.data?.id ?? null;
      }

      if (res.ok) {
        const json = await res.json();
        const records: WorkRecord[] = Array.isArray(json.data) ? json.data : [];
        const ownRecords = myId
          ? records.filter((r) => !r.fk_id_func || r.fk_id_func === myId)
          : records;
        if (ownRecords.length > 0) {
          setUltimoPonto(ownRecords[0]);
        }
      }
    } catch (error) {
      console.log("Erro ao carregar dados de ponto:", error);
    } finally {
      setLoading(false);
    }
  };

  const data = agora.toLocaleDateString("pt-BR");

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/dashboard");
            }
          }}
        >
          <Ionicons name="arrow-back" size={22} color="#1C1B1F" />
        </TouchableOpacity>
      </View>

      {/* CARD SALÁRIO */}
      <View style={styles.card}>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>salário</Text>
          <Text style={styles.cardSubtitle}>Informações salariais</Text>
          <Text style={styles.salaryValue}>Não informado pelo RH</Text>
        </View>

        <View style={styles.cardFooter}>
          <View />
          <Ionicons name="chevron-down" size={20} color="#1C1B1F" />
        </View>
      </View>

      {/* CARD CARGA HORÁRIA */}
      <View style={styles.card}>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>carga horária</Text>
          <Text style={styles.cardSubtitle}>
            {ultimoPonto
              ? `Último registro: ${formatDatePtBr(ultimoPonto.data_ponto)}`
              : "Sem registros de ponto hoje"}
          </Text>
        </View>

        <View style={styles.cardFooter}>
          {loading ? (
            <ActivityIndicator size="small" color="#2A5768" />
          ) : (
            <View style={styles.badgeGroup}>
              <View style={styles.darkBadge}>
                <Text style={styles.darkBadgeText}>
                  Entrada: {ultimoPonto?.entrada || "--:--"}
                </Text>
              </View>
              <View style={styles.lightBadge}>
                <Text style={styles.lightBadgeText}>
                  Total: {ultimoPonto?.total_dia || "00:00:00"}
                </Text>
              </View>
            </View>
          )}
          <Ionicons name="chevron-down" size={20} color="#1C1B1F" />
        </View>
      </View>

      {/* CARD FOLGAS */}
      <View style={styles.card}>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>folgas</Text>
          <Text style={styles.cardSubtitle}>Sem folgas programadas para a semana</Text>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.badgeGroup}>
            <View style={styles.darkBadge}>
              <Text style={styles.darkBadgeText}>{data}</Text>
            </View>
          </View>
          <Ionicons name="chevron-down" size={20} color="#1C1B1F" />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  /* HEADER */
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },

  headerButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
  },

  /* CARDS */
  card: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 22,
    backgroundColor: "#EFEFE7",
    borderRadius: 24,
    minHeight: 140,
    justifyContent: "space-between",
  },

  cardContent: {
    gap: 4,
  },

  cardTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1C1B1F",
  },

  cardSubtitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1C1B1F",
    marginTop: 2,
  },

  salaryValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1C1B1F",
    marginTop: 12,
  },

  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
  },

  badgeGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  darkBadge: {
    backgroundColor: "#2A5768",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },

  darkBadgeText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },

  lightBadge: {
    backgroundColor: "#E6ECBF",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },

  lightBadgeText: {
    color: "#1C1B1F",
    fontSize: 13,
    fontWeight: "600",
  },
});