import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type PerfilAvatarProps = {
  fotoUrl?: string | null;
  onPickPhoto?: () => void;
  uploading?: boolean;
};

export default function PerfilAvatar({
  fotoUrl,
  onPickPhoto,
  uploading = false,
}: PerfilAvatarProps) {
  return (
    <View style={styles.photoContainer}>
      <TouchableOpacity
        style={styles.avatarWrapper}
        onPress={onPickPhoto}
        activeOpacity={0.85}
        disabled={!onPickPhoto || uploading}
      >
        <View style={styles.avatar}>
          {fotoUrl ? (
            <Image
              source={{ uri: fotoUrl }}
              style={styles.avatarImage}
              resizeMode="cover"
            />
          ) : (
            <Ionicons name="person" size={50} color="#FFFFFF" />
          )}
        </View>

        {onPickPhoto && (
          <View style={styles.cameraBadge}>
            <Ionicons name="camera" size={14} color="#FFFFFF" />
          </View>
        )}
      </TouchableOpacity>

      {uploading ? (
        <Text style={styles.uploadText}>Salvando foto...</Text>
      ) : onPickPhoto ? (
        <Text style={styles.hintText}>Toque no avatar para alterar foto</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  photoContainer: {
    height: 140,
    marginHorizontal: 20,
    borderRadius: 16,
    backgroundColor: "#285A71",
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    marginVertical: 10,
  },
  avatarWrapper: {
    position: "relative",
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#1D4253",
    borderWidth: 3,
    borderColor: "#ECEFDA",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  cameraBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    backgroundColor: "#2A5768",
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "#ECEFDA",
    justifyContent: "center",
    alignItems: "center",
  },
  uploadText: {
    marginTop: 6,
    fontSize: 11,
    color: "#ECEFDA",
    fontWeight: "600",
  },
  hintText: {
    marginTop: 6,
    fontSize: 10,
    color: "#ECEFDA",
    opacity: 0.9,
  },
});