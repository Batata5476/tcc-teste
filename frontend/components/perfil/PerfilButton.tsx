import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";

type PerfilButtonProps = {
  text: string;
  onPress: () => void;
  type: "cancel" | "confirm";
};

export default function PerfilButton({ text, onPress, type }: PerfilButtonProps) {
  const isConfirm = type === "confirm";

  return (
    <TouchableOpacity
      style={isConfirm ? styles.confirmButton : styles.cancelButton}
      onPress={onPress}
    >
      <Text style={isConfirm ? styles.confirmText : styles.cancelText}>
        {text}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cancelButton: {
    height: 35,
    paddingHorizontal: 13,
    justifyContent: "center",
    alignItems: "center",
  },

  cancelText: {
    fontSize: 10,
    color: "#285A71",
    fontWeight: "500",
  },

  confirmButton: {
    height: 35,
    paddingHorizontal: 13,
    borderRadius: 6,
    backgroundColor: "#285A71",
    justifyContent: "center",
    alignItems: "center",
  },

  confirmText: {
    fontSize: 10,
    color: "#FFFFFF",
    fontWeight: "500",
  },
});