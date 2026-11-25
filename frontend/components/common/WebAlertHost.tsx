import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

/**
 * No react-native-web, Alert.alert() não faz nada. Este módulo substitui Alert.alert
 * na versão web por um modal próprio (funciona no Safari do iPhone e no Chrome do Android),
 * mantendo o mesmo uso nas telas: Alert.alert(titulo, mensagem, botoes).
 */

type AlertButton = {
  text?: string;
  onPress?: (value?: string) => void;
  style?: "default" | "cancel" | "destructive";
};

type AlertRequest = {
  title: string;
  message?: string;
  buttons: AlertButton[];
  cancelable: boolean;
};

const pending: AlertRequest[] = [];
let listener: (() => void) | null = null;
let installed = false;

export function installWebAlert() {
  if (installed || Platform.OS !== "web") return;
  installed = true;

  (Alert as any).alert = (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: { cancelable?: boolean }
  ) => {
    pending.push({
      title: title ?? "",
      message,
      buttons: buttons && buttons.length > 0 ? buttons : [{ text: "OK" }],
      cancelable: options?.cancelable ?? true,
    });
    listener?.();
  };
}

installWebAlert();

export default function WebAlertHost() {
  const currentRef = useRef<AlertRequest | null>(null);
  const [current, setCurrent] = useState<AlertRequest | null>(null);

  const pump = useCallback(() => {
    if (currentRef.current) return;
    const next = pending.shift() ?? null;
    currentRef.current = next;
    setCurrent(next);
  }, []);

  useEffect(() => {
    listener = pump;
    pump();
    return () => {
      if (listener === pump) listener = null;
    };
  }, [pump]);

  const close = (button?: AlertButton) => {
    currentRef.current = null;
    setCurrent(null);
    try {
      button?.onPress?.();
    } finally {
      setTimeout(pump, 0);
    }
  };

  if (!current) return null;

  const stacked = current.buttons.length > 2;
  const cancelButton = current.buttons.find((b) => b.style === "cancel");

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (current.cancelable) close(cancelButton);
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.box}>
          {current.title ? <Text style={styles.title}>{current.title}</Text> : null}
          {current.message ? <Text style={styles.message}>{current.message}</Text> : null}

          <View style={[styles.buttons, stacked && styles.buttonsStacked]}>
            {current.buttons.map((button, index) => {
              const isCancel = button.style === "cancel";
              const isDestructive = button.style === "destructive";
              return (
                <TouchableOpacity
                  key={`${button.text ?? "ok"}-${index}`}
                  activeOpacity={0.85}
                  onPress={() => close(button)}
                  style={[
                    styles.button,
                    stacked ? styles.buttonStacked : styles.buttonInline,
                    isCancel && styles.buttonCancel,
                    isDestructive && styles.buttonDestructive,
                  ]}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      isCancel && styles.buttonTextCancel,
                    ]}
                  >
                    {button.text ?? "OK"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 43, 61, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  box: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 22,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F2B3D",
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: "#475569",
    marginBottom: 18,
  },
  buttons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  buttonsStacked: {
    flexDirection: "column",
  },
  button: {
    backgroundColor: "#285A71",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  buttonInline: {
    flexGrow: 1,
    flexBasis: 0,
  },
  buttonStacked: {
    width: "100%",
  },
  buttonCancel: {
    backgroundColor: "#F1F5F9",
  },
  buttonDestructive: {
    backgroundColor: "#DC2626",
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  buttonTextCancel: {
    color: "#475569",
  },
});
