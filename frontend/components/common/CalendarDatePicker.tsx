import React, { useState } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

type CalendarDatePickerProps = {
  value: string; // "YYYY-MM-DD"
  onChange: (date: string) => void;
  label?: string;
};

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const WEEK_DAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

export default function CalendarDatePicker({
  value,
  onChange,
  label = "Data da Reunião",
}: CalendarDatePickerProps) {
  const [modalVisible, setModalVisible] = useState(false);

  // Inicializa ano e mês baseados no valor atual ou na data de hoje
  const parsedDate = value ? new Date(value + "T12:00:00") : new Date();
  const [currentYear, setCurrentYear] = useState(parsedDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(parsedDate.getMonth());

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Calcula os dias do mês
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();

  // Dias em branco antes do primeiro dia
  const blankDays = Array.from({ length: firstDayIndex }, (_, i) => i);
  // Dias do mês
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return "Selecionar data";
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return dateStr;
    const dateObj = new Date(y, m - 1, d, 12, 0, 0);
    const dayOfWeek = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][dateObj.getDay()];
    return `${dayOfWeek}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
  };

  const handleSelectDay = (day: number) => {
    const mm = String(currentMonth + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    const selected = `${currentYear}-${mm}-${dd}`;
    onChange(selected);
    setModalVisible(false);
  };

  const handleQuickSelect = (daysFromToday: number) => {
    const target = new Date();
    target.setDate(target.getDate() + daysFromToday);
    const y = target.getFullYear();
    const m = String(target.getMonth() + 1).padStart(2, "0");
    const d = String(target.getDate()).padStart(2, "0");
    onChange(`${y}-${m}-${d}`);
    setModalVisible(false);
  };

  const today = new Date();
  const isToday = (day: number) =>
    today.getFullYear() === currentYear &&
    today.getMonth() === currentMonth &&
    today.getDate() === day;

  const isSelected = (day: number) => {
    if (!value) return false;
    const [y, m, d] = value.split("-").map(Number);
    return y === currentYear && m === currentMonth + 1 && d === day;
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <TouchableOpacity
        style={styles.pickerButton}
        activeOpacity={0.7}
        onPress={() => {
          if (value) {
            const [y, m] = value.split("-").map(Number);
            if (y && m) {
              setCurrentYear(y);
              setCurrentMonth(m - 1);
            }
          }
          setModalVisible(true);
        }}
      >
        <Ionicons name="calendar-outline" size={17} color="#285A71" />
        <Text
          style={[styles.pickerText, !value && styles.pickerPlaceholder]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {formatDisplayDate(value)}
        </Text>
        <Ionicons name="chevron-down" size={14} color="#64748B" style={styles.chevron} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.calendarCard} onPress={(e) => e.stopPropagation()}>
            {/* Header com Navegação do Mês */}
            <View style={styles.headerRow}>
              <TouchableOpacity
                onPress={handlePrevMonth}
                style={styles.navButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="chevron-back" size={20} color="#285A71" />
              </TouchableOpacity>

              <Text style={styles.monthTitle}>
                {MONTH_NAMES[currentMonth]} {currentYear}
              </Text>

              <TouchableOpacity
                onPress={handleNextMonth}
                style={styles.navButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="chevron-forward" size={20} color="#285A71" />
              </TouchableOpacity>
            </View>

            {/* Dias da Semana */}
            <View style={styles.weekRow}>
              {WEEK_DAYS.map((wd, index) => (
                <Text
                  key={index}
                  style={[
                    styles.weekDayText,
                    (index === 0 || index === 6) && styles.weekendText,
                  ]}
                >
                  {wd}
                </Text>
              ))}
            </View>

            {/* Grade de Dias */}
            <View style={styles.daysGrid}>
              {blankDays.map((_, i) => (
                <View key={`blank-${i}`} style={styles.dayCell} />
              ))}

              {monthDays.map((day) => {
                const selected = isSelected(day);
                const todayDay = isToday(day);

                return (
                  <TouchableOpacity
                    key={`day-${day}`}
                    style={[
                      styles.dayCell,
                      styles.dayButton,
                      todayDay && styles.todayCell,
                      selected && styles.selectedCell,
                    ]}
                    onPress={() => handleSelectDay(day)}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        todayDay && styles.todayText,
                        selected && styles.selectedText,
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Atalhos Rápidos */}
            <View style={styles.quickShortcuts}>
              <TouchableOpacity
                style={styles.shortcutBtn}
                onPress={() => handleQuickSelect(0)}
              >
                <Text style={styles.shortcutText}>Hoje</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shortcutBtn}
                onPress={() => handleQuickSelect(1)}
              >
                <Text style={styles.shortcutText}>Amanhã</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shortcutBtn}
                onPress={() => handleQuickSelect(7)}
              >
                <Text style={styles.shortcutText}>+1 Semana</Text>
              </TouchableOpacity>
            </View>

            {/* Botão Fechar */}
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeBtnText}>Fechar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
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
  pickerButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECEFD9",
    height: 48,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: "#285A71",
  },
  pickerText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#285A71",
    marginLeft: 6,
    flex: 1,
  },
  pickerPlaceholder: {
    color: "#94A3B8",
    fontWeight: "500",
  },
  chevron: {
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 43, 61, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  calendarCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FEFDF9",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#ECEFD9",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#285A71",
    textTransform: "capitalize",
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ECEFD9",
    justifyContent: "center",
    alignItems: "center",
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  weekDayText: {
    width: 38,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  weekendText: {
    color: "#94A3B8",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  dayCell: {
    width: 38,
    height: 38,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 3,
  },
  dayButton: {
    borderRadius: 12,
  },
  todayCell: {
    borderWidth: 1.5,
    borderColor: "#285A71",
  },
  selectedCell: {
    backgroundColor: "#285A71",
  },
  dayText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
  },
  todayText: {
    color: "#285A71",
    fontWeight: "800",
  },
  selectedText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  quickShortcuts: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#ECEFD9",
  },
  shortcutBtn: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: "#ECEFD9",
    borderRadius: 10,
    alignItems: "center",
  },
  shortcutText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#285A71",
  },
  closeBtn: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  closeBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
});
