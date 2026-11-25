import React, { useState, useEffect, useMemo } from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  RefreshControl,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { authenticatedFetch } from "../services/api";

type Employee = {
  id: number;
  nome: string;
  email: string;
  cpf?: string;
  cargo?: string;
  status: string; // "ACTIVE" | "PENDING" | "BLOCKED" | "DISABLED" | "DELETED"
  foto?: string | null;
  foto_func?: string | null;
  telefone?: string;
  pontos_acumulados?: number;
  role?: { id: number; nome: string };
  setor?: { id: number; nome?: string; nome_setor?: string };
};

type Occurrence = {
  pk_id_his_medico: number;
  atestado_func?: string | null;
  ocorrencias?: string | null;
  fk_id_func: number;
};

export default function GestaoFuncionariosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<"todos" | "ativos" | "inativos" | "faltas">("todos");

  // Modal de Detalhes do Colaborador
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);

  // Modal de Registrar Falta / Ocorrência
  const [isRegisteringOccurrence, setIsRegisteringOccurrence] = useState(false);
  const [occurrenceReason, setOccurrenceReason] = useState("");
  const [savingOccurrence, setSavingOccurrence] = useState(false);

  // Fallback seguro de navegação para voltar
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/perfilAdm");
    }
  };

  // Carrega dados do backend
  const loadData = async () => {
    try {
      setLoading(true);
      const [usersRes, occRes, meRes] = await Promise.all([
        authenticatedFetch("/users"),
        authenticatedFetch("/occurrences").catch(() => null),
        authenticatedFetch("/dashboard/user").catch(() => null),
      ]);

      if (meRes && meRes.ok) {
        const meBody = await meRes.json().catch(() => ({}));
        setCurrentUserId(meBody.data?.id ?? null);
      }

      if (usersRes.ok) {
        const usersBody = await usersRes.json();
        setEmployees(usersBody.data ?? []);
      } else {
        const err = await usersRes.json().catch(() => ({}));
        Alert.alert("Erro", err.message || "Não foi possível carregar os colaboradores.");
      }

      if (occRes && occRes.ok) {
        const occBody = await occRes.json();
        setOccurrences(occBody.data ?? []);
      }
    } catch (e) {
      console.error("Erro ao carregar colaboradores:", e);
      Alert.alert("Erro", "Falha de conexão com o servidor.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Mapa de contagem de faltas/ocorrências por ID de funcionário
  const occurrenceCountByFunc = useMemo(() => {
    const map: Record<number, number> = {};
    occurrences.forEach((occ) => {
      if (occ && occ.fk_id_func) {
        map[occ.fk_id_func] = (map[occ.fk_id_func] || 0) + 1;
      }
    });
    return map;
  }, [occurrences]);

  // Totais para os cards de métricas (KPIs)
  const totalCount = employees.length;
  const activeCount = employees.filter((e) => e.status === "ACTIVE").length;
  const inactiveCount = employees.filter((e) => e.status !== "ACTIVE").length;
  const totalOccurrences = occurrences.length;

  // Filtragem da lista
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      // Filtro de status
      if (selectedFilter === "ativos" && emp.status !== "ACTIVE") return false;
      if (selectedFilter === "inativos" && emp.status === "ACTIVE") return false;
      if (selectedFilter === "faltas" && (occurrenceCountByFunc[emp.id] || 0) === 0) return false;

      // Filtro de busca
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;

      const nameMatch = emp.nome?.toLowerCase().includes(q);
      const emailMatch = emp.email?.toLowerCase().includes(q);
      const cargoMatch = emp.cargo?.toLowerCase().includes(q);
      const setorName = emp.setor?.nome || emp.setor?.nome_setor;
      const setorMatch = setorName?.toLowerCase().includes(q);
      const cpfMatch = emp.cpf?.includes(q);

      return nameMatch || emailMatch || cargoMatch || setorMatch || cpfMatch;
    });
  }, [employees, selectedFilter, searchQuery, occurrenceCountByFunc]);

  const isProtectedAdminAccount = (emp: Employee) =>
    emp.id === currentUserId || emp.role?.nome === "Administrador Master";

  // Alterna status do funcionário (Ativo / Inativo) com suporte 100% funcional na Web e Mobile
  const handleToggleStatus = (employee: Employee) => {
    if (isProtectedAdminAccount(employee)) {
      Alert.alert(
        "Conta Protegida",
        "A conta principal ou sua própria sessão ativa não pode ser desativada."
      );
      return;
    }
    const isCurrentlyActive = employee.status === "ACTIVE";
    const newStatus = isCurrentlyActive ? "DISABLED" : "ACTIVE";
    const actionText = isCurrentlyActive ? "Desativar" : "Ativar";

    const executeToggle = async () => {
      try {
        const res = await authenticatedFetch(`/users/${employee.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: newStatus }),
        });

        if (res.ok) {
          // Atualização otimista local
          setEmployees((prev) =>
            prev.map((e) => (e.id === employee.id ? { ...e, status: newStatus } : e))
          );
          if (selectedEmployee?.id === employee.id) {
            setSelectedEmployee((prev) => (prev ? { ...prev, status: newStatus } : null));
          }
          Alert.alert(
            "Sucesso",
            `Colaborador ${isCurrentlyActive ? "desativado" : "ativado"} com sucesso!`
          );
        } else {
          const err = await res.json().catch(() => ({}));
          Alert.alert("Erro", err.message || "Não foi possível alterar o status.");
        }
      } catch (e) {
        Alert.alert("Erro", "Erro ao conectar com o servidor.");
      }
    };

    Alert.alert(
      `${actionText} Colaborador`,
      `Tem certeza que deseja ${actionText.toLowerCase()} o acesso de ${employee.nome}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: actionText,
          style: isCurrentlyActive ? "destructive" : "default",
          onPress: executeToggle,
        },
      ]
    );
  };

  // Abre modal de detalhes
  const handleOpenDetails = (employee: Employee, startOccurrence = false) => {
    setSelectedEmployee(employee);
    setDetailsModalVisible(true);
    setIsRegisteringOccurrence(startOccurrence);
    setOccurrenceReason("");
  };

  // Salva nova ocorrência / falta
  const handleSaveOccurrence = async () => {
    if (!selectedEmployee) return;
    if (!occurrenceReason.trim()) {
      Alert.alert("Atenção", "Informe a descrição ou motivo da falta/ocorrência.");
      return;
    }

    try {
      setSavingOccurrence(true);
      const res = await authenticatedFetch("/occurrences", {
        method: "POST",
        body: JSON.stringify({
          fk_id_func: selectedEmployee.id,
          ocorrencias: occurrenceReason.trim(),
        }),
      });

      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        const newOcc: Occurrence | undefined = body?.data;
        if (newOcc && newOcc.pk_id_his_medico) {
          setOccurrences((prev) => [
            newOcc,
            ...prev.filter((o) => o?.pk_id_his_medico !== newOcc.pk_id_his_medico),
          ]);
        } else {
          loadData();
        }
        setOccurrenceReason("");
        setIsRegisteringOccurrence(false);
        Alert.alert("Sucesso", "Falta/ocorrência registrada com sucesso!");
      } else {
        const err = await res.json().catch(() => ({}));
        let errorMsg = "Não foi possível registrar a ocorrência.";
        if (Array.isArray(err?.message)) {
          errorMsg = err.message.join("\n");
        } else if (typeof err?.message === "string") {
          errorMsg = err.message;
        }
        Alert.alert("Erro", errorMsg);
      }
    } catch (e) {
      Alert.alert("Erro", "Erro de conexão ao salvar ocorrência.");
    } finally {
      setSavingOccurrence(false);
    }
  };

  // Ocorrências do colaborador selecionado no modal
  const selectedEmpOccurrences = useMemo(() => {
    if (!selectedEmployee) return [];
    return occurrences.filter((occ) => occ && occ.fk_id_func === selectedEmployee.id);
  }, [occurrences, selectedEmployee]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={[styles.container, { paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 20) : 0 }]}>
        {/* Cabeçalho */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={handleBack}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color="#285A71" />
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitle}>Gestão de Colaboradores</Text>
            <Text style={styles.headerSubtitle}>
              Painel administrativo de status e frequência
            </Text>
          </View>

          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push("/cadastroFuncionario")}
            activeOpacity={0.8}
          >
            <Ionicons name="person-add" size={18} color="#FFFFFF" />
            <Text style={styles.addBtnText}>Novo</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#285A71"]}
              tintColor="#285A71"
            />
          }
        >
          {/* Cards de Métricas / KPIs Interativos como Filtros Rápidos */}
          <View style={styles.kpiContainer}>
            <TouchableOpacity
              style={[
                styles.kpiCard,
                styles.kpiTotal,
                selectedFilter === "todos" && styles.kpiCardSelected,
              ]}
              onPress={() => setSelectedFilter("todos")}
              activeOpacity={0.7}
            >
              <View style={styles.kpiIconBox}>
                <Ionicons name="people" size={20} color="#285A71" />
              </View>
              <Text style={styles.kpiValue}>{totalCount}</Text>
              <Text style={styles.kpiLabel}>Total</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.kpiCard,
                styles.kpiActive,
                selectedFilter === "ativos" && styles.kpiCardSelected,
              ]}
              onPress={() => setSelectedFilter("ativos")}
              activeOpacity={0.7}
            >
              <View style={[styles.kpiIconBox, { backgroundColor: "#DCFCE7" }]}>
                <Ionicons name="checkmark-circle" size={20} color="#15803D" />
              </View>
              <Text style={[styles.kpiValue, { color: "#15803D" }]}>{activeCount}</Text>
              <Text style={styles.kpiLabel}>Ativos</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.kpiCard,
                styles.kpiInactive,
                selectedFilter === "inativos" && styles.kpiCardSelected,
              ]}
              onPress={() => setSelectedFilter("inativos")}
              activeOpacity={0.7}
            >
              <View style={[styles.kpiIconBox, { backgroundColor: "#FEE2E2" }]}>
                <Ionicons name="close-circle" size={20} color="#B91C1C" />
              </View>
              <Text style={[styles.kpiValue, { color: "#B91C1C" }]}>{inactiveCount}</Text>
              <Text style={styles.kpiLabel}>Inativos</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.kpiCard,
                styles.kpiAlert,
                selectedFilter === "faltas" && styles.kpiCardSelected,
              ]}
              onPress={() => setSelectedFilter("faltas")}
              activeOpacity={0.7}
            >
              <View style={[styles.kpiIconBox, { backgroundColor: "#FEF3C7" }]}>
                <Ionicons name="warning" size={20} color="#B45309" />
              </View>
              <Text style={[styles.kpiValue, { color: "#B45309" }]}>{totalOccurrences}</Text>
              <Text style={styles.kpiLabel}>Faltas / Ocorr.</Text>
            </TouchableOpacity>
          </View>

          {/* Barra de Pesquisa */}
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color="#64748B" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por nome, cargo ou e-mail..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Filtros em Abas */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, selectedFilter === "todos" && styles.tabButtonActive]}
              onPress={() => setSelectedFilter("todos")}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, selectedFilter === "todos" && styles.tabTextActive]}>
                Todos ({totalCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, selectedFilter === "ativos" && styles.tabButtonActive]}
              onPress={() => setSelectedFilter("ativos")}
              activeOpacity={0.7}
            >
              <View style={[styles.tabDot, { backgroundColor: "#10B981" }]} />
              <Text style={[styles.tabText, selectedFilter === "ativos" && styles.tabTextActive]}>
                Ativos ({activeCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, selectedFilter === "inativos" && styles.tabButtonActive]}
              onPress={() => setSelectedFilter("inativos")}
              activeOpacity={0.7}
            >
              <View style={[styles.tabDot, { backgroundColor: "#EF4444" }]} />
              <Text style={[styles.tabText, selectedFilter === "inativos" && styles.tabTextActive]}>
                Inativos ({inactiveCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, selectedFilter === "faltas" && styles.tabButtonActive]}
              onPress={() => setSelectedFilter("faltas")}
              activeOpacity={0.7}
            >
              <View style={[styles.tabDot, { backgroundColor: "#D97706" }]} />
              <Text style={[styles.tabText, selectedFilter === "faltas" && styles.tabTextActive]}>
                Faltas ({employees.filter((e) => (occurrenceCountByFunc[e.id] || 0) > 0).length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Lista de Colaboradores */}
          {loading && !refreshing ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#285A71" />
              <Text style={styles.loadingText}>Carregando quadro de colaboradores...</Text>
            </View>
          ) : filteredEmployees.length === 0 ? (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="people-outline" size={40} color="#285A71" />
              </View>
              <Text style={styles.emptyTitle}>Nenhum colaborador encontrado</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? "Tente buscar com outro termo ou limpe o campo de busca."
                  : "Não há colaboradores cadastrados nesta categoria."}
              </Text>
            </View>
          ) : (
            filteredEmployees.map((emp) => {
              const isActive = emp.status === "ACTIVE";
              const occCount = occurrenceCountByFunc[emp.id] || 0;
              const userPhoto = emp.foto || emp.foto_func;

              return (
                <TouchableOpacity
                  key={emp.id}
                  style={styles.employeeCard}
                  activeOpacity={0.88}
                  onPress={() => handleOpenDetails(emp)}
                >
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.avatarRow}>
                      <View style={[styles.avatarBox, isActive ? styles.avatarBoxActive : styles.avatarBoxInactive]}>
                        {userPhoto ? (
                          <Image source={{ uri: userPhoto }} style={styles.avatarImg} />
                        ) : (
                          <Text style={styles.avatarInitials}>
                            {emp.nome ? emp.nome.slice(0, 2).toUpperCase() : "CO"}
                          </Text>
                        )}
                      </View>

                      <View style={styles.employeeInfo}>
                        <Text style={styles.employeeName} numberOfLines={1}>
                          {emp.nome}
                        </Text>
                        <Text style={styles.employeeRole} numberOfLines={1}>
                          {emp.cargo || emp.role?.nome || "Colaborador"}
                          {emp.setor?.nome || emp.setor?.nome_setor
                            ? ` • ${emp.setor?.nome || emp.setor?.nome_setor}`
                            : ""}
                        </Text>
                      </View>
                    </View>

                    {/* Status Badge */}
                    <View style={[styles.statusBadge, isActive ? styles.statusBadgeActive : styles.statusBadgeInactive]}>
                      <View style={[styles.statusDot, isActive ? styles.statusDotActive : styles.statusDotInactive]} />
                      <Text style={[styles.statusText, isActive ? styles.statusTextActive : styles.statusTextInactive]}>
                        {isActive ? "Ativo" : emp.status === "PENDING" ? "Pendente" : "Inativo"}
                      </Text>
                    </View>
                  </View>

                  {/* Informações Rápidas e Faltas */}
                  <View style={styles.cardStatsRow}>
                    <View style={styles.statChip}>
                      <Ionicons
                        name={occCount > 0 ? "warning-outline" : "checkmark-done-outline"}
                        size={15}
                        color={occCount > 0 ? "#D97706" : "#10B981"}
                      />
                      <Text style={[styles.statChipText, occCount > 0 && { color: "#B45309", fontWeight: "700" }]}>
                        {occCount === 0 ? "0 faltas registradas" : `${occCount} ${occCount === 1 ? "falta/ocorrência" : "faltas/ocorrências"}`}
                      </Text>
                    </View>

                    <View style={styles.statChip}>
                      <Ionicons name="trophy-outline" size={14} color="#D97706" />
                      <Text style={styles.statChipText}>
                        {emp.pontos_acumulados ?? 0} pts
                      </Text>
                    </View>
                  </View>

                  {/* Botões de Ação do Card */}
                  <View style={styles.cardActionsRow}>
                    {!isProtectedAdminAccount(emp) && (
                      <TouchableOpacity
                        style={[
                          styles.toggleStatusBtn,
                          isActive ? styles.toggleStatusBtnDeactivate : styles.toggleStatusBtnActivate,
                        ]}
                        activeOpacity={0.8}
                        onPress={() => handleToggleStatus(emp)}
                      >
                        <Ionicons
                          name={isActive ? "ban-outline" : "checkmark-circle-outline"}
                          size={14}
                          color={isActive ? "#B91C1C" : "#15803D"}
                        />
                        <Text
                          style={[
                            styles.toggleStatusBtnText,
                            isActive ? { color: "#B91C1C" } : { color: "#15803D" },
                          ]}
                        >
                          {isActive ? "Desativar" : "Ativar"}
                        </Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={styles.cardAddOccBtn}
                      activeOpacity={0.8}
                      onPress={() => handleOpenDetails(emp, true)}
                    >
                      <Ionicons name="add-circle" size={14} color="#B45309" />
                      <Text style={styles.cardAddOccBtnText}>+ Falta</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.detailsBtn}
                      activeOpacity={0.8}
                      onPress={() => handleOpenDetails(emp, false)}
                    >
                      <Text style={styles.detailsBtnText}>Detalhes</Text>
                      <Ionicons name="chevron-forward" size={13} color="#285A71" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        {/* ─── Modal de Detalhes e Ocorrências do Colaborador ───────────── */}
        <Modal
          visible={detailsModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setDetailsModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              {/* Header do Modal */}
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderInfo}>
                  <Text style={styles.modalHeaderTitle}>Ficha do Colaborador</Text>
                  <Text style={styles.modalHeaderSubtitle}>
                    Dados cadastrais e histórico de frequência
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setDetailsModalVisible(false)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="close" size={22} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                style={styles.modalScrollBody}
              >
                {selectedEmployee && (
                  <>
                    {/* Bloco Perfil Topo */}
                    <View style={styles.modalProfileRow}>
                      <View style={styles.modalAvatarLarge}>
                        {selectedEmployee.foto || selectedEmployee.foto_func ? (
                          <Image
                            source={{ uri: (selectedEmployee.foto || selectedEmployee.foto_func)! }}
                            style={styles.modalAvatarLargeImg}
                          />
                        ) : (
                          <Text style={styles.modalAvatarLargeText}>
                            {selectedEmployee.nome ? selectedEmployee.nome.slice(0, 2).toUpperCase() : "CO"}
                          </Text>
                        )}
                      </View>

                      <View style={styles.modalProfileTextGroup}>
                        <Text style={styles.modalProfileName}>{selectedEmployee.nome}</Text>
                        <Text style={styles.modalProfileRole}>
                          {selectedEmployee.cargo || selectedEmployee.role?.nome || "Colaborador"}
                        </Text>
                        <View
                          style={[
                            styles.statusBadge,
                            selectedEmployee.status === "ACTIVE"
                              ? styles.statusBadgeActive
                              : styles.statusBadgeInactive,
                            { alignSelf: "flex-start", marginTop: 4 },
                          ]}
                        >
                          <View
                            style={[
                              styles.statusDot,
                              selectedEmployee.status === "ACTIVE"
                                ? styles.statusDotActive
                                : styles.statusDotInactive,
                            ]}
                          />
                          <Text
                            style={[
                              styles.statusText,
                              selectedEmployee.status === "ACTIVE"
                                ? styles.statusTextActive
                                : styles.statusTextInactive,
                            ]}
                          >
                            {selectedEmployee.status === "ACTIVE" ? "Colaborador Ativo" : "Acesso Inativo"}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Dados de Contato e Sistema */}
                    <View style={styles.infoSection}>
                      <Text style={styles.infoSectionTitle}>Informações Gerais</Text>

                      <View style={styles.infoItemRow}>
                        <Ionicons name="mail-outline" size={16} color="#285A71" />
                        <Text style={styles.infoItemLabel}>E-mail:</Text>
                        <Text style={styles.infoItemValue} numberOfLines={1}>
                          {selectedEmployee.email}
                        </Text>
                      </View>

                      {selectedEmployee.cpf ? (
                        <View style={styles.infoItemRow}>
                          <Ionicons name="card-outline" size={16} color="#285A71" />
                          <Text style={styles.infoItemLabel}>CPF:</Text>
                          <Text style={styles.infoItemValue}>{selectedEmployee.cpf}</Text>
                        </View>
                      ) : null}

                      {selectedEmployee.telefone ? (
                        <View style={styles.infoItemRow}>
                          <Ionicons name="call-outline" size={16} color="#285A71" />
                          <Text style={styles.infoItemLabel}>Telefone:</Text>
                          <Text style={styles.infoItemValue}>{selectedEmployee.telefone}</Text>
                        </View>
                      ) : null}

                      <View style={styles.infoItemRow}>
                        <Ionicons name="business-outline" size={16} color="#285A71" />
                        <Text style={styles.infoItemLabel}>Setor:</Text>
                        <Text style={styles.infoItemValue}>
                          {selectedEmployee.setor?.nome || selectedEmployee.setor?.nome_setor || "Geral"}
                        </Text>
                      </View>

                      <View style={styles.infoItemRow}>
                        <Ionicons name="trophy-outline" size={16} color="#D97706" />
                        <Text style={styles.infoItemLabel}>Pontuação:</Text>
                        <Text style={[styles.infoItemValue, { color: "#B45309", fontWeight: "700" }]}>
                          {selectedEmployee.pontos_acumulados ?? 0} pontos
                        </Text>
                      </View>
                    </View>

                    {/* Seção de Faltas e Ocorrências */}
                    <View style={styles.occurrencesSection}>
                      <View style={styles.occurrencesSectionHeader}>
                        <View style={styles.occurrencesTitleGroup}>
                          <Text style={styles.infoSectionTitle}>Faltas & Ocorrências</Text>
                          <View style={styles.occurrencesCountBadge}>
                            <Text style={styles.occurrencesCountText}>
                              {selectedEmpOccurrences.length}
                            </Text>
                          </View>
                        </View>

                        <TouchableOpacity
                          style={[
                            styles.addOccurrenceBtn,
                            isRegisteringOccurrence && styles.addOccurrenceBtnClose,
                          ]}
                          activeOpacity={0.8}
                          onPress={() => setIsRegisteringOccurrence((prev) => !prev)}
                        >
                          <Ionicons
                            name={isRegisteringOccurrence ? "close" : "add"}
                            size={16}
                            color={isRegisteringOccurrence ? "#DC2626" : "#FFFFFF"}
                          />
                          <Text
                            style={[
                              styles.addOccurrenceBtnText,
                              isRegisteringOccurrence && styles.addOccurrenceBtnCloseText,
                            ]}
                          >
                            {isRegisteringOccurrence ? "Fechar" : "Lançar Falta"}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Formulário para registrar nova ocorrência */}
                      {isRegisteringOccurrence && (
                        <View style={styles.newOccurrenceBox}>
                          <View style={styles.newOccurrenceHeader}>
                            <Ionicons name="alert-circle" size={18} color="#B45309" />
                            <Text style={styles.newOccurrenceTitle}>
                              Registrar Falta ou Ocorrência
                            </Text>
                          </View>

                          {/* Chips Rápidos de Seleção */}
                          <Text style={styles.quickTagsLabel}>Motivos rápidos (toque para preencher):</Text>
                          <View style={styles.quickTagsContainer}>
                            {["Falta Injustificada", "Atestado Médico", "Atraso", "Advertência", "Suspensão"].map((tag) => (
                              <TouchableOpacity
                                key={tag}
                                style={styles.quickTagChip}
                                activeOpacity={0.7}
                                onPress={() => setOccurrenceReason((prev) => (prev.trim() ? `${prev} - ${tag}` : tag))}
                              >
                                <Text style={styles.quickTagChipText}>{tag}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>

                          <TextInput
                            style={styles.newOccurrenceInput}
                            placeholder="Descreva o motivo ou observações (Ex: Falta injustificada, atestado médico...)"
                            placeholderTextColor="#94A3B8"
                            value={occurrenceReason}
                            onChangeText={setOccurrenceReason}
                            maxLength={255}
                            multiline
                            numberOfLines={3}
                          />

                          <View style={styles.newOccurrenceActions}>
                            <TouchableOpacity
                              style={styles.newOccurrenceCancel}
                              onPress={() => {
                                setIsRegisteringOccurrence(false);
                                setOccurrenceReason("");
                              }}
                              disabled={savingOccurrence}
                            >
                              <Text style={styles.newOccurrenceCancelText}>Cancelar</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[
                                styles.newOccurrenceSubmit,
                                !occurrenceReason.trim() && { opacity: 0.6 },
                              ]}
                              onPress={handleSaveOccurrence}
                              disabled={savingOccurrence || !occurrenceReason.trim()}
                            >
                              {savingOccurrence ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <>
                                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                                  <Text style={styles.newOccurrenceSubmitText}>Confirmar</Text>
                                </>
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}

                      {/* Lista de Ocorrências do Colaborador */}
                      {selectedEmpOccurrences.length === 0 ? (
                        <View style={styles.emptyOccurrencesBox}>
                          <Ionicons name="checkmark-circle-outline" size={32} color="#10B981" />
                          <Text style={styles.emptyOccurrencesTitle}>
                            Nenhuma falta ou ocorrência registrada
                          </Text>
                          <Text style={styles.emptyOccurrencesSubtitle}>
                            Este colaborador possui assiduidade regular e sem apontamentos.
                          </Text>
                        </View>
                      ) : (
                        selectedEmpOccurrences.map((occ, idx) => (
                          <View key={occ.pk_id_his_medico || idx} style={styles.occurrenceItemCard}>
                            <View style={styles.occurrenceItemIcon}>
                              <Ionicons
                                name={occ.atestado_func ? "medkit" : "alert-circle"}
                                size={18}
                                color={occ.atestado_func ? "#3B82F6" : "#EF4444"}
                              />
                            </View>
                            <View style={styles.occurrenceItemDetails}>
                              <Text style={styles.occurrenceItemText}>
                                {occ.ocorrencias || (occ.atestado_func ? "Atestado Médico apresentado" : "Ocorrência / Ausência")}
                              </Text>
                              {occ.atestado_func ? (
                                <Text style={styles.occurrenceItemSub}>
                                  Atestado anexado: {occ.atestado_func}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                        ))
                      )}
                    </View>

                    {/* Botão de Alternar Acesso no Fim do Modal */}
                    {!isProtectedAdminAccount(selectedEmployee) && (
                      <TouchableOpacity
                        style={[
                          styles.modalToggleBtn,
                          selectedEmployee.status === "ACTIVE"
                            ? styles.modalToggleBtnDeactivate
                            : styles.modalToggleBtnActivate,
                        ]}
                        onPress={() => handleToggleStatus(selectedEmployee)}
                        activeOpacity={0.85}
                      >
                        <Ionicons
                          name={selectedEmployee.status === "ACTIVE" ? "ban" : "checkmark-circle"}
                          size={18}
                          color="#FFFFFF"
                        />
                        <Text style={styles.modalToggleBtnText}>
                          {selectedEmployee.status === "ACTIVE"
                            ? "Desativar Acesso do Colaborador"
                            : "Reativar Acesso do Colaborador"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#ECEFD9",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleBox: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#285A71",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 2,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#285A71",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  addBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },

  // KPIs
  kpiContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
  kpiCardSelected: {
    borderWidth: 2,
    borderColor: "#285A71",
    backgroundColor: "#F0F7FA",
    elevation: 3,
  },
  kpiTotal: {
    borderColor: "#CCE3ED",
  },
  kpiActive: {
    borderColor: "#BBF7D0",
  },
  kpiInactive: {
    borderColor: "#FECACA",
  },
  kpiAlert: {
    borderColor: "#FDE68A",
  },
  kpiIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#ECEFD9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#285A71",
  },
  kpiLabel: {
    fontSize: 10.5,
    color: "#64748B",
    fontWeight: "600",
    marginTop: 2,
    textAlign: "center",
  },

  // Barra de Pesquisa
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: "#1E293B",
  },

  // Abas
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#ECEFD9",
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 9,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  tabDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  tabTextActive: {
    color: "#285A71",
    fontWeight: "700",
  },

  // Lista & Cards
  loadingBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: "#64748B",
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#ECEFD9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#285A71",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
  },

  employeeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#285A71",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#285A71",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarBoxActive: {
    borderWidth: 2,
    borderColor: "#10B981",
  },
  avatarBoxInactive: {
    borderWidth: 2,
    borderColor: "#CBD5E1",
    opacity: 0.85,
  },
  avatarImg: {
    width: "100%",
    height: "100%",
  },
  avatarInitials: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  employeeInfo: {
    marginLeft: 12,
    flex: 1,
  },
  employeeName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E293B",
  },
  employeeRole: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },

  // Status Badge
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    gap: 5,
  },
  statusBadgeActive: {
    backgroundColor: "#DCFCE7",
  },
  statusBadgeInactive: {
    backgroundColor: "#FEE2E2",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotActive: {
    backgroundColor: "#16A34A",
  },
  statusDotInactive: {
    backgroundColor: "#DC2626",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  statusTextActive: {
    color: "#15803D",
  },
  statusTextInactive: {
    color: "#B91C1C",
  },

  // Card Stats Row
  cardStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  statChipText: {
    fontSize: 11.5,
    color: "#475569",
    fontWeight: "500",
  },

  // Card Actions
  cardActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    gap: 8,
  },
  toggleStatusBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  toggleStatusBtnActivate: {
    backgroundColor: "#DCFCE7",
    borderColor: "#BBF7D0",
  },
  toggleStatusBtnDeactivate: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FECACA",
  },
  toggleStatusBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  detailsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  detailsBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#285A71",
  },
  cardAddOccBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  cardAddOccBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#B45309",
  },

  // ─── Modal Styles ──────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "90%",
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  modalHeaderInfo: {
    flex: 1,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#285A71",
  },
  modalHeaderSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  modalScrollBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  modalProfileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
    backgroundColor: "#F8FAFC",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  modalAvatarLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#285A71",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  modalAvatarLargeImg: {
    width: "100%",
    height: "100%",
  },
  modalAvatarLargeText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  modalProfileTextGroup: {
    flex: 1,
  },
  modalProfileName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E293B",
  },
  modalProfileRole: {
    fontSize: 12.5,
    color: "#64748B",
    marginTop: 1,
  },

  // Info Section
  infoSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 20,
    gap: 10,
  },
  infoSectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#285A71",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  infoItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoItemLabel: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#64748B",
    width: 80,
  },
  infoItemValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1E293B",
    flex: 1,
  },

  // Occurrences Section
  occurrencesSection: {
    marginBottom: 20,
  },
  occurrencesSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 8,
  },
  occurrencesTitleGroup: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  occurrencesCountBadge: {
    backgroundColor: "#ECEFD9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  occurrencesCountText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#285A71",
  },
  addOccurrenceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#285A71",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  addOccurrenceBtnClose: {
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  addOccurrenceBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  addOccurrenceBtnCloseText: {
    color: "#DC2626",
    fontSize: 12,
    fontWeight: "700",
  },

  // New Occurrence Form Box
  newOccurrenceBox: {
    backgroundColor: "#FFFBEB",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  newOccurrenceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  newOccurrenceTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#92400E",
  },
  quickTagsLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#78350F",
    marginBottom: 6,
  },
  quickTagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  quickTagChip: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FCD34D",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  quickTagChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#92400E",
  },
  newOccurrenceInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: "#1E293B",
    borderWidth: 1,
    borderColor: "#FDE68A",
    textAlignVertical: "top",
    minHeight: 70,
  },
  newOccurrenceActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  newOccurrenceCancel: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  newOccurrenceCancelText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "600",
  },
  newOccurrenceSubmit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#B45309",
  },
  newOccurrenceSubmitText: {
    fontSize: 12,
    color: "#FFFFFF",
    fontWeight: "700",
  },

  // Empty Occurrences
  emptyOccurrencesBox: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0FDF4",
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    gap: 4,
  },
  emptyOccurrencesTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#15803D",
    marginTop: 4,
  },
  emptyOccurrencesSubtitle: {
    fontSize: 11.5,
    color: "#166534",
    textAlign: "center",
  },

  // Occurrence Item
  occurrenceItemCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  occurrenceItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  occurrenceItemDetails: {
    flex: 1,
  },
  occurrenceItemText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1E293B",
  },
  occurrenceItemSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },

  // Modal Toggle Status Button
  modalToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 20,
  },
  modalToggleBtnActivate: {
    backgroundColor: "#16A34A",
  },
  modalToggleBtnDeactivate: {
    backgroundColor: "#DC2626",
  },
  modalToggleBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
