import React, { useCallback, useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { authenticatedFetch } from "../services/api";
import { getToken, logout } from "../services/auth";
import * as ImagePicker from "expo-image-picker";
import { API_URL } from "../services/config";
import PerfilMeetingModal from "../components/perfil/PerfilMeetingModal";
import CalendarDatePicker from "../components/common/CalendarDatePicker";
import TimePickerInput from "../components/common/TimePickerInput";
import { getCachedPointsEnabled, syncPointsEnabledFromServer } from "../services/points";

const cooperaLogo = require("../assets/coopera_logo.png");

// ─── Tipos ───────────────────────────────────────────────────────────────────

type UserDashboardPayload = {
  id: number;
  nome: string;
  email: string;
  pontos: number;
  foto: string | null;
  tarefasPendentes: number;
  tarefasConcluidas: number;
  cargo?: string;
  role?: string;
};

type CompanyDashboardPayload = {
  totalFuncionarios: number;
  totalTarefas: number;
  tarefasPendentes: number;
  tarefasConcluidas: number;
  humor: {
    media: string;
    totalRegistros: number;
    ultimoRegistro: { humor_func: number } | null;
  };
};

type TaskItem = {
  id: number;
  name: string;
  points: string;
  priority: number;
  status: number;
  dueDate: string;
};

type MeetingItem = {
  pk_id_reuniao: number;
  data_reuniao: string;
  horario_reuniao: string;
  assunto_reuniao: string;
  tipo_reuniao: string;
  status_reuniao: string;
  link_reuniao?: string | null;
  solicitante_id?: number;
  solicitante?: { id: number; nome: string };
};

// ─── Componente ──────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Estados de UI
  const [open, setOpen] = useState(true);
  const [otherOpen, setOtherOpen] = useState(true);
  const [pendingOpen, setPendingOpen] = useState(true);
  const [completedOpen, setCompletedOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hoveredDate, setHoveredDate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Estado das abas
  const [activeTab, setActiveTab] = useState<"Tarefas" | "Reuniões">(
    "Tarefas"
  );

  // Estados de dados
  const [userType, setUserType] = useState<"user" | "company" | null>(null);
  const [userData, setUserData] =
    useState<UserDashboardPayload | null>(null);
  const [companyData, setCompanyData] =
    useState<CompanyDashboardPayload | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [pointsEnabled, setPointsEnabled] = useState<boolean>(true);

  // Estados de reuniões
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [meetingModalVisible, setMeetingModalVisible] = useState(false);
  const [meetingsCompletedOpen, setMeetingsCompletedOpen] = useState(true);

  // Modal de sucesso da reunião
  const [meetingSuccessVisible, setMeetingSuccessVisible] = useState(false);

  const [meetingSubject, setMeetingSubject] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [meetingDate, setMeetingDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [meetingTime, setMeetingTime] = useState("14:00");
  const [selectedMeetingEmployeeIds, setSelectedMeetingEmployeeIds] =
    useState<number[]>([]);
  const [creatingMeeting, setCreatingMeeting] = useState(false);
  const [updatingMeetingId, setUpdatingMeetingId] = useState<number | null>(null);
  const [meetingError, setMeetingError] = useState("");

  // Datas dinâmicas
  const [datesList, setDatesList] = useState<
    { label: string; weekday: string; day: string; dateString: string }[]
  >([]);
  const [selectedDateStr, setSelectedDateStr] = useState<string>("");

  // Modal de informações da conta
  const [accountModalVisible, setAccountModalVisible] = useState(false);

  // Modal de criação de tarefa
  const [taskModalVisible, setTaskModalVisible] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskError, setTaskError] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskPriority, setTaskPriority] = useState(2);
  const [taskDueDate, setTaskDueDate] = useState<
    "hoje" | "amanha" | "semana" | "outro"
  >("hoje");
  const [customTaskDate, setCustomTaskDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(
    null
  );

  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // ─── Gera os próximos 7 dias ───────────────────────────────────────────────

  useEffect(() => {
    const list: { label: string; weekday: string; day: string; dateString: string }[] = [];
    const diasSemana = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const weekday = i === 0 ? "HOJE" : diasSemana[d.getDay()];

      const dateString = `${year}-${month}-${day}`;

      list.push({
        label: `${day}/${month}`,
        weekday,
        day,
        dateString,
      });
    }

    setDatesList(list);
    setSelectedDateStr(list[0]?.dateString ?? "");
  }, []);

  // ─── Carregamento de dados ─────────────────────────────────────────────────

  const fetchDashboard = useCallback(async () => {
    const token = await getToken();

    if (!token) {
      router.replace("/");
      return;
    }

    try {
      setLoading(true);

      getCachedPointsEnabled().then(setPointsEnabled);
      syncPointsEnabledFromServer().then(setPointsEnabled);

      const { getUserType } = await import("../services/auth");
      const sessionType = await getUserType();

      if (sessionType === "company") {
        setUserType("company");

        const [companyRes, userRes, empRes, companyTasksRes, meetingsRes] =
          await Promise.all([
            authenticatedFetch("/dashboard/company"),
            authenticatedFetch("/dashboard/user"),
            authenticatedFetch("/users"),
            authenticatedFetch("/tasks/company-tasks"),
            authenticatedFetch("/meetings"),
          ]);

        if (companyRes.status === 401 || userRes.status === 401) {
          router.replace("/");
          return;
        }

        if (companyRes.ok) {
          const body = await companyRes.json();
          setCompanyData(body.data ?? body);
        }

        if (userRes.ok) {
          const body = await userRes.json();
          setUserData(body.data);
          setUserPhoto(body.data?.foto || null);
        }

        if (empRes.ok) {
          const empBody = await empRes.json();
          setEmployees(empBody.data ?? []);
        }

        if (companyTasksRes.ok) {
          const companyTasksBody = await companyTasksRes.json();
          setTasks(companyTasksBody.data ?? []);
        } else {
          const myTasksRes = await authenticatedFetch("/tasks/my-tasks");
          if (myTasksRes.ok) {
            const myTasksBody = await myTasksRes.json();
            setTasks(myTasksBody.data ?? []);
          }
        }

        if (meetingsRes.ok) {
          const meetingsBody = await meetingsRes.json();
          setMeetings(meetingsBody.data ?? []);
        }
      } else {
        setUserType("user");

        const [userRes, tasksRes, meetingsRes] = await Promise.all([
          authenticatedFetch("/dashboard/user"),
          authenticatedFetch("/tasks/my-tasks"),
          authenticatedFetch("/meetings"),
        ]);

        if (userRes.status === 401) {
          router.replace("/");
          return;
        }

        if (!userRes.ok) {
          router.replace("/");
          return;
        }

        const body = await userRes.json();
        setUserData(body.data);
        setUserPhoto(body.data?.foto || null);

        if (tasksRes.ok) {
          const tasksBody = await tasksRes.json();
          setTasks(tasksBody.data ?? []);
        }

        if (meetingsRes.ok) {
          const meetingsBody = await meetingsRes.json();
          setMeetings(meetingsBody.data ?? []);
        }

        // Se for administrador, carrega também os funcionários para gestão
        if (
          body.data?.role === "Administrador" ||
          body.data?.role === "Administrador Master"
        ) {
          const empRes = await authenticatedFetch("/users");
          if (empRes.ok) {
            const empBody = await empRes.json();
            setEmployees(empBody.data ?? []);
          }
        }
      }
    } catch (e) {
      console.error(e);

      Alert.alert(
        "Erro",
        "Não foi possível carregar o dashboard. Verifique sua conexão."
      );

      router.replace("/");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      fetchDashboard();

      // Impede voltar a telas anteriores quando o usuário já está no Dashboard
      const backSub = BackHandler.addEventListener("hardwareBackPress", () => true);

      let handlePopState: (() => void) | null = null;
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.history.pushState(null, "", window.location.href);
        handlePopState = () => {
          window.history.pushState(null, "", window.location.href);
        };
        window.addEventListener("popstate", handlePopState);
      }

      return () => {
        backSub.remove();
        if (Platform.OS === "web" && typeof window !== "undefined" && handlePopState) {
          window.removeEventListener("popstate", handlePopState);
        }
      };
    }, [fetchDashboard])
  );

  // ─── Ações de Tarefa ───────────────────────────────────────────────────────

  const handleUpdateTaskStatus = async (
    taskId: number,
    newStatus: number
  ) => {
    try {
      const response = await authenticatedFetch(`/tasks/${taskId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        const resBody = await response.json().catch(() => ({}));
        setTasks((prevTasks) =>
          prevTasks.map((t) =>
            t.id === taskId ? { ...t, status: newStatus } : t
          )
        );

        if (newStatus === 1) {
          const awarded =
            resBody?.data?.pointsAwarded !== undefined
              ? Number(resBody.data.pointsAwarded) > 0 && pointsEnabled
              : pointsEnabled;

          if (awarded) {
            Alert.alert(
              "Parabéns!",
              "Você concluiu a tarefa com sucesso e acumulou +100 pontos!"
            );
          } else {
            Alert.alert(
              "Muito obrigado! 👏",
              "Tarefa concluída com sucesso! Agradecemos sua dedicação e empenho na entrega de hoje."
            );
          }
        } else {
          const label = newStatus === 2 ? "Em andamento" : "Pendente";

          Alert.alert(
            "Status Atualizado",
            `Status da tarefa alterado para: ${label}`
          );
        }

        fetchDashboard();
      } else {
        const err = await response.json().catch(() => ({}));

        Alert.alert(
          "Erro",
          err.message || "Não foi possível atualizar o status da tarefa."
        );
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Erro", "Erro ao conectar com o servidor.");
    }
  };

  const handleLogout = async () => {
    setAccountModalVisible(false);
    await logout();
    router.replace("/");
  };

  // ─── Foto ──────────────────────────────────────────────────────────────────

  const handlePickPhoto = async () => {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Permissão negada",
        "Precisamos de acesso à sua galeria para trocar a foto."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const base64 = asset.base64;

    if (!base64) return;

    const mimeType = asset.mimeType || "image/jpeg";
    const photoDataUri = `data:${mimeType};base64,${base64}`;

    setUserPhoto(photoDataUri);
    setUploadingPhoto(true);

    try {
      const token = await getToken();

      const response = await fetch(`${API_URL}/users/${userData?.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          foto: photoDataUri,
          foto_func: photoDataUri,
        }),
      });

      if (response.ok) {
        Alert.alert("Sucesso", "Foto atualizada com sucesso!");
      } else {
        const err = await response.json();

        Alert.alert("Erro", err.message || "Erro ao salvar foto.");
      }
    } catch (e) {
      console.error(e);

      Alert.alert("Erro", "Não foi possível enviar a foto.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ─── Criar tarefa ──────────────────────────────────────────────────────────

  const handleCreateTask = async () => {
    if (!taskTitle.trim()) {
      setTaskError("Por favor, preencha o título da tarefa.");
      return;
    }

    if (userType === "company" && !selectedEmployeeId) {
      setTaskError("Por favor, selecione um colaborador.");
      return;
    }

    let dateStringLocal = "";
    if (taskDueDate === "outro" && customTaskDate) {
      dateStringLocal = customTaskDate;
    } else {
      const dueDate = new Date();
      if (taskDueDate === "amanha") {
        dueDate.setDate(dueDate.getDate() + 1);
      } else if (taskDueDate === "semana") {
        dueDate.setDate(dueDate.getDate() + 7);
      }
      const year = dueDate.getFullYear();
      const month = String(dueDate.getMonth() + 1).padStart(2, "0");
      const day = String(dueDate.getDate()).padStart(2, "0");
      dateStringLocal = `${year}-${month}-${day}`;
    }

    setTaskError("");
    setCreatingTask(true);

    try {
      const body: any = {
        tipo_tarefa: taskTitle.trim(),
        validade_tarefa: dateStringLocal,
        prioridade_tarefa: Number(taskPriority),
      };

      if (userType === "company" && selectedEmployeeId) {
        body.fk_id_func = Number(selectedEmployeeId);
      } else if (userData?.id) {
        body.fk_id_func = Number(userData.id);
      }

      const response = await authenticatedFetch("/tasks", {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setTaskModalVisible(false);
        setTaskTitle("");
        setTaskError("");
        setSelectedEmployeeId(null);
        setMenuOpen(false);

        await fetchDashboard();
        setActiveTab("Tarefas");
      } else {
        const err = await response.json().catch(() => ({}));
        setTaskError(err.message || "Erro ao criar tarefa.");
      }
    } catch (e) {
      console.error(e);
      setTaskError("Não foi possível cadastrar a tarefa. Verifique sua conexão e tente novamente.");
    } finally {
      setCreatingTask(false);
    }
  };

  // ─── Criar reunião ─────────────────────────────────────────────────────────

  const handleCreateMeeting = async () => {
    if (!meetingSubject.trim()) {
      setMeetingError("Por favor, informe o assunto da reunião.");
      return;
    }

    const isCompany = userType === "company";
    if (isCompany && selectedMeetingEmployeeIds.length === 0) {
      setMeetingError("Por favor, selecione ao menos um participante.");
      return;
    }

    setMeetingError("");
    try {
      setCreatingMeeting(true);

      const response = await authenticatedFetch(isCompany ? "/meetings" : "/meetings/request", {
        method: "POST",
        body: JSON.stringify({
          data_reuniao: meetingDate,
          horario_reuniao: meetingTime,
          assunto_reuniao: meetingSubject.trim(),
          link_reuniao: meetingLink.trim()
            ? /^https?:\/\//i.test(meetingLink.trim())
              ? meetingLink.trim()
              : `https://${meetingLink.trim()}`
            : undefined,
          tipo_reuniao: "empresarial",
          participants: isCompany ? selectedMeetingEmployeeIds : [],
        }),
      });

      if (response.ok) {
        // Fecha o formulário
        setMeetingModalVisible(false);

        // Abre o modal de sucesso
        setMeetingSuccessVisible(true);

        // Limpa os campos
        setMeetingSubject("");
        setMeetingLink("");
        setMeetingError("");
        setSelectedMeetingEmployeeIds([]);

        setMenuOpen(false);

        // Atualiza a lista de reuniões e muda para a aba de reuniões
        await fetchDashboard();
        setActiveTab("Reuniões");
      } else {
        const err = await response.json().catch(() => ({}));
        setMeetingError(err.message || "Erro ao registrar a reunião.");
      }
    } catch (e) {
      console.error(e);
      setMeetingError("Não foi possível conectar ao servidor. Tente novamente.");
    } finally {
      setCreatingMeeting(false);
    }
  };

  const handleUpdateMeetingStatus = async (
    meeting: MeetingItem,
    newStatus: "AGENDADA" | "CONCLUIDA" | "RECUSADA" | "CANCELADA" = "CONCLUIDA",
  ) => {
    if (updatingMeetingId !== null) return;

    setUpdatingMeetingId(meeting.pk_id_reuniao);
    try {
      const response = await authenticatedFetch(
        `/meetings/${meeting.pk_id_reuniao}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status_reuniao: newStatus }),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.message || "Não foi possível atualizar a reunião.");
      }

      setMeetings((current) =>
        current.map((item) =>
          item.pk_id_reuniao === meeting.pk_id_reuniao
            ? { ...item, status_reuniao: newStatus }
            : item,
        ),
      );

      if (newStatus === "CONCLUIDA" || newStatus === "RECUSADA") {
        setMeetingsCompletedOpen(true);
      }

      // Sincroniza dados com o servidor
      fetchDashboard();

      const msg =
        newStatus === "AGENDADA"
          ? "Reunião aceita e agendada com sucesso!"
          : newStatus === "RECUSADA"
            ? "Solicitação de reunião recusada."
            : newStatus === "CANCELADA"
              ? "Solicitação cancelada."
              : "Reunião concluída com sucesso!";

      Alert.alert("Reunião Atualizada", msg);
    } catch (error) {
      Alert.alert(
        "Erro",
        error instanceof Error ? error.message : "Não foi possível atualizar a reunião.",
      );
    } finally {
      setUpdatingMeetingId(null);
    }
  };

  const openMeetingLink = async (link: string) => {
    try {
      await Linking.openURL(link);
    } catch {
      Alert.alert("Link inválido", "Não foi possível abrir o link da reunião.");
    }
  };

  // ─── Filtragem de tarefas ──────────────────────────────────────────────────

  const activeTasks = tasks.filter((t) => {
    if (t.status === 1) return false;

    if (!t.dueDate) return true;

    const taskDateOnly =
      typeof t.dueDate === "string" && t.dueDate.includes("T")
        ? t.dueDate.split("T")[0]
        : String(t.dueDate);

    return taskDateOnly === selectedDateStr || !selectedDateStr;
  });

  const urgentTasks = activeTasks.filter((t) => t.priority === 1);

  const otherTasks = activeTasks.filter((t) => t.priority === 2);

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const todayStr = `${year}-${month}-${day}`;

  // Tarefas Pendentes / Atrasadas: tarefas anteriores a hoje que ainda não foram concluídas
  const pendingTasks = tasks.filter((t) => {
    if (t.status === 1) return false;
    if (!t.dueDate) return false;

    const taskDateOnly =
      typeof t.dueDate === "string" && t.dueDate.includes("T")
        ? t.dueDate.split("T")[0]
        : String(t.dueDate);

    // Só entra no card de pendentes/atrasadas se venceu antes de hoje e não está no dia selecionado
    return taskDateOnly < todayStr && taskDateOnly !== selectedDateStr;
  });

  const completedTasks = tasks.filter((t) => t.status === 1);
  const openMeetings = meetings.filter(
    (meeting) =>
      meeting.status_reuniao !== "CONCLUIDA" &&
      meeting.status_reuniao !== "RECUSADA",
  );
  const completedMeetings = meetings.filter(
    (meeting) =>
      meeting.status_reuniao === "CONCLUIDA" ||
      meeting.status_reuniao === "RECUSADA",
  );

  // ─── Renderização de item de tarefa ────────────────────────────────────────

  const renderTask = (task: TaskItem) => {
    const isCompany = userType === "company";
    const isUrgent = task.priority === 1;

    return (
      <View key={task.id} style={styles.taskItem}>
        <View
          style={[
            styles.statusDot,
            task.status === 1 && {
              backgroundColor: "#10B981",
            },
            task.status === 2 && {
              backgroundColor: "#D97706",
            },
            task.status === 3 && {
              backgroundColor: "#94A3B8",
            },
          ]}
        />

        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {task.name.charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={{ flex: 1, minWidth: 0, paddingRight: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <View style={styles.taskBadgeTag}>
              <Ionicons name="checkbox-outline" size={10} color="#285A71" />
              <Text style={styles.taskBadgeTagText}>TAREFA</Text>
            </View>
            <Text
              style={[
                styles.taskName,
                task.status === 1 && {
                  textDecorationLine: "line-through",
                  color: "#94A3B8",
                },
              ]}
              numberOfLines={2}
            >
              {task.name}
            </Text>
            {isUrgent && task.status !== 1 && (
              <View style={styles.urgentBadge}>
                <Text style={styles.urgentBadgeText}>URGENTE</Text>
              </View>
            )}
          </View>

          <Text
            style={{
              fontSize: 11,
              fontWeight: "600",
              color:
                task.status === 1
                  ? "#10B981"
                  : task.status === 2
                    ? "#D97706"
                    : "#64748B",
              marginTop: 3,
            }}
          >
            {task.status === 3
              ? "Pendente"
              : task.status === 2
                ? "Em andamento"
                : "Concluída"}
          </Text>
        </View>

        {pointsEnabled && Number(task.points) > 0 && (
          <View style={styles.taskPointsBox}>
            <Ionicons name="star" size={11} color="#16A34A" style={{ marginRight: 2 }} />
            <Text style={styles.taskPoints}>+{task.points}</Text>
          </View>
        )}

        <View
          style={{
            flexDirection: "row",
            gap: 6,
            alignItems: "center",
          }}
        >
          {task.status === 3 && (
            <TouchableOpacity
              style={[
                styles.checkButton,
                {
                  backgroundColor: "#D97706",
                },
              ]}
              activeOpacity={0.8}
              onPress={() => handleUpdateTaskStatus(task.id, 2)}
            >
              <Ionicons
                name="time-outline"
                size={16}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          )}

          {(task.status === 3 || task.status === 2) && (
            <TouchableOpacity
              style={[
                styles.checkButton,
                {
                  backgroundColor: "#10B981",
                },
              ]}
              activeOpacity={0.8}
              onPress={() => handleUpdateTaskStatus(task.id, 1)}
            >
              <Ionicons
                name="checkmark"
                size={18}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          )}

          {task.status === 1 && (
            <View
              style={[
                styles.checkButton,
                {
                  backgroundColor: "#D1FAE5",
                },
              ]}
            >
              <Ionicons
                name="checkmark-done"
                size={18}
                color="#059669"
              />
            </View>
          )}

          {isCompany && task.status === 2 && (
            <TouchableOpacity
              style={[
                styles.checkButton,
                {
                  backgroundColor: "#94A3B8",
                },
              ]}
              activeOpacity={0.8}
              onPress={() => handleUpdateTaskStatus(task.id, 3)}
            >
              <Ionicons
                name="refresh-outline"
                size={16}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderMeeting = (meeting: MeetingItem) => {
    const isCompany =
      userType === "company" ||
      (userData?.cargo || "").toLowerCase().includes("admin") ||
      (userData?.cargo || "").toLowerCase().includes("administrador");
    const rawDate =
      typeof meeting.data_reuniao === "string" && meeting.data_reuniao.includes("T")
        ? meeting.data_reuniao.split("T")[0]
        : String(meeting.data_reuniao);
    const isCompleted = meeting.status_reuniao === "CONCLUIDA";
    const isRejected = meeting.status_reuniao === "RECUSADA";
    const isScheduled = meeting.status_reuniao === "AGENDADA";
    const isPending = meeting.status_reuniao === "PENDENTE";
    const statusColor = isCompleted
      ? "#059669"
      : isScheduled
        ? "#059669"
        : isPending
          ? "#D97706"
          : "#DC2626";

    return (
      <View key={meeting.pk_id_reuniao} style={styles.taskItem}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <View style={[styles.avatar, { backgroundColor: "#E2E8F0" }]}>
          <Ionicons name="calendar" size={18} color="#285A71" />
        </View>

        <View style={{ flex: 1, minWidth: 0, paddingRight: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 2 }}>
            <View style={styles.meetingBadgeTag}>
              <Ionicons name="calendar-outline" size={10} color="#285A71" />
              <Text style={styles.meetingBadgeTagText}>REUNIÃO</Text>
            </View>
            <Text
              style={[
                styles.taskName,
                isCompleted && { textDecorationLine: "line-through", color: "#64748B" },
                isRejected && {
                  textDecorationLine: "line-through",
                  textDecorationColor: "#DC2626",
                  color: "#DC2626",
                  ...(Platform.OS === "web" ? ({ textDecorationThickness: "2px" } as any) : {}),
                },
              ]}
              numberOfLines={2}
            >
              {meeting.assunto_reuniao}
            </Text>
          </View>
          <Text style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
            {rawDate} às {meeting.horario_reuniao?.substring(0, 5) || "--:--"}
            {meeting.solicitante?.nome ? ` • ${meeting.solicitante.nome}` : ""}
          </Text>
          {isRejected && (
            <Text style={{ fontSize: 11, fontWeight: "700", color: "#DC2626", marginTop: 3 }}>
              Reunião recusada
            </Text>
          )}
          {meeting.link_reuniao && !isRejected ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => openMeetingLink(meeting.link_reuniao!)}
              style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 }}
            >
              <Ionicons name="link-outline" size={15} color="#285A71" />
              <Text style={{ color: "#285A71", fontSize: 12, fontWeight: "700" }}>
                Acessar link
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <View
            style={{
              backgroundColor: isCompleted
                ? "#D1FAE5"
                : isScheduled
                  ? "#D1FAE5"
                  : isPending
                    ? "#FEF3C7"
                    : "#FEE2E2",
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 6,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: "700", color: statusColor }}>
              {meeting.status_reuniao || "AGENDADA"}
            </Text>
          </View>
          {isPending && isCompany ? (
            <View style={{ flexDirection: "row", gap: 6 }}>
              <TouchableOpacity
                style={[styles.checkButton, { backgroundColor: "#DC2626" }]}
                activeOpacity={0.8}
                disabled={updatingMeetingId !== null}
                onPress={() => handleUpdateMeetingStatus(meeting, "RECUSADA")}
                accessibilityLabel="Recusar solicitação de reunião"
              >
                {updatingMeetingId === meeting.pk_id_reuniao ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="close" size={16} color="#FFFFFF" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.checkButton, { backgroundColor: "#10B981" }]}
                activeOpacity={0.8}
                disabled={updatingMeetingId !== null}
                onPress={() => handleUpdateMeetingStatus(meeting, "AGENDADA")}
                accessibilityLabel="Aceitar e agendar reunião"
              >
                {updatingMeetingId === meeting.pk_id_reuniao ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          ) : isPending && !isCompany && meeting.solicitante_id === userData?.id ? (
            <TouchableOpacity
              style={[styles.checkButton, { backgroundColor: "#94A3B8" }]}
              activeOpacity={0.8}
              disabled={updatingMeetingId !== null}
              onPress={() => handleUpdateMeetingStatus(meeting, "CANCELADA")}
              accessibilityLabel="Cancelar minha solicitação"
            >
              {updatingMeetingId === meeting.pk_id_reuniao ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="close" size={16} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          ) : isScheduled && !isCompleted ? (
            <TouchableOpacity
              style={[styles.checkButton, { backgroundColor: "#10B981" }]}
              activeOpacity={0.8}
              disabled={updatingMeetingId !== null}
              onPress={() => handleUpdateMeetingStatus(meeting, "CONCLUIDA")}
              accessibilityLabel="Marcar reunião como concluída"
            >
              {updatingMeetingId === meeting.pk_id_reuniao ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="checkmark" size={18} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          ) : isCompleted ? (
            <View style={[styles.checkButton, { backgroundColor: "#D1FAE5" }]}>
              <Ionicons name="checkmark-done" size={18} color="#059669" />
            </View>
          ) : isRejected ? (
            <View style={[styles.checkButton, { backgroundColor: "#FEE2E2" }]}>
              <Ionicons name="close" size={18} color="#DC2626" />
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header com Saudação e Perfil */}
      <View
        style={[
          styles.header,
          {
            paddingTop: 14,
            paddingHorizontal: Math.max(insets.left, insets.right, 20),
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <View style={styles.logoBox}>
            <Image
              source={cooperaLogo}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <View style={styles.headerGreeting}>
            <Text style={styles.greetingTitle}>
              Olá, {userData?.nome ? userData.nome.split(" ")[0] : "Bem-vindo"}
            </Text>
            <Text style={styles.greetingRole}>
              {userType === "company" ? "Gestão Corporativa" : userData?.cargo || "Central de Atividades"}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerAccountButton}
            activeOpacity={0.8}
            onPress={() => setAccountModalVisible(true)}
          >
            {userPhoto || userData?.foto ? (
              <Image
                source={{
                  uri: (userPhoto || userData?.foto) ?? undefined,
                }}
                style={styles.headerAvatar}
              />
            ) : (
              <View style={styles.headerAvatarFallback}>
                <Ionicons
                  name="person"
                  size={18}
                  color="#285A71"
                />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Seletor de Datas Dinâmicas com Dia da Semana */}
      <ScrollView
        style={styles.dateScroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dateContainer}
      >
        {datesList.map((item, index) => {
          const isSelected = item.dateString === selectedDateStr;

          return (
            <Pressable
              key={item.dateString}
              onHoverIn={() => setHoveredDate(index)}
              onHoverOut={() => setHoveredDate(null)}
              onPress={() => setSelectedDateStr(item.dateString)}
              style={[
                styles.dateButton,
                isSelected && styles.dateButtonSelected,
                hoveredDate === index && styles.dateButtonHover,
              ]}
            >
              <Text
                style={[
                  styles.dateWeekday,
                  isSelected && styles.dateWeekdaySelected,
                ]}
              >
                {item.weekday}
              </Text>
              <Text
                style={[
                  styles.dateDay,
                  isSelected && styles.dateDaySelected,
                ]}
              >
                {item.day}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Conteúdo */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── ABAS COM DESIGN DE PÍLULA ELEGANTE ─────────────────────────── */}
        <View style={styles.tabBarContainer}>
          <TouchableOpacity
            style={[
              styles.tabPill,
              activeTab === "Tarefas" && styles.tabPillActive,
            ]}
            onPress={() => setActiveTab("Tarefas")}
            activeOpacity={0.8}
          >
            <Ionicons
              name="checkbox-outline"
              size={16}
              color={activeTab === "Tarefas" ? "#285A71" : "#64748B"}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.tabLabel,
                activeTab === "Tarefas" && styles.tabLabelActive,
              ]}
            >
              Tarefas
            </Text>
            {activeTasks.length > 0 && (
              <View
                style={[
                  styles.tabBadge,
                  activeTab === "Tarefas" && styles.tabBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabBadgeText,
                    activeTab === "Tarefas" && styles.tabBadgeTextActive,
                  ]}
                >
                  {activeTasks.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabPill,
              activeTab === "Reuniões" && styles.tabPillActive,
            ]}
            onPress={() => setActiveTab("Reuniões")}
            activeOpacity={0.8}
          >
            <Ionicons
              name="calendar-outline"
              size={16}
              color={activeTab === "Reuniões" ? "#285A71" : "#64748B"}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.tabLabel,
                activeTab === "Reuniões" && styles.tabLabelActive,
              ]}
            >
              Reuniões
            </Text>
            {openMeetings.length > 0 && (
              <View
                style={[
                  styles.tabBadge,
                  activeTab === "Reuniões" && styles.tabBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabBadgeText,
                    activeTab === "Reuniões" && styles.tabBadgeTextActive,
                  ]}
                >
                  {openMeetings.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* ABA TAREFAS                                                   */}
        {/* ═══════════════════════════════════════════════════════════════ */}

        {activeTab === "Tarefas" && (
          <>
            {/* Card Tarefas Urgentes */}
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.cardHeader}
                onPress={() => setOpen(!open)}
                activeOpacity={0.8}
              >
                <View style={styles.cardTitleBox}>
                  <View style={[styles.cardHeaderDot, { backgroundColor: "#DC2626" }]} />
                  <Text style={styles.cardTitle}>Tarefas Urgentes</Text>
                  {urgentTasks.length > 0 && (
                    <View style={[styles.cardCountPill, { backgroundColor: "#FEE2E2" }]}>
                      <Text style={[styles.cardCountText, { color: "#DC2626" }]}>
                        {urgentTasks.length}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.chevronBox}>
                  <Ionicons
                    name={open ? "chevron-up" : "chevron-down"}
                    size={20}
                    color="#285A71"
                  />
                </View>
              </TouchableOpacity>

              {open && (
                <View style={styles.taskList}>
                  {loading && tasks.length === 0 ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator
                        size="small"
                        color="#285A71"
                      />
                      <Text style={styles.loadingLabel}>
                        Carregando dados
                      </Text>
                    </View>
                  ) : urgentTasks.length === 0 ? (
                    <Text style={styles.emptyText}>
                      Nenhuma tarefa urgente para este dia.
                    </Text>
                  ) : (
                    urgentTasks.map(renderTask)
                  )}
                </View>
              )}
            </View>

            {/* Card Outras Tarefas */}
            <View style={[styles.card, styles.cardSpacing]}>
              <TouchableOpacity
                style={styles.cardHeader}
                onPress={() => setOtherOpen(!otherOpen)}
                activeOpacity={0.8}
              >
                <View style={styles.cardTitleBox}>
                  <View style={[styles.cardHeaderDot, { backgroundColor: "#285A71" }]} />
                  <Text style={styles.cardTitle}>Outras Tarefas</Text>
                  {otherTasks.length > 0 && (
                    <View style={[styles.cardCountPill, { backgroundColor: "#E0EDF3" }]}>
                      <Text style={[styles.cardCountText, { color: "#285A71" }]}>
                        {otherTasks.length}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.chevronBox}>
                  <Ionicons
                    name={otherOpen ? "chevron-up" : "chevron-down"}
                    size={20}
                    color="#285A71"
                  />
                </View>
              </TouchableOpacity>

              {otherOpen && (
                <View style={styles.taskList}>
                  {otherTasks.length === 0 ? (
                    <Text style={styles.emptyText}>
                      Nenhuma outra tarefa para este dia.
                    </Text>
                  ) : (
                    otherTasks.map(renderTask)
                  )}
                </View>
              )}
            </View>

            {/* Card Tarefas Pendentes */}
            <View style={[styles.card, styles.cardSpacing]}>
              <TouchableOpacity
                style={styles.cardHeader}
                onPress={() => setPendingOpen(!pendingOpen)}
                activeOpacity={0.8}
              >
                <View style={styles.cardTitleBox}>
                  <View style={[styles.cardHeaderDot, { backgroundColor: "#D97706" }]} />
                  <Text style={styles.cardTitle}>Tarefas Pendentes</Text>
                  {pendingTasks.length > 0 && (
                    <View style={[styles.cardCountPill, { backgroundColor: "#FEF3C7" }]}>
                      <Text style={[styles.cardCountText, { color: "#D97706" }]}>
                        {pendingTasks.length}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.chevronBox}>
                  <Ionicons
                    name={pendingOpen ? "chevron-up" : "chevron-down"}
                    size={20}
                    color="#285A71"
                  />
                </View>
              </TouchableOpacity>

              {pendingOpen && (
                <View style={styles.taskList}>
                  {pendingTasks.length === 0 ? (
                    <Text style={styles.emptyText}>
                      Nenhuma tarefa pendente.
                    </Text>
                  ) : (
                    pendingTasks.map(renderTask)
                  )}
                </View>
              )}
            </View>

            {/* Card Tarefas Concluídas */}
            <View style={[styles.card, styles.cardSpacing]}>
              <TouchableOpacity
                style={styles.cardHeader}
                onPress={() => setCompletedOpen(!completedOpen)}
                activeOpacity={0.8}
              >
                <View style={styles.cardTitleBox}>
                  <View style={[styles.cardHeaderDot, { backgroundColor: "#10B981" }]} />
                  <Text style={styles.cardTitle}>Tarefas Concluídas</Text>
                  {completedTasks.length > 0 && (
                    <View style={[styles.cardCountPill, { backgroundColor: "#D1FAE5" }]}>
                      <Text style={[styles.cardCountText, { color: "#059669" }]}>
                        {completedTasks.length}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.chevronBox}>
                  <Ionicons
                    name={completedOpen ? "chevron-up" : "chevron-down"}
                    size={20}
                    color="#285A71"
                  />
                </View>
              </TouchableOpacity>

              {completedOpen && (
                <View style={styles.taskList}>
                  {completedTasks.length === 0 ? (
                    <Text style={styles.emptyText}>
                      Nenhuma tarefa concluída.
                    </Text>
                  ) : (
                    completedTasks.map(renderTask)
                  )}
                </View>
              )}
            </View>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* ABA REUNIÕES                                                  */}
        {/* ═══════════════════════════════════════════════════════════════ */}

        {activeTab === "Reuniões" && (
          <>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleBox}>
                  <View style={[styles.cardHeaderDot, { backgroundColor: "#285A71" }]} />
                  <Text style={styles.cardTitle}>Reuniões em aberto</Text>
                  {openMeetings.length > 0 && (
                    <View style={[styles.cardCountPill, { backgroundColor: "#E0EDF3" }]}>
                      <Text style={[styles.cardCountText, { color: "#285A71" }]}>
                        {openMeetings.length}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.chevronBox}>
                  <Ionicons name="calendar-outline" size={20} color="#285A71" />
                </View>
              </View>

              <View style={styles.taskList}>
                {loading && meetings.length === 0 ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color="#285A71" />
                    <Text style={styles.loadingLabel}>Carregando reuniões...</Text>
                  </View>
                ) : openMeetings.length === 0 ? (
                  <Text style={styles.emptyText}>Nenhuma reunião em aberto.</Text>
                ) : (
                  openMeetings.map(renderMeeting)
                )}
              </View>
            </View>

            <View style={[styles.card, styles.cardSpacing]}>
              <TouchableOpacity
                style={styles.cardHeader}
                onPress={() => setMeetingsCompletedOpen(!meetingsCompletedOpen)}
                activeOpacity={0.8}
              >
                <View style={styles.cardTitleBox}>
                  <View style={[styles.cardHeaderDot, { backgroundColor: "#10B981" }]} />
                  <Text style={styles.cardTitle}>Reuniões concluídas</Text>
                  {completedMeetings.length > 0 && (
                    <View style={[styles.cardCountPill, { backgroundColor: "#D1FAE5" }]}>
                      <Text style={[styles.cardCountText, { color: "#059669" }]}>
                        {completedMeetings.length}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.chevronBox}>
                  <Ionicons
                    name={meetingsCompletedOpen ? "chevron-up" : "chevron-down"}
                    size={20}
                    color="#285A71"
                  />
                </View>
              </TouchableOpacity>

              {meetingsCompletedOpen && (
                <View style={styles.taskList}>
                  {completedMeetings.length === 0 ? (
                    <Text style={styles.emptyText}>Nenhuma reunião concluída.</Text>
                  ) : (
                    completedMeetings.map(renderMeeting)
                  )}
                </View>
              )}
            </View>
          </>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ─── Menu flutuante com Backdrop ─────────────────────────────────── */}

      {menuOpen && (
        <>
          <Pressable
            style={styles.menuBackdrop}
            onPress={() => setMenuOpen(false)}
          />
          <View style={styles.dropupMenu}>
            <TouchableOpacity
              style={styles.menuCard}
              activeOpacity={0.85}
              onPress={() => {
                setMenuOpen(false);
                setTaskModalVisible(true);
              }}
            >
              <Ionicons
                name="star"
                size={16}
                color="#285A71"
              />

              <Text style={styles.menuText}>
                Tarefa
              </Text>
            </TouchableOpacity>

            {(userType === "company" || userType === "user") && (
              <TouchableOpacity
                style={[
                  styles.menuCard,
                  { marginTop: 8 },
                ]}
                activeOpacity={0.85}
                onPress={() => {
                  setMenuOpen(false);
                  setMeetingModalVisible(true);
                }}
              >
                <Ionicons
                  name="calendar"
                  size={16}
                  color="#285A71"
                />

                <Text style={styles.menuText}>
                  {userType === "company" ? "Reunião" : "Solicitar reunião"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}

      <TouchableOpacity
        style={[
          styles.floatingButton,
          menuOpen &&
          styles.floatingButtonActive,
        ]}
        activeOpacity={0.85}
        onPress={() =>
          setMenuOpen(!menuOpen)
        }
      >
        <Ionicons
          name={
            menuOpen
              ? "close"
              : "add"
          }
          size={34}
          color="#FFFFFF"
        />
      </TouchableOpacity>

      {/* ─── Navegação inferior ─────────────────────────────────────────── */}

      <View style={styles.bottomNavigation}>
        <TouchableOpacity
          style={styles.navButton}
          activeOpacity={0.8}
          onPress={() => router.replace("/dashboard")}
        >
          <Ionicons
            name="home"
            size={26}
            color="#285A71"
          />

          <Text style={[styles.navLabel, { color: "#285A71" }]}>
            central
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          activeOpacity={0.8}
          onPress={() =>
            router.push("/ponto-e")
          }
        >
          <Ionicons
            name="location"
            size={26}
            color="#94A3B8"
          />

          <Text style={[styles.navLabel, { color: "#94A3B8" }]}>
            Ponto-E
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          activeOpacity={0.8}
          onPress={() =>
            router.push("/chat")
          }
        >
          <Ionicons
            name="chatbubble-ellipses"
            size={26}
            color="#94A3B8"
          />

          <Text style={[styles.navLabel, { color: "#94A3B8" }]}>
            chats
          </Text>
        </TouchableOpacity>
      </View>

      {/* ─── Modal Conta ────────────────────────────────────────────────── */}

      <Modal
        animationType="slide"
        transparent={true}
        visible={accountModalVisible}
        onRequestClose={() =>
          setAccountModalVisible(false)
        }
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() =>
            setAccountModalVisible(false)
          }
        >
          <Pressable
            style={styles.accountModal}
            onPress={() => { }}
          >
            <View style={styles.accountModalHeader}>
              <Text style={styles.accountModalTitle}>
                Minha Conta
              </Text>

              <TouchableOpacity
                onPress={() =>
                  setAccountModalVisible(false)
                }
              >
                <Ionicons
                  name="close"
                  size={24}
                  color="#285A71"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.accountAvatar}
              onPress={handlePickPhoto}
              disabled={uploadingPhoto}
            >
              {userPhoto ||
                userData?.foto ? (
                <Image
                  source={{
                    uri:
                      (userPhoto ||
                        userData?.foto) ??
                      undefined,
                  }}
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 36,
                  }}
                />
              ) : (
                <Ionicons
                  name="person"
                  size={40}
                  color="#FFFFFF"
                />
              )}
            </TouchableOpacity>

            {uploadingPhoto && (
              <Text
                style={{
                  textAlign: "center",
                  color: "#285A71",
                  fontSize: 12,
                  marginBottom: 8,
                }}
              >
                Enviando foto...
              </Text>
            )}

            {userType === "user" &&
              userData && (
                <View style={styles.accountInfo}>
                  <Text style={styles.accountName}>
                    {userData.nome}
                  </Text>

                  <Text style={styles.accountEmail}>
                    {userData.email}
                  </Text>

                  <View style={styles.accountStatRow}>
                    <View style={styles.accountStat}>
                      <Ionicons
                        name="trophy"
                        size={22}
                        color="#D97706"
                      />

                      <Text
                        style={
                          styles.accountStatValue
                        }
                      >
                        {userData.pontos}
                      </Text>

                      <Text
                        style={
                          styles.accountStatLabel
                        }
                      >
                        Pontos
                      </Text>
                    </View>

                    <View style={styles.accountStat}>
                      <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color="#16A34A"
                      />

                      <Text
                        style={
                          styles.accountStatValue
                        }
                      >
                        {userData.tarefasConcluidas}
                      </Text>

                      <Text
                        style={
                          styles.accountStatLabel
                        }
                      >
                        Concluídas
                      </Text>
                    </View>

                    <View style={styles.accountStat}>
                      <Ionicons
                        name="time"
                        size={22}
                        color="#285A71"
                      />

                      <Text
                        style={
                          styles.accountStatValue
                        }
                      >
                        {userData.tarefasPendentes}
                      </Text>

                      <Text
                        style={
                          styles.accountStatLabel
                        }
                      >
                        Pendentes
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      backgroundColor: "#ECEFD9",
                      paddingVertical: 12,
                      paddingHorizontal: 24,
                      borderRadius: 14,
                      marginTop: 16,
                      borderWidth: 0.5,
                      borderColor: "#285A71",
                    }}
                    onPress={handlePickPhoto}
                    disabled={uploadingPhoto}
                  >
                    <Ionicons
                      name="camera-outline"
                      size={18}
                      color="#285A71"
                    />

                    <Text
                      style={{
                        color: "#285A71",
                        fontSize: 14,
                        fontWeight: "700",
                      }}
                    >
                      Trocar Foto
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

            {userType === "company" &&
              companyData && (
                <View style={styles.accountInfo}>
                  <Text style={styles.accountName}>
                    {userData?.nome ||
                      "Painel Corporativo"}
                  </Text>

                  <Text style={styles.accountEmail}>
                    {userData?.email ||
                      "Administrador"}
                  </Text>

                  <View style={styles.accountStatRow}>
                    <View style={styles.accountStat}>
                      <Ionicons
                        name="people"
                        size={22}
                        color="#285A71"
                      />

                      <Text
                        style={
                          styles.accountStatValue
                        }
                      >
                        {
                          companyData.totalFuncionarios
                        }
                      </Text>

                      <Text
                        style={
                          styles.accountStatLabel
                        }
                      >
                        Colaboradores
                      </Text>
                    </View>

                    <View style={styles.accountStat}>
                      <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color="#16A34A"
                      />

                      <Text
                        style={
                          styles.accountStatValue
                        }
                      >
                        {
                          companyData.tarefasConcluidas
                        }
                      </Text>

                      <Text
                        style={
                          styles.accountStatLabel
                        }
                      >
                        Concluídas
                      </Text>
                    </View>

                    <View style={styles.accountStat}>
                      <Ionicons
                        name="time"
                        size={22}
                        color="#D97706"
                      />

                      <Text
                        style={
                          styles.accountStatValue
                        }
                      >
                        {
                          companyData.tarefasPendentes
                        }
                      </Text>

                      <Text
                        style={
                          styles.accountStatLabel
                        }
                      >
                        Pendentes
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      backgroundColor: "#ECEFD9",
                      paddingVertical: 12,
                      paddingHorizontal: 24,
                      borderRadius: 14,
                      marginTop: 16,
                      borderWidth: 0.5,
                      borderColor: "#285A71",
                    }}
                    onPress={handlePickPhoto}
                    disabled={uploadingPhoto}
                  >
                    <Ionicons
                      name="camera-outline"
                      size={18}
                      color="#285A71"
                    />

                    <Text
                      style={{
                        color: "#285A71",
                        fontSize: 14,
                        fontWeight: "700",
                      }}
                    >
                      Trocar Foto
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

            <View
              style={{
                gap: 8,
                marginTop: 16,
                marginBottom: 8,
                width: "100%",
              }}
            >
              {(userType === "user" || userData?.role === "Administrador") && (
                <TouchableOpacity
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    backgroundColor: "#285A71",
                    paddingVertical: 12,
                    paddingHorizontal: 18,
                    borderRadius: 12,
                  }}
                  onPress={() => {
                    setAccountModalVisible(false);
                    router.push("/perfilFunc");
                  }}
                >
                  <Ionicons
                    name="person-outline"
                    size={18}
                    color="#FFFFFF"
                  />

                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 13,
                      fontWeight: "700",
                    }}
                  >
                    Perfil do Colaborador
                  </Text>
                </TouchableOpacity>
              )}

              {(userType === "company" || userData?.role === "Administrador" || userData?.role === "Administrador Master") && (
                <TouchableOpacity
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    backgroundColor: "#285A71",
                    paddingVertical: 12,
                    paddingHorizontal: 18,
                    borderRadius: 12,
                  }}
                  onPress={() => {
                    setAccountModalVisible(false);
                    router.push("/perfilAdm");
                  }}
                >
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={18}
                    color="#FFFFFF"
                  />

                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 13,
                      fontWeight: "700",
                    }}
                  >
                    Perfil Administrativo
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
            >
              <Ionicons
                name="log-out-outline"
                size={20}
                color="#FFFFFF"
              />

              <Text style={styles.logoutButtonText}>
                Sair da Conta
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Modal Criar Tarefa ─────────────────────────────────────────── */}

      <Modal
        animationType="slide"
        transparent={true}
        visible={taskModalVisible}
        onRequestClose={() =>
          setTaskModalVisible(false)
        }
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ width: "100%", justifyContent: "flex-end" }}
          >
            <View style={styles.taskModal}>
              <View style={styles.accountModalHeader}>
                <Text style={styles.accountModalTitle}>
                  Nova Tarefa
                </Text>

                <TouchableOpacity
                  onPress={() =>
                    setTaskModalVisible(false)
                  }
                >
                  <Ionicons
                    name="close"
                    size={24}
                    color="#285A71"
                  />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                style={{ maxHeight: 420 }}
                contentContainerStyle={{ paddingBottom: 10 }}
              >
                <Text style={styles.inputLabel}>
                  Título / Descrição
                </Text>

                <TextInput
                  style={styles.textInput}
                  placeholder="Ex: Enviar relatório do setor"
                  placeholderTextColor="#94A3B8"
                  value={taskTitle}
                  onChangeText={setTaskTitle}
                />

                {taskError ? (
                  <Text style={{ color: "#DC2626", fontSize: 12, marginTop: 6 }}>
                    {taskError}
                  </Text>
                ) : null}

                <Text style={styles.inputLabel}>
                  Prioridade
                </Text>

                <View style={styles.optionRow}>
                  <TouchableOpacity
                    style={[
                      styles.optionBtn,
                      taskPriority === 1 &&
                      styles.optionBtnUrgent,
                    ]}
                    onPress={() =>
                      setTaskPriority(1)
                    }
                  >
                    <Text
                      style={[
                        styles.optionText,
                        taskPriority === 1 &&
                        styles.optionTextActive,
                      ]}
                    >
                      Urgente
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.optionBtn,
                      taskPriority === 2 &&
                      styles.optionBtnNormal,
                    ]}
                    onPress={() =>
                      setTaskPriority(2)
                    }
                  >
                    <Text
                      style={[
                        styles.optionText,
                        taskPriority === 2 &&
                        styles.optionTextActive,
                      ]}
                    >
                      Normal
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputLabel}>
                  Prazo
                </Text>

                <View style={styles.optionRow}>
                  {(
                    [
                      { key: "hoje", label: "Hoje" },
                      { key: "amanha", label: "Amanhã" },
                      { key: "semana", label: "7 Dias" },
                      { key: "outro", label: "Outra Data" },
                    ] as const
                  ).map(({ key, label }) => (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.optionBtn,
                        taskDueDate === key && styles.optionBtnNormal,
                      ]}
                      onPress={() => setTaskDueDate(key)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          taskDueDate === key && styles.optionTextActive,
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {taskDueDate === "outro" && (
                  <View style={{ marginTop: 8 }}>
                    <CalendarDatePicker
                      value={customTaskDate}
                      onChange={setCustomTaskDate}
                      label="Data de Entrega da Tarefa"
                    />
                  </View>
                )}

                {userType === "company" && (
                  <>
                    <Text style={styles.inputLabel}>
                      Atribuir Colaborador
                    </Text>

                    <ScrollView
                      style={styles.employeeList}
                      nestedScrollEnabled
                    >
                      {employees.map((emp) => {
                        const sel =
                          selectedEmployeeId === emp.id;

                        return (
                          <TouchableOpacity
                            key={emp.id}
                            style={[
                              styles.employeeRow,
                              sel &&
                              styles.employeeRowActive,
                            ]}
                            onPress={() =>
                              setSelectedEmployeeId(
                                emp.id
                              )
                            }
                          >
                            <Text
                              style={[
                                styles.employeeText,
                                sel &&
                                styles.employeeTextActive,
                              ]}
                            >
                              {emp.nome}
                            </Text>

                            {sel && (
                              <Ionicons
                                name="checkmark"
                                size={16}
                                color="#FFFFFF"
                              />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </>
                )}
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() =>
                    setTaskModalVisible(false)
                  }
                >
                  <Text style={styles.cancelBtnText}>
                    Cancelar
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveBtn, creatingTask && { opacity: 0.6 }]}
                  onPress={handleCreateTask}
                  disabled={creatingTask}
                >
                  {creatingTask ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>Criar Tarefa</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ─── Modal Criar Reunião ────────────────────────────────────────── */}

      <Modal
        animationType="slide"
        transparent={true}
        visible={meetingModalVisible}
        onRequestClose={() =>
          setMeetingModalVisible(false)
        }
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ width: "100%", justifyContent: "flex-end" }}
          >
            <View style={styles.taskModal}>
              <View style={styles.accountModalHeader}>
                <Text style={styles.accountModalTitle}>
                  {userType === "company" ? "Nova Reunião" : "Solicitar Reunião"}
                </Text>

                <TouchableOpacity
                  onPress={() =>
                    setMeetingModalVisible(false)
                  }
                >
                  <Ionicons
                    name="close"
                    size={24}
                    color="#285A71"
                  />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                style={{ maxHeight: 460 }}
                contentContainerStyle={{ paddingBottom: 10 }}
              >

                <Text style={styles.inputLabel}>
                  Assunto da Reunião
                </Text>

                <TextInput
                  style={styles.textInput}
                  placeholder="Ex: Alinhamento Estratégico do Trimestre"
                  placeholderTextColor="#94A3B8"
                  value={meetingSubject}
                  onChangeText={(value) => {
                    setMeetingSubject(value);
                    setMeetingError("");
                  }}
                />

                {/* Calendário Interativo */}
                <CalendarDatePicker
                  value={meetingDate}
                  onChange={setMeetingDate}
                  label="Data da Reunião"
                />

                {/* Seletor Numérico de Horário */}
                <TimePickerInput
                  value={meetingTime}
                  onChange={setMeetingTime}
                  label="Horário da Reunião"
                />

                <Text style={styles.inputLabel}>Link da reunião (opcional)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="https://meet.google.com/..."
                  placeholderTextColor="#94A3B8"
                  value={meetingLink}
                  onChangeText={(value) => {
                    setMeetingLink(value);
                    setMeetingError("");
                  }}
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                {meetingError ? (
                  <Text style={{ color: "#DC2626", fontSize: 12, marginTop: 6 }}>
                    {meetingError}
                  </Text>
                ) : null}

                {userType === "company" ? (
                  <Text style={styles.inputLabel}>Convidar Participantes</Text>
                ) : null}

                {userType === "company" ? <ScrollView
                  style={styles.employeeList}
                  nestedScrollEnabled
                >
                  {employees.length === 0 ? (
                    <Text
                      style={{
                        fontSize: 12,
                        color: "#94A3B8",
                        textAlign: "center",
                        marginVertical: 10,
                      }}
                    >
                      Nenhum colaborador encontrado
                    </Text>
                  ) : (
                    employees.map((emp) => {
                      const isSelected =
                        selectedMeetingEmployeeIds.includes(
                          emp.id
                        );

                      return (
                        <TouchableOpacity
                          key={emp.id}
                          style={[
                            styles.employeeRow,
                            isSelected &&
                            styles.employeeRowActive,
                          ]}
                          onPress={() => {
                            if (isSelected) {
                              setSelectedMeetingEmployeeIds(
                                (prev) =>
                                  prev.filter(
                                    (id) =>
                                      id !== emp.id
                                  )
                              );
                            } else {
                              setSelectedMeetingEmployeeIds(
                                (prev) => [
                                  ...prev,
                                  emp.id,
                                ]
                              );
                            }
                          }}
                        >
                          <Text
                            style={[
                              styles.employeeText,
                              isSelected &&
                              styles.employeeTextActive,
                            ]}
                          >
                            {emp.nome}
                          </Text>

                          {isSelected && (
                            <Ionicons
                              name="checkmark"
                              size={16}
                              color="#FFFFFF"
                            />
                          )}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView> : null}
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() =>
                    setMeetingModalVisible(false)
                  }
                  disabled={creatingMeeting}
                >
                  <Text style={styles.cancelBtnText}>
                    Cancelar
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.saveBtn,
                    creatingMeeting && {
                      opacity: 0.6,
                    },
                  ]}
                  onPress={handleCreateMeeting}
                  disabled={creatingMeeting}
                >
                  {creatingMeeting ? (
                    <ActivityIndicator
                      color="#FFFFFF"
                      size="small"
                    />
                  ) : (
                    <Text style={styles.saveBtnText}>
                      {userType === "company" ? "Agendar Reunião" : "Enviar solicitação"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ─── Modal de Sucesso da Reunião ───────────────────────────────── */}

      <Modal
        animationType="fade"
        transparent={true}
        visible={meetingSuccessVisible}
        onRequestClose={() =>
          setMeetingSuccessVisible(false)
        }
      >
        <View style={styles.successOverlay}>
          <View style={styles.successModal}>
            <View style={styles.successIcon}>
              <Ionicons
                name="checkmark"
                size={42}
                color="#FFFFFF"
              />
            </View>

            <Text style={styles.successTitle}>
              {userType === "company" ? "Reunião agendada!" : "Solicitação enviada!"}
            </Text>

            <Text style={styles.successText}>
              {userType === "company"
                ? "A reunião foi criada com sucesso."
                : "Sua solicitação foi enviada para a administração."}
            </Text>

            <TouchableOpacity
              style={styles.successButton}
              onPress={() => {
                setMeetingSuccessVisible(false);
                setActiveTab("Reuniões");
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.successButtonText}>
                OK
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FEFDF9",
  },

  header: {
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },

  logoBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#ECEFD9",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DCE3BE",
  },

  logo: {
    width: 28,
    height: 28,
    tintColor: "#4E8752",
  },

  headerGreeting: {
    justifyContent: "center",
  },

  greetingTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#285A71",
  },

  greetingRole: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 1,
  },

  headerRight: {
    alignItems: "center",
    justifyContent: "center",
  },

  pointsPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },

  pointsPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#B45309",
  },

  headerAccountButton: {
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
  },

  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: "#285A71",
  },

  headerAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#ECEFD9",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#DCE3BE",
  },

  dateScroll: {
    flexGrow: 0,
    flexShrink: 0,
    height: 76,
    maxHeight: 76,
  },

  dateContainer: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    gap: 10,
    alignItems: "center",
  },

  dateButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 16,
    width: 62,
    height: 60,
    backgroundColor: "#ECEFD9",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D8DFBC",
    shadowColor: "#285A71",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },

  dateButtonSelected: {
    backgroundColor: "#285A71",
    borderColor: "#285A71",
    shadowColor: "#285A71",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  dateButtonHover: {
    transform: [{ translateY: -3 }],
    elevation: 4,
  },

  dateWeekday: {
    fontSize: 10,
    fontWeight: "700",
    color: "#477387",
    letterSpacing: 0.5,
    marginBottom: 2,
  },

  dateWeekdaySelected: {
    color: "#A2C3D3",
  },

  dateDay: {
    fontSize: 18,
    fontWeight: "800",
    color: "#285A71",
  },

  dateDaySelected: {
    color: "#FFFFFF",
  },

  content: {
    flex: 1,
  },

  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    marginTop: 4,
  },

  // ─── Abas com Design de Pílula ──────────────────────────────────────────

  tabBarContainer: {
    flexDirection: "row",
    backgroundColor: "#EFF3DE",
    borderRadius: 16,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#D8DFBC",
  },

  tabPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
  },

  tabPillActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#285A71",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  tabLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },

  tabLabelActive: {
    color: "#285A71",
  },

  tabBadge: {
    backgroundColor: "#DCE3BE",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 6,
  },

  tabBadgeActive: {
    backgroundColor: "#E2EEF4",
  },

  tabBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#477387",
  },

  tabBadgeTextActive: {
    color: "#285A71",
  },

  // ─── Cards ────────────────────────────────────────────────────────────

  card: {
    backgroundColor: "#ECEFD9",
    borderRadius: 22,
    borderColor: "#D2DBB2",
    borderWidth: 1,
    padding: 18,
    shadowColor: "#285A71",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  cardSpacing: {
    marginTop: 16,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  cardTitleBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  cardHeaderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#285A71",
  },

  cardCountPill: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },

  cardCountText: {
    fontSize: 11,
    fontWeight: "800",
  },

  chevronBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },

  taskList: {
    marginTop: 16,
    gap: 12,
  },

  taskItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E6ECDD",
    shadowColor: "#285A71",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },

  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#285A71",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
    marginRight: 10,
  },

  avatarText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  taskName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
    lineHeight: 18,
  },

  urgentBadge: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: "#FECACA",
  },

  urgentBadgeText: {
    color: "#DC2626",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  taskBadgeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#E0EDF3",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: "#CCE3ED",
  },
  taskBadgeTagText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#285A71",
    letterSpacing: 0.3,
  },

  meetingBadgeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#ECEFD9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: "#D4DCB3",
  },
  meetingBadgeTagText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#285A71",
    letterSpacing: 0.3,
  },

  taskPointsBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DCFCE7",
    marginRight: 4,
  },

  taskPoints: {
    fontSize: 12,
    fontWeight: "800",
    color: "#16A34A",
  },

  checkButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  statusDot: {
    width: 6,
    height: 24,
    borderRadius: 3,
    backgroundColor: "#16A34A",
  },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 14,
  },

  loadingLabel: {
    color: "#285A71",
    fontSize: 14,
    fontWeight: "600",
  },

  emptyText: {
    color: "#64748B",
    textAlign: "center",
    paddingVertical: 15,
    fontSize: 14,
  },

  // ─── Reuniões ────────────────────────────────────────────────────────

  emptyMeetingBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 30,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyMeetingTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "700",
    color: "#285A71",
    textAlign: "center",
  },

  emptyMeetingText: {
    marginTop: 6,
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
  },

  menuBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
    zIndex: 98,
  },

  dropupMenu: {
    position: "absolute",
    right: 24,
    bottom: 170,
    alignItems: "flex-end",
    zIndex: 99,
  },

  menuCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderColor: "#E5E7EB",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#0F172A",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 6,
  },

  menuText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#285A71",
  },

  floatingButton: {
    position: "absolute",
    right: 24,
    bottom: 96,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#285A71",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#285A71",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 8,
    zIndex: 100,
  },

  floatingButtonActive: {
    backgroundColor: "#1E4253",
  },

  bottomNavigation: {
    height: 80,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 10,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },

  navButton: {
    minWidth: 64,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  navLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
  },

  // ─── Modais ──────────────────────────────────────────────────────────

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },

  // ─── Modal de sucesso da reunião ────────────────────────────────────

  successOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },

  successModal: {
    width: "100%",
    backgroundColor: "#FEFDF9",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ECEFD9",
  },

  successIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },

  successTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#285A71",
    textAlign: "center",
    marginBottom: 8,
  },

  successText: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 22,
  },

  successButton: {
    width: "100%",
    paddingVertical: 13,
    backgroundColor: "#285A71",
    borderRadius: 12,
    alignItems: "center",
  },

  successButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  accountModal: {
    backgroundColor: "#FEFDF9",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderColor: "#ECEFD9",
  },

  accountModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },

  accountModalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#285A71",
  },

  accountAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#285A71",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 16,
  },

  accountInfo: {
    alignItems: "center",
    marginBottom: 24,
  },

  accountName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#285A71",
    marginBottom: 4,
  },

  accountEmail: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 20,
  },

  accountStatRow: {
    flexDirection: "row",
    gap: 20,
  },

  accountStat: {
    alignItems: "center",
    gap: 4,
  },

  accountStatValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#285A71",
  },

  accountStatLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
  },

  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#285A71",
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },

  logoutButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  taskModal: {
    backgroundColor: "#FEFDF9",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderColor: "#ECEFD9",
  },

  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#285A71",
    marginBottom: 8,
    marginTop: 12,
  },

  textInput: {
    backgroundColor: "#ECEFD9",
    padding: 12,
    borderRadius: 12,
    fontSize: 14,
    color: "#285A71",
    borderWidth: 0.5,
    borderColor: "#285A71",
  },

  optionRow: {
    flexDirection: "row",
    gap: 8,
  },

  optionBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 2,
    backgroundColor: "#ECEFD9",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: "#285A71",
  },

  optionBtnUrgent: {
    backgroundColor: "#EF4444",
    borderColor: "#EF4444",
  },

  optionBtnNormal: {
    backgroundColor: "#285A71",
    borderColor: "#285A71",
  },

  optionText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#285A71",
    textAlign: "center",
  },

  optionTextActive: {
    color: "#FFFFFF",
  },

  employeeList: {
    maxHeight: 110,
    borderWidth: 0.5,
    borderColor: "#285A71",
    borderRadius: 12,
    backgroundColor: "#ECEFD9",
    padding: 6,
  },

  employeeRow: {
    padding: 10,
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },

  employeeRowActive: {
    backgroundColor: "#285A71",
  },

  employeeText: {
    fontSize: 13,
    color: "#285A71",
    fontWeight: "600",
  },

  employeeTextActive: {
    color: "#FFFFFF",
  },

  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },

  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: "#ECEFD9",
    borderRadius: 12,
    alignItems: "center",
  },

  cancelBtnText: {
    color: "#285A71",
    fontSize: 14,
    fontWeight: "700",
  },

  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: "#285A71",
    borderRadius: 12,
    alignItems: "center",
  },

  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});