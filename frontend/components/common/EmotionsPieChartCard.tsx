import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import PieChartCard, { PieChartItem } from "./PieChartCard";
import { authenticatedFetch } from "../../services/api";

// Mesma escala usada na tela de bem-estar (humor_func 1..5).
// Cores retiradas da paleta já usada nas telas do COOPERA.
const EMOTIONS: { id: number; label: string; color: string }[] = [
  { id: 1, label: "Raiva", color: "#DC2626" },
  { id: 2, label: "Triste", color: "#D97706" },
  { id: 3, label: "Neutra", color: "#94A3B8" },
  { id: 4, label: "Feliz", color: "#A8CF83" },
  { id: 5, label: "Muito Feliz", color: "#285A71" },
];

type EmotionStatsResponse = {
  totalRegistros: number;
  porEmocao: { humor: number; total: number }[];
};

export default function EmotionsPieChartCard() {
  const [data, setData] = useState<PieChartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await authenticatedFetch("/dashboard/company/emotions");
      if (!res.ok) {
        throw new Error(
          res.status === 403
            ? "Você não tem permissão para ver estes dados."
            : "Não foi possível carregar as emoções."
        );
      }

      const body = await res.json();
      const stats: EmotionStatsResponse = body.data ?? { totalRegistros: 0, porEmocao: [] };

      setData(
        EMOTIONS.map((emotion) => ({
          label: emotion.label,
          color: emotion.color,
          value: stats.porEmocao.find((e) => e.humor === emotion.id)?.total ?? 0,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar as emoções.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.stateCard}>
        <ActivityIndicator size="small" color="#285A71" />
        <Text style={styles.stateText}>Carregando emoções...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.stateCard}>
        <Text style={styles.stateText}>{error}</Text>
        <TouchableOpacity onPress={load} activeOpacity={0.7}>
          <Text style={styles.retry}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Sem registros: o PieChartCard já exibe o estado "Sem dados"
  return (
    <PieChartCard
      title="Emoções da Equipe"
      subtitle="Total de registros de humor por emoção"
      data={data}
      size={140}
    />
  );
}

const styles = StyleSheet.create({
  stateCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    gap: 8,
  },
  stateText: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
  },
  retry: {
    fontSize: 12,
    fontWeight: "700",
    color: "#285A71",
  },
});
