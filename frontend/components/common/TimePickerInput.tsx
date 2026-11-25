import React, { useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

type TimePickerInputProps = {
  value: string; // "HH:MM"
  onChange: (time: string) => void;
  label?: string;
  placeholder?: string;
};

const COMMON_TIMES = ["09:00", "10:30", "14:00", "16:00"];

export default function TimePickerInput({
  value,
  onChange,
  label = "Horário",
  placeholder = "14:00",
}: TimePickerInputProps) {
  const [focused, setFocused] = useState(false);

  const handleTextChange = (text: string) => {
    // Remove tudo que não for dígito
    const digits = text.replace(/\D/g, "").slice(0, 4);

    if (digits.length === 0) {
      onChange("");
      return;
    }

    if (digits.length <= 2) {
      // Valida hora máxima 23
      const hourNum = parseInt(digits, 10);
      if (hourNum > 23) {
        onChange("23");
        return;
      }
      onChange(digits);
      return;
    }

    // Com mais de 2 dígitos: formata HH:MM
    let hh = digits.slice(0, 2);
    let mm = digits.slice(2);

    if (parseInt(hh, 10) > 23) hh = "23";
    if (parseInt(mm, 10) > 59) mm = "59";

    onChange(`${hh}:${mm}`);
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={[styles.inputWrapper, focused && styles.inputWrapperFocused]}>
        <Ionicons name="time-outline" size={18} color="#285A71" style={styles.icon} />
        <TextInput
          style={[
            styles.textInput,
            Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null,
          ]}
          value={value}
          onChangeText={handleTextChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          keyboardType="numeric"
          maxLength={5}
        />
      </View>

      {/* Chips Rápidos de Horário */}
      <View style={styles.chipRow}>
        {COMMON_TIMES.map((timeOption) => {
          const isSelected = value === timeOption;
          return (
            <TouchableOpacity
              key={timeOption}
              style={[styles.chip, isSelected && styles.chipActive]}
              onPress={() => onChange(timeOption)}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                {timeOption}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#285A71",
    marginBottom: 8,
    marginTop: 12,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECEFD9",
    height: 48,
    borderRadius: 12,
    borderWidth: 0.8,
    borderColor: "#285A71",
    paddingHorizontal: 10,
  },
  inputWrapperFocused: {
    borderWidth: 1.8,
    borderColor: "#285A71",
    backgroundColor: "#F6F8EC",
  },
  icon: {
    marginRight: 6,
  },
  textInput: {
    flex: 1,
    height: 48,
    paddingVertical: 0,
    fontSize: 14,
    fontWeight: "700",
    color: "#285A71",
    letterSpacing: 1,
  },
  chipRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
  },
  chip: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "#ECEFD9",
    borderWidth: 0.5,
    borderColor: "#CBD5E1",
  },
  chipActive: {
    backgroundColor: "#285A71",
    borderColor: "#285A71",
  },
  chipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#285A71",
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
});
