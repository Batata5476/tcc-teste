import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  Platform,
  StyleProp,
  ViewStyle,
} from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";

type PerfilActionProps = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title?: string;
  text?: string;
  subtitle?: string;
  onAdd?: () => void;
  onPress?: () => void;
  showAdd?: boolean;
  style?: StyleProp<ViewStyle>;
  badge?: string;
};

// Subtítulos padrão para harmonia com o estilo de cards
const DEFAULT_SUBTITLES: Record<string, string> = {
  "solicitar reunião": "Agende um horário",
  "dados trabalhistas": "Consulte seus dados",
  "salário e banco de horas": "Consulte seus dados",
  "sistema de pontuações": "Acompanhe seus pontos",
  "histórico médico e ausências": "Saúde e ausências",
  "histórico médico": "Saúde e ausências",
  "registro de humor & bem-estar": "Registre como se sente",
  "humor e bem-estar": "Registre como se sente",
  "ver minhas tarefas": "Veja suas pendências",
  "minhas tarefas": "Veja suas pendências",
  "cadastro de funcionário": "Admissão e novos acessos",
  "cadastro de equipe": "Admissão e novos acessos",
  "gestão de funcionários": "Colaboradores e cargos",
  "gestão da equipe": "Colaboradores e cargos",
  "backup e restauração da empresa": "Cópias de segurança",
  "backup da empresa": "Cópias de segurança",
  "definir localização da empresa": "GPS da sede para ponto (50m)",
  "localização da empresa": "GPS da sede para ponto (50m)",
  "relatar ocorrência": "Comunique um problema ao RH",
};

function formatTitle(raw?: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export default function PerfilAction({
  icon,
  title,
  text,
  subtitle,
  onAdd,
  onPress,
  showAdd = false,
  style,
  badge,
}: PerfilActionProps) {
  const [hovered, setHovered] = useState(false);
  const { width } = useWindowDimensions();

  // Layout responsivo que preenche 100% da tela sem sobrar espaços vazios
  const isSmallPhone = width < 360;
  const isWideScreen = width >= 1100;

  let responsiveBasis = "48%";
  if (isSmallPhone) {
    responsiveBasis = "100%";
  } else if (isWideScreen) {
    responsiveBasis = "31.8%";
  }

  const rawTitle = title || text || "";
  const displayTitle = formatTitle(rawTitle);
  const normalizedKey = rawTitle.toLowerCase().trim();
  const displaySubtitle = subtitle || DEFAULT_SUBTITLES[normalizedKey] || "";

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { flexBasis: responsiveBasis as any },
        hovered && styles.cardHovered,
        style,
      ]}
      onPress={onPress || onAdd}
      activeOpacity={0.8}
      {...(Platform.OS === "web"
        ? ({
            onMouseEnter: () => setHovered(true),
            onMouseLeave: () => setHovered(false),
          } as any)
        : {})}
    >
      <View style={styles.topRow}>
        <View style={styles.iconBox}>
          <Ionicons name={icon} size={20} color="#FFFFFF" />
        </View>

        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.textContainer}>
        <Text style={styles.title} numberOfLines={2}>
          {displayTitle}
        </Text>
        {displaySubtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {displaySubtitle}
          </Text>
        ) : null}
      </View>

      <View style={styles.arrowContainer}>
        <Feather name="arrow-up-right" size={16} color="#ECEFDA" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#285A71",
    borderRadius: 16,
    padding: 16,
    minHeight: 122,
    flexGrow: 1,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#0F2837",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 3,
    position: "relative",
    marginBottom: 10,
    ...(Platform.OS === "web"
      ? {
          cursor: "pointer",
          transition: "all 0.18s ease-in-out",
        }
      : {}),
  },
  cardHovered: {
    backgroundColor: "#1F4A5E",
    borderColor: "rgba(255, 255, 255, 0.28)",
    transform: [{ translateY: -2 }],
    shadowOpacity: 0.22,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    justifyContent: "center",
    alignItems: "center",
  },
  badge: {
    backgroundColor: "#ECEFDA",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#285A71",
  },
  textContainer: {
    marginTop: 12,
    paddingRight: 22,
  },
  title: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#FFFFFF",
    lineHeight: 19,
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 12,
    color: "#D8E7EE",
    lineHeight: 16,
    fontWeight: "400",
  },
  arrowContainer: {
    position: "absolute",
    bottom: 12,
    right: 12,
  },
});