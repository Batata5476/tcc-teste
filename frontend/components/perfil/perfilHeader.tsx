import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { logout } from "../../services/auth";

type PerfilHeaderProps = {
  onBack?: () => void;
  onLogout?: () => void;
};

export default function PerfilHeader({ onBack, onLogout }: PerfilHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.replace("/dashboard");
    }
  };

  const handleLogout = async () => {
    if (onLogout) {
      onLogout();
    } else {
      await logout();
      router.replace("/");
    }
  };

  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.headerButton} onPress={handleBack}>
        <Ionicons name="arrow-back" size={22} color="#285A71" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.headerButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={22} color="#285A71" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 52,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#ECEFDA",
    justifyContent: "center",
    alignItems: "center",
  },
});
