import React, { useState, useEffect, useRef } from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Alert,
  Modal,
  Image,
  Linking,
  ActivityIndicator,
  useWindowDimensions,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, Stack } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import { authenticatedFetch } from "../services/api";
import { API_URL } from "../services/config";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type ContactItem = {
  id: number;
  name: string;
  avatar: string;
  foto?: string | null;
  online: boolean;
  role: string;
};

type ChatMessage = {
  id: string;
  text: string;
  sender: "me" | "them";
  time: string;
  sentAt?: string | null;
};

type ChatListItem = {
  id: number;
  name: string;
  avatar: string;
  foto?: string | null;
  online: boolean;
  lastMessage: string;
  time: string;
  lastSentAt?: string | null;
  unreadCount: number;
  role: string;
  messages: ChatMessage[];
};

// Converte ISO (UTC do servidor) para o fuso horário real do aparelho de quem envia/recebe
function formatMessageTimeLocal(sentAt?: string | null, fallbackTime?: string): string {
  if (sentAt) {
    const parsed = new Date(sentAt);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    }
  }
  return fallbackTime || "";
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
    reader.onload = (ev) => resolve((ev.target?.result as string) || "");
    reader.readAsDataURL(file);
  });
}

// Reduz fotos grandes de celulares (iPhone Fototeca/Câmera e Android) usando ObjectURL + Canvas
async function compressWebImageFile(file: File): Promise<{ dataUrl: string; convertedToJpeg: boolean }> {
  if (typeof document === "undefined" || typeof window === "undefined" || typeof URL === "undefined") {
    const raw = await readFileAsDataUrl(file);
    return { dataUrl: raw, convertedToJpeg: false };
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();

    const cleanup = () => {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        // ignore
      }
    };

    img.onload = () => {
      try {
        const MAX_DIM = 1280;
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        if (!width || !height) {
          cleanup();
          readFileAsDataUrl(file)
            .then((raw) => resolve({ dataUrl: raw, convertedToJpeg: false }))
            .catch(reject);
          return;
        }
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width >= height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          cleanup();
          readFileAsDataUrl(file)
            .then((raw) => resolve({ dataUrl: raw, convertedToJpeg: false }))
            .catch(reject);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL("image/jpeg", 0.8);
        cleanup();
        if (compressed && compressed.startsWith("data:image/jpeg;base64,") && compressed.length > 64) {
          resolve({ dataUrl: compressed, convertedToJpeg: true });
        } else {
          readFileAsDataUrl(file)
            .then((raw) => resolve({ dataUrl: raw, convertedToJpeg: false }))
            .catch(reject);
        }
      } catch {
        cleanup();
        readFileAsDataUrl(file)
          .then((raw) => resolve({ dataUrl: raw, convertedToJpeg: false }))
          .catch(reject);
      }
    };

    img.onerror = () => {
      cleanup();
      readFileAsDataUrl(file)
        .then((raw) => resolve({ dataUrl: raw, convertedToJpeg: false }))
        .catch(reject);
    };

    img.src = objectUrl;
  });
}

function getAvatarSource(foto?: string | null) {
  if (!foto) return null;
  if (
    foto.startsWith("data:") ||
    foto.startsWith("http://") ||
    foto.startsWith("https://")
  ) {
    return { uri: foto };
  }
  return { uri: `${API_URL}${foto.startsWith("/") ? foto : `/${foto}`}` };
}

// Utilitário para blindar a exibição da pré-visualização de mensagens (sidebar e listagens)
// Remove e mascara caminhos e rotas técnicas (/uploads/chat/...) exibindo no padrão elegante do WhatsApp
export const formatMessagePreview = (rawMessage?: string | null): string => {
  if (!rawMessage) return "";
  const trimmed = rawMessage.trim();
  if (trimmed === "Conversa iniciada") return trimmed;

  if (
    trimmed === "🚫 Esta mensagem foi apagada" ||
    trimmed === "🚫 Você apagou esta mensagem"
  ) {
    return "🚫 Mensagem apagada";
  }

  const isImage = trimmed.startsWith("📷 [Foto]") || trimmed.startsWith("📷 Foto");
  const isFile = trimmed.startsWith("📎 [Arquivo]") || trimmed.startsWith("📎 Arquivo");

  if (isImage) {
    const parts = trimmed.split(" - ");
    const comment = parts.length > 1 ? parts.slice(1).join(" - ").trim() : null;
    return comment ? `📷 ${comment}` : "📷 Foto";
  }

  if (isFile) {
    const parts = trimmed.split(" - ");
    const headerPart = parts[0];
    const comment = parts.length > 1 ? parts.slice(1).join(" - ").trim() : null;
    const fileRef = headerPart
      .replace("📎 [Arquivo]", "")
      .replace("📎 Arquivo", "")
      .trim();

    let displayName = "Documento";
    if (fileRef && !fileRef.startsWith("/uploads/") && !fileRef.startsWith("http")) {
      displayName = fileRef.split("/").pop() || "Documento";
    }

    return comment ? `📎 ${displayName} • ${comment}` : `📎 ${displayName}`;
  }

  // Proteção contra vazamento de rota técnica caso uma URL venha solta no texto
  if (trimmed.includes("/uploads/chat/")) {
    const isImgExt = /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(trimmed);
    return isImgExt ? "📷 Foto" : "📎 Arquivo";
  }

  return trimmed;
};

// Utilitário para exibir título amigável de anexo sem mostrar rotas do servidor (/uploads/...)
export const getSafeAttachmentTitle = (
  fileRef?: string | null,
  isImage?: boolean
): string => {
  if (!fileRef) return isImage ? "Foto.jpg" : "Documento.pdf";
  const cleanRef = fileRef.trim();
  if (cleanRef.startsWith("/uploads/") || cleanRef.startsWith("http")) {
    const rawFileName = cleanRef.split("/").pop() || "";
    if (rawFileName.startsWith("chat-") || !rawFileName) {
      return isImage ? "Foto anexada" : "Documento anexo";
    }
    return rawFileName;
  }
  return cleanRef;
};

// Categorias e emojis para o seletor estilo WhatsApp
const EMOJI_CATEGORIES = [
  {
    name: "Populares",
    emojis: ["😊", "😂", "🤣", "❤️", "👍", "🔥", "🙏", "😍", "🎉", "👏", "✨", "🙌", "😎", "🚀", "💼", "💯"],
  },
  {
    name: "Expressões",
    emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "😉", "🙂", "🙃", "🥰", "😘", "😋", "😜", "🤪", "🤩", "🥳", "😏", "🙄", "😬", "🤫", "🤔", "🤐", "😴", "😷", "🤒", "🤯", "🤠", "🥺", "😭", "😤", "😡"],
  },
  {
    name: "Mãos & Gestos",
    emojis: ["👍", "👎", "👏", "🙌", "🤝", "👊", "✌️", "🤞", "🤟", "🤘", "👌", "🤏", "👈", "👉", "👆", "👇", "☝️", "✋", "👋", "🤙", "💪", "🙏"],
  },
  {
    name: "Corações & Emoções",
    emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "🔥", "✨", "⭐", "🌟", "💥"],
  },
  {
    name: "Trabalho & Objetos",
    emojis: ["💼", "📊", "📈", "📁", "📂", "📄", "📎", "📌", "📍", "📅", "📆", "⏰", "⏳", "💻", "📱", "💡", "🎯", "🏆", "🥇", "✅", "❌", "⚠️"],
  },
];

// Armazenamento local de mensagens apagadas 'Para mim'
const HIDDEN_MESSAGES_KEY = "coopera_chat_hidden_messages";

async function getHiddenMessageIds(): Promise<Set<string>> {
  try {
    let raw: string | null = null;
    if (Platform.OS === "web") {
      raw = typeof localStorage !== "undefined" ? localStorage.getItem(HIDDEN_MESSAGES_KEY) : null;
    } else {
      raw = await SecureStore.getItemAsync(HIDDEN_MESSAGES_KEY);
    }
    if (raw) {
      const arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr.map(String) : []);
    }
  } catch (e) {
    console.warn("Erro ao ler hidden messages", e);
  }
  return new Set();
}

async function persistHiddenMessageIds(idsSet: Set<string>) {
  try {
    const json = JSON.stringify(Array.from(idsSet));
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(HIDDEN_MESSAGES_KEY, json);
      }
    } else {
      await SecureStore.setItemAsync(HIDDEN_MESSAGES_KEY, json);
    }
  } catch (e) {
    console.warn("Erro ao persistir hidden messages", e);
  }
}

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  // No web, verificamos tanto windowWidth quanto window.innerWidth para garantir renderização desktop
  const effectiveWidth =
    windowWidth > 0
      ? windowWidth
      : Platform.OS === "web" && typeof window !== "undefined"
        ? window.innerWidth
        : 0;

  const isDesktop =
    effectiveWidth >= 680 ||
    (Platform.OS === "web" &&
      typeof window !== "undefined" &&
      window.innerWidth >= 680);

  // Estados
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [contactsList, setContactsList] = useState<ContactItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"mensagens" | "contatos">("mensagens");
  const [selectedChat, setSelectedChat] = useState<ChatListItem | null>(null);
  const [inputText, setInputText] = useState("");
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    type: "image" | "file";
    uri?: string;
    base64?: string;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isNewChatModalVisible, setIsNewChatModalVisible] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState("");
  const [deleteTargetMessage, setDeleteTargetMessage] = useState<ChatMessage | null>(null);
  const [isDeletingMessage, setIsDeletingMessage] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedEmojiCategory, setSelectedEmojiCategory] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const scrollViewRef = useRef<any>(null);
  const inputRef = useRef<any>(null);
  const webFileInputRef = useRef<any>(null);
  const selectedChatRef = useRef<ChatListItem | null>(selectedChat);
  const hiddenMessageIdsRef = useRef<Set<string>>(new Set());
  const pendingSendCountRef = useRef<number>(0);
  const sendQueueRef = useRef<Promise<void>>(Promise.resolve());

  // Gerenciamento dinâmico de teclado para evitar que o input fique escondido
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, () => {
      setIsKeyboardVisible(true);
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      });
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  // Carrega conversas do backend
  const loadConversations = async () => {
    try {
      const res = await authenticatedFetch("/chat/conversations");
      if (res.ok) {
        const body = await res.json();
        const loadedChats: ChatListItem[] = (body.data ?? []).map((c: any) => ({
          ...c,
          time: formatMessageTimeLocal(c.lastSentAt, c.time),
          messages: Array.isArray(c.messages)
            ? c.messages
                .filter((m: any) => !hiddenMessageIdsRef.current.has(String(m.id)))
                .map((m: any) => ({
                  ...m,
                  time: formatMessageTimeLocal(m.sentAt, m.time),
                }))
            : [],
        }));
        setChats(loadedChats);

        // Se for desktop e nenhuma conversa estiver aberta, seleciona a primeira por padrão
        if (isDesktop && loadedChats.length > 0) {
          setSelectedChat((prev) => {
            if (!prev) {
              handleOpenChat(loadedChats[0]);
              return { ...loadedChats[0], messages: [] };
            }
            return prev;
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Carrega contatos da empresa do backend
  const loadContacts = async () => {
    try {
      const res = await authenticatedFetch("/chat/contacts");
      if (res.ok) {
        const body = await res.json();
        setContactsList(body.data ?? []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    getHiddenMessageIds().then((ids) => {
      hiddenMessageIdsRef.current = ids;
      loadConversations();
      loadContacts();
    });
  }, []);

  // Polling paralelo sem sobreposição de requisições (evita gargalo em 4G / serverless)
  useEffect(() => {
    let isPolling = false;

    const timer = setInterval(async () => {
      if (isPolling || pendingSendCountRef.current > 0) return;
      if (
        Platform.OS === "web" &&
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        return;
      }

      isPolling = true;
      try {
        const active = selectedChatRef.current;

        const [msgRes, convRes] = await Promise.all([
          active?.id
            ? authenticatedFetch(`/chat/${active.id}/messages`).catch(() => null)
            : Promise.resolve(null),
          authenticatedFetch("/chat/conversations").catch(() => null),
        ]);

        if (active?.id && msgRes && msgRes.ok && pendingSendCountRef.current === 0) {
          const body = await msgRes.json();
          const rawMessages: ChatMessage[] = (body.data ?? []).map((m: any) => ({
            ...m,
            time: formatMessageTimeLocal(m.sentAt, m.time),
          }));
          const freshMessages = rawMessages.filter(
            (m) => !hiddenMessageIdsRef.current.has(String(m.id))
          );
          setSelectedChat((prev) => {
            if (!prev || prev.id !== active.id) return prev;
            const prevMsgs = prev.messages || [];
            const pendingOptimistic = prevMsgs.filter((m) =>
              String(m.id).startsWith("temp-")
            );
            const mergedMessages =
              pendingOptimistic.length > 0
                ? [...freshMessages, ...pendingOptimistic]
                : freshMessages;
            const hasDiff =
              mergedMessages.length !== prevMsgs.length ||
              mergedMessages.some(
                (fm, idx) =>
                  fm.id !== prevMsgs[idx]?.id || fm.text !== prevMsgs[idx]?.text
              );
            if (hasDiff) {
              return { ...prev, messages: mergedMessages };
            }
            return prev;
          });
        }

        if (convRes && convRes.ok) {
          const body = await convRes.json();
          const loaded: ChatListItem[] = (body.data ?? []).map((c: any) => ({
            ...c,
            time: formatMessageTimeLocal(c.lastSentAt, c.time),
          }));
          setChats((prevList) => {
            return loaded.map((fresh) => {
              const prev = prevList.find((c) => c.id === fresh.id);
              const isActive = selectedChatRef.current?.id === fresh.id;
              let unread = 0;
              if (!isActive && prev) {
                if (
                  fresh.lastMessage &&
                  fresh.lastMessage !== prev.lastMessage &&
                  fresh.lastMessage !== "Conversa iniciada"
                ) {
                  unread = (prev.unreadCount || 0) + 1;
                } else {
                  unread = prev.unreadCount || 0;
                }
              }
              return {
                ...fresh,
                unreadCount: isActive ? 0 : unread,
                messages: prev ? prev.messages : [],
              };
            });
          });

          if (active?.id) {
            const activeFresh = loaded.find((c) => c.id === active.id);
            if (
              activeFresh &&
              (activeFresh.foto !== active.foto ||
                activeFresh.online !== active.online)
            ) {
              setSelectedChat((prev) =>
                prev
                  ? {
                    ...prev,
                    foto: activeFresh.foto,
                    online: activeFresh.online,
                  }
                  : null
              );
            }
          }
        }
      } finally {
        isPolling = false;
      }
    }, 3500);

    return () => clearInterval(timer);
  }, []);

  // Total de mensagens não lidas
  const totalUnreadCount = chats.reduce(
    (acc, c) => acc + (c.unreadCount || 0),
    0
  );

  // Lista filtrada de conversas com base na busca (considera nome, mensagem crua e preview blindado)
  const filteredChats = chats.filter((chat) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    const nameMatch = chat.name.toLowerCase().includes(query);
    const lastMsg = chat.lastMessage || "";
    const rawMatch = lastMsg.toLowerCase().includes(query);
    const previewMatch = formatMessagePreview(lastMsg).toLowerCase().includes(query);
    return nameMatch || rawMatch || previewMatch;
  });

  // Lista filtrada de contatos
  const filteredContacts = contactsList.filter(
    (contact) =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Contatos filtrados dentro do modal "Novo Chat"
  const modalFilteredContacts = contactsList.filter(
    (contact) =>
      contact.name.toLowerCase().includes(newChatSearch.toLowerCase()) ||
      contact.role.toLowerCase().includes(newChatSearch.toLowerCase())
  );

  // Auto-scroll para o fim das mensagens quando o chat muda ou novas mensagens chegam
  useEffect(() => {
    if (selectedChat) {
      const timer = setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [selectedChat?.id, selectedChat?.messages?.length]);

  // Abre uma conversa existente e carrega o histórico de mensagens
  const handleOpenChat = async (chat: ChatListItem) => {
    setSelectedChat((prev) => (prev?.id === chat.id ? prev : { ...chat, messages: [] }));
    // Zera badge não lidas no chat local imediatamente
    setChats((prev) =>
      prev.map((c) => (c.id === chat.id ? { ...c, unreadCount: 0 } : c))
    );
    try {
      const res = await authenticatedFetch(`/chat/${chat.id}/messages`);
      if (res.ok) {
        const body = await res.json();
        const loadedMessages: ChatMessage[] = (body.data ?? []).map((m: any) => ({
          ...m,
          time: formatMessageTimeLocal(m.sentAt, m.time),
        }));
        const visibleMessages = loadedMessages.filter(
          (m) => !hiddenMessageIdsRef.current.has(String(m.id))
        );
        setSelectedChat({ ...chat, messages: visibleMessages });
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Seleciona um contato da lista de contatos para criar ou abrir conversa
  const handleSelectContact = async (contact: ContactItem) => {
    try {
      const res = await authenticatedFetch("/chat/conversations", {
        method: "POST",
        body: JSON.stringify({ targetUserId: contact.id }),
      });
      if (res.ok) {
        const body = await res.json();
        const chatId = body.data?.id;
        if (chatId) {
          await loadConversations();
          const targetChat: ChatListItem = {
            id: chatId,
            name: contact.name,
            avatar: contact.avatar,
            foto: contact.foto,
            online: contact.online,
            lastMessage: "Conversa iniciada",
            time: "Agora",
            unreadCount: 0,
            role: contact.role,
            messages: [],
          };
          handleOpenChat(targetChat);
          setActiveTab("mensagens");
          setIsNewChatModalVisible(false);
          setNewChatSearch("");
        }
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Erro", "Não foi possível abrir a conversa com este contato.");
    }
  };

  // Abre o modal de exclusão estilo WhatsApp
  const handleOpenDeleteModal = (msg: ChatMessage) => {
    setDeleteTargetMessage(msg);
  };

  // Executa exclusão da mensagem (estilo WhatsApp: para todos ou apenas para mim)
  const executeDeleteMessage = async (message: ChatMessage, forEveryone: boolean) => {
    const msgId = message.id;
    setIsDeletingMessage(true);

    // Se for mensagem temporária que ainda não sincronizou
    if (msgId.startsWith("temp-")) {
      setSelectedChat((prev) =>
        prev
          ? {
            ...prev,
            messages: prev.messages.filter((m) => m.id !== msgId),
          }
          : null
      );
      setDeleteTargetMessage(null);
      setIsDeletingMessage(false);
      return;
    }

    // Se for "Apagar para mim"
    if (!forEveryone) {
      const stringId = String(msgId);
      hiddenMessageIdsRef.current.add(stringId);
      persistHiddenMessageIds(hiddenMessageIdsRef.current);

      setSelectedChat((prev) => {
        if (!prev) return null;
        const updated = prev.messages.filter((m) => String(m.id) !== stringId);
        const last =
          updated.length > 0
            ? updated[updated.length - 1].text
            : "Conversa iniciada";
        return {
          ...prev,
          lastMessage: last,
          messages: updated,
        };
      });

      setChats((prev) =>
        prev.map((c) => {
          if (c.id === selectedChat?.id) {
            const currentMsgs =
              selectedChat?.messages?.filter((m) => String(m.id) !== stringId) || [];
            const last =
              currentMsgs.length > 0
                ? currentMsgs[currentMsgs.length - 1].text
                : c.lastMessage;
            return { ...c, lastMessage: last };
          }
          return c;
        })
      );

      setDeleteTargetMessage(null);
      setIsDeletingMessage(false);
      return;
    }

    // Se for "Apagar para todos" (atualização otimista imediata estilo WhatsApp)
    setSelectedChat((prev) => {
      if (!prev) return null;
      const updated = prev.messages.map((m) =>
        m.id === msgId
          ? { ...m, text: "🚫 Esta mensagem foi apagada" }
          : m
      );
      const last =
        updated.length > 0
          ? updated[updated.length - 1].text
          : "Conversa iniciada";
      return {
        ...prev,
        lastMessage: last,
        messages: updated,
      };
    });

    setDeleteTargetMessage(null);

    try {
      const res = await authenticatedFetch(`/chat/${msgId}?forEveryone=true`, {
        method: "DELETE",
      });

      if (res.ok) {
        loadConversations();
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert("Aviso", err.message || "Não foi possível apagar a mensagem.");
        if (selectedChat?.id) {
          handleOpenChat(selectedChat);
        }
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Erro", "Erro ao apagar mensagem.");
    } finally {
      setIsDeletingMessage(false);
    }
  };

  // Processa arquivo escolhido no <input type="file"> persistente na Web (compatível com Fototeca do iPhone Safari)
  const handleWebFileSelected = async (e: any) => {
    const file: File | undefined = e?.target?.files?.[0];
    if (e?.target) {
      e.target.value = "";
    }
    if (!file) return;

    const isImg =
      file.type?.startsWith("image/") ||
      /\.(jpg|jpeg|png|gif|webp|heic|heif)$/i.test(file.name || "");

    if (!isImg && file.size > 3.2 * 1024 * 1024) {
      Alert.alert(
        "Arquivo muito grande",
        "Envie documentos de até 3 MB para garantir envio rápido."
      );
      return;
    }

    try {
      setIsUploading(true);
      if (isImg && !/\.gif$/i.test(file.name || "")) {
        const { dataUrl, convertedToJpeg } = await compressWebImageFile(file);
        const baseName = (file.name || "foto").replace(/\.[^.]+$/, "") || "foto";
        const origExtMatch = (file.name || "").match(/\.([a-zA-Z0-9]+)$/);
        const fallbackExt = origExtMatch ? `.${origExtMatch[1].toLowerCase()}` : ".jpg";
        const finalName = convertedToJpeg ? `${baseName}.jpg` : `${baseName}${fallbackExt}`;

        setAttachedFile({
          name: finalName,
          type: "image",
          uri: dataUrl,
          base64: dataUrl,
        });
      } else {
        const b64 = await readFileAsDataUrl(file);
        const defaultName = isImg ? "imagem.gif" : "documento.pdf";
        setAttachedFile({
          name: file.name || defaultName,
          type: isImg ? "image" : "file",
          uri: isImg ? b64 : undefined,
          base64: b64,
        });
      }
    } catch {
      Alert.alert("Erro", "Não foi possível processar a foto ou arquivo selecionado.");
    } finally {
      setIsUploading(false);
    }
  };

  // Abre o seletor de arquivos/imagens ao clicar no clipe
  const handlePickAttachment = async () => {
    try {
      if (Platform.OS === "web") {
        webFileInputRef.current?.click();
      } else {
        const permissionResult =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permissionResult.granted) {
          Alert.alert(
            "Permissão necessária",
            "É preciso permitir acesso à galeria para enviar fotos e arquivos."
          );
          return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 0.6,
          base64: true,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          const fileName =
            asset.fileName ||
            (asset.type === "video" ? "video.mp4" : "foto.jpg");
          setAttachedFile({
            name: fileName,
            type: asset.type === "video" ? "file" : "image",
            uri: asset.uri,
            base64: asset.base64
              ? `data:image/jpeg;base64,${asset.base64}`
              : undefined,
          });
        }
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Erro", "Não foi possível selecionar o arquivo.");
    }
  };

  // Envia mensagem real via API com suporte a upload de fotos estilo WhatsApp
  const handleSendMessage = async () => {
    if ((!inputText.trim() && !attachedFile) || !selectedChat) return;

    let textToSend = "";
    if (attachedFile) {
      const isImg = attachedFile.type === "image";
      let fileReference = attachedFile.name;

      // Se tivermos o base64 (imagem ou documento), fazemos upload para o servidor
      if (attachedFile.base64) {
        try {
          setIsUploading(true);
          const uploadRes = await authenticatedFetch("/chat/upload", {
            method: "POST",
            body: JSON.stringify({
              filename: attachedFile.name,
              base64: attachedFile.base64,
            }),
          });
          if (!uploadRes.ok) {
            const errBody = await uploadRes.json().catch(() => ({}));
            const errMsg = Array.isArray(errBody.message)
              ? errBody.message.join("\n")
              : errBody.message || `Falha ao enviar anexo (HTTP ${uploadRes.status}).`;
            Alert.alert("Não foi possível enviar o anexo", errMsg);
            return;
          }
          const uploadBody = await uploadRes.json();
          if (uploadBody.data?.url) {
            fileReference = uploadBody.data.url;
          }
        } catch (uploadErr) {
          console.warn("Falha no upload do anexo", uploadErr);
          Alert.alert(
            "Erro no envio",
            "Não foi possível enviar a foto ou arquivo. Verifique sua conexão ou tente um arquivo menor."
          );
          return;
        } finally {
          setIsUploading(false);
        }
      }

      // Encurta nomes muito longos se for apenas nome de arquivo (preserva URL /uploads/... ou https://...)
      const safeFileRef =
        fileReference.length > 60 &&
        !fileReference.startsWith("/uploads/") &&
        !fileReference.startsWith("http")
          ? fileReference.slice(0, 57) + "..."
          : fileReference;

      const prefix = isImg
        ? `📷 [Foto] ${safeFileRef}`
        : `📎 [Arquivo] ${safeFileRef}`;

      if (inputText.trim()) {
        const maxComment = 190 - prefix.length - 3;
        const comment = inputText.trim().slice(0, Math.max(10, maxComment));
        textToSend = `${prefix} - ${comment}`;
      } else {
        textToSend = prefix;
      }
    } else {
      textToSend = inputText.trim().slice(0, 200);
    }

    const chatId = Number(selectedChat.id);
    setInputText("");
    setAttachedFile(null);

    // Mantém o foco no campo de texto imediatamente
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    const nowTime = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const tempId = `temp-${Date.now()}-${Math.round(Math.random() * 1e5)}`;
    const tempMsg: ChatMessage = {
      id: tempId,
      text: textToSend,
      sender: "me",
      time: nowTime,
    };

    // Atualização otimista imediata na conversa ativa
    setSelectedChat((prev) =>
      prev
        ? {
          ...prev,
          lastMessage: textToSend,
          time: nowTime,
          messages: [...(prev.messages || []), tempMsg],
        }
        : null
    );

    // Atualiza preview na lista de conversas
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? {
            ...c,
            lastMessage: textToSend,
            time: nowTime,
          }
          : c
      )
    );

    // Enfileira envios sequencialmente para evitar pico concorrente no pool serverless em digitação rápida
    pendingSendCountRef.current += 1;
    sendQueueRef.current = sendQueueRef.current
      .catch(() => {})
      .then(async () => {
        const postOnce = () =>
          authenticatedFetch("/chat", {
            method: "POST",
            body: JSON.stringify({
              fk_id_chat: chatId,
              conteudo_mensagens: textToSend,
            }),
          });

        try {
          let res: Response;
          try {
            res = await postOnce();
            if (res.status >= 500) {
              await new Promise((r) => setTimeout(r, 350));
              res = await postOnce();
            }
          } catch {
            await new Promise((r) => setTimeout(r, 350));
            res = await postOnce();
          }

          if (res.ok) {
            const body = await res.json();
            const realId = body.data?.pk_id_mensagens
              ? String(body.data.pk_id_mensagens)
              : tempId;

            // Substitui o tempId pelo ID real retornado do banco
            setSelectedChat((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                messages: (prev.messages || []).map((m) =>
                  m.id === tempId ? { ...m, id: realId } : m
                ),
              };
            });
          } else {
            const err = await res.json().catch(() => ({}));
            const rawMsg = Array.isArray(err.message)
              ? err.message.join("\n")
              : String(err.message || "");
            const friendlyMsg =
              !rawMsg || rawMsg.toLowerCase() === "internal server error"
                ? "Não foi possível enviar a mensagem no momento. Tente novamente."
                : rawMsg;

            setSelectedChat((prev) =>
              prev
                ? {
                    ...prev,
                    messages: (prev.messages || []).filter((m) => m.id !== tempId),
                  }
                : null
            );
            Alert.alert("Erro", friendlyMsg);
          }
        } catch (e) {
          console.error(e);
          setSelectedChat((prev) =>
            prev
              ? {
                  ...prev,
                  messages: (prev.messages || []).filter((m) => m.id !== tempId),
                }
              : null
          );
          Alert.alert("Erro", "Não foi possível enviar a mensagem. Verifique sua conexão.");
        } finally {
          pendingSendCountRef.current = Math.max(0, pendingSendCountRef.current - 1);
          if (pendingSendCountRef.current === 0) {
            loadConversations();
          }
          setTimeout(() => {
            inputRef.current?.focus();
          }, 50);
        }
      });
  };

  // ─── Renderização da Lista de Conversas / Contatos (Sidebar Esquerda) ─────────
  const renderSidebarContent = () => (
    <View style={styles.sidebarInner}>
      {/* Cabeçalho da Sidebar com Safe Area */}
      <View
        style={[
          styles.sidebarHeader,
          {
            paddingTop:
              Platform.OS === "web"
                ? 16
                : Math.max(
                    insets.top,
                    Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 20
                  ) + 8,
          },
        ]}
      >
        <View style={styles.sidebarHeaderLeft}>
          <TouchableOpacity
            style={styles.backToDashboardBtn}
            onPress={() => router.replace("/dashboard")}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={20} color="#285A71" />
          </TouchableOpacity>
          <View>
            <Text style={styles.sidebarHeaderTitle}>Conversas</Text>
            <Text style={styles.sidebarHeaderSubtitle}>Comunicação interna Coopera</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            setIsNewChatModalVisible(true);
            loadContacts();
          }}
          activeOpacity={0.8}
        >
          <Ionicons
            name="create-outline"
            size={20}
            color="#285A71"
          />
        </TouchableOpacity>
      </View>

      {/* Caixa de Busca */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={17} color="#94A3B8" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar conversas ou contatos..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery("")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={17} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Seletor de Abas (Conversas / Contatos) */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "mensagens" && styles.tabButtonActive]}
          onPress={() => setActiveTab("mensagens")}
          activeOpacity={0.8}
        >
          <Ionicons
            name="chatbubbles"
            size={16}
            color={activeTab === "mensagens" ? "#285A71" : "#64748B"}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.tabLabel,
              activeTab === "mensagens" && styles.tabLabelActive,
            ]}
          >
            Conversas
          </Text>
          {totalUnreadCount > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{totalUnreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "contatos" && styles.tabButtonActive]}
          onPress={() => {
            setActiveTab("contatos");
            loadContacts();
          }}
          activeOpacity={0.8}
        >
          <Ionicons
            name="people"
            size={16}
            color={activeTab === "contatos" ? "#285A71" : "#64748B"}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.tabLabel,
              activeTab === "contatos" && styles.tabLabelActive,
            ]}
          >
            Contatos
          </Text>
        </TouchableOpacity>
      </View>

      {/* Lista de Conversas ou Contatos */}
      {activeTab === "mensagens" ? (
        <ScrollView style={styles.scrollList} showsVerticalScrollIndicator={false}>
          {filteredChats.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="chatbubbles-outline" size={36} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>Nenhuma conversa</Text>
              <Text style={styles.emptySubtitle}>
                Inicie uma conversa na aba Contatos ou clique abaixo.
              </Text>
              <TouchableOpacity
                style={styles.newChatEmptyBtn}
                onPress={() => setIsNewChatModalVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="add-circle"
                  size={18}
                  color="#FFFFFF"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.newChatEmptyBtnText}>Nova Conversa</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredChats.map((item) => {
              const isSelected = selectedChat?.id === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.chatCard, isSelected && styles.chatCardSelected]}
                  activeOpacity={0.7}
                  onPress={() => handleOpenChat(item)}
                >
                  <View style={styles.avatarContainer}>
                    <View
                      style={[styles.avatar, isSelected && styles.avatarSelected]}
                    >
                      {item.foto ? (
                        <Image
                          source={getAvatarSource(item.foto)!}
                          style={styles.avatarImgCover}
                        />
                      ) : (
                        <Text style={styles.avatarText}>{item.avatar}</Text>
                      )}
                    </View>
                    {item.online && <View style={styles.onlineDot} />}
                  </View>

                  <View style={styles.chatDetails}>
                    <View style={styles.chatHeaderRow}>
                      <Text
                        style={[
                          styles.chatName,
                          isSelected && styles.chatNameSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      <Text style={styles.chatTime}>{item.time}</Text>
                    </View>
                    <View style={styles.chatMessageRow}>
                      <Text style={styles.chatMessage} numberOfLines={1}>
                        {formatMessagePreview(item.lastMessage)}
                      </Text>
                      {item.unreadCount > 0 && (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadText}>{item.unreadCount}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: 16 }} />
        </ScrollView>
      ) : (
        <ScrollView style={styles.scrollList} showsVerticalScrollIndicator={false}>
          {filteredContacts.map((contact) => (
            <TouchableOpacity
              key={contact.id}
              style={styles.chatCard}
              activeOpacity={0.7}
              onPress={() => handleSelectContact(contact)}
            >
              <View style={styles.avatarContainer}>
                <View style={[styles.avatar, styles.contactAvatarBg]}>
                  {contact.foto ? (
                    <Image
                      source={getAvatarSource(contact.foto)!}
                      style={styles.avatarImgCover}
                    />
                  ) : (
                    <Text style={styles.avatarText}>{contact.avatar}</Text>
                  )}
                </View>
                {contact.online && <View style={styles.onlineDot} />}
              </View>

              <View style={styles.chatDetails}>
                <Text style={styles.chatName}>{contact.name}</Text>
                <Text style={styles.contactRole}>{contact.role}</Text>
              </View>

              <View style={styles.chatArrowCircle}>
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={16}
                  color="#285A71"
                />
              </View>
            </TouchableOpacity>
          ))}
          <View style={{ height: 16 }} />
        </ScrollView>
      )}

      {/* Barra de Navegação Inferior Coopera Oficial (Idêntica ao Ponto-E) */}
      <View style={styles.sidebarBottomNav}>
        <TouchableOpacity
          style={styles.navButton}
          activeOpacity={0.8}
          onPress={() => router.replace("/dashboard")}
        >
          <Ionicons name="home" size={26} color="#94A3B8" />
          <Text style={[styles.navLabel, { color: "#94A3B8" }]}>central</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          activeOpacity={0.8}
          onPress={() => router.push("/ponto-e")}
        >
          <Ionicons name="location" size={26} color="#94A3B8" />
          <Text style={[styles.navLabel, { color: "#94A3B8" }]}>Ponto-E</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} activeOpacity={0.8}>
          <Ionicons name="chatbubble-ellipses" size={26} color="#285A71" />
          <Text style={[styles.navLabel, { color: "#285A71" }]}>chats</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ─── Renderização da Conversa Aberta (Painel Direito / WhatsApp Style) ─────────
  const renderConversationContent = () => {
    if (!selectedChat) {
      return (
        <View style={styles.emptyConversationPane}>
          <View style={styles.emptyConversationIconCircle}>
            <Ionicons name="chatbubbles" size={60} color="#285A71" />
          </View>
          <Text style={styles.emptyConversationTitle}>Coopera Mensagens</Text>
          <Text style={styles.emptyConversationSubtitle}>
            Selecione uma conversa ao lado para visualizar o histórico e enviar
            mensagens em tempo real com sua equipe.
          </Text>
          <View style={styles.emptySecurityBadge}>
            <Ionicons
              name="lock-closed"
              size={14}
              color="#0D9488"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.emptySecurityText}>
              Criptografia de ponta a ponta ativa no canal Coopera
            </Text>
          </View>
        </View>
      );
    }

    const visibleMessages = (selectedChat.messages || []).filter(
      (m) => !hiddenMessageIdsRef.current.has(String(m.id))
    );

    return (
      <KeyboardAvoidingView
        style={styles.activeChatWrapper}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      >
        {/* Header da conversa estilo WhatsApp com Safe Area */}
        <View
          style={[
            styles.chatHeader,
            {
              paddingTop:
                Platform.OS === "web"
                  ? 0
                  : Math.max(
                      insets.top,
                      Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 20
                    ),
              height:
                Platform.OS === "web"
                  ? 66
                  : 66 +
                    Math.max(
                      insets.top,
                      Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 20
                    ),
            },
          ]}
        >
          <View style={styles.chatHeaderLeft}>
            {!isDesktop && (
              <TouchableOpacity
                onPress={() => setSelectedChat(null)}
                style={styles.backBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={22} color="#285A71" />
              </TouchableOpacity>
            )}

            <View style={styles.avatarWrapper}>
              <View style={styles.avatarHeader}>
                {selectedChat.foto ? (
                  <Image
                    source={getAvatarSource(selectedChat.foto)!}
                    style={styles.avatarHeaderImg}
                  />
                ) : (
                  <Text style={styles.avatarHeaderText}>{selectedChat.avatar}</Text>
                )}
              </View>
              {selectedChat.online && <View style={styles.avatarOnlineBadge} />}
            </View>

            <View style={styles.headerInfo}>
              <Text style={styles.headerName} numberOfLines={1}>
                {selectedChat.name}
              </Text>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusDotSmall,
                    selectedChat.online ? styles.dotOnline : styles.dotOffline,
                  ]}
                />
                <Text style={styles.headerSubtitle}>
                  {selectedChat.online
                    ? "Online agora • Conectado"
                    : selectedChat.role || "Offline"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Feed de Mensagens */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messageScroll}
          contentContainerStyle={styles.messageContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={() => {
            scrollViewRef.current?.scrollToEnd({ animated: false });
          }}
        >
          {/* Banner de Segurança & Criptografia */}
          <View style={styles.securityPill}>
            <Ionicons
              name="lock-closed"
              size={12}
              color="#0D9488"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.securityPillText}>
              Canal corporativo Coopera com criptografia ponta a ponta
            </Text>
          </View>

          {/* Divisor de Data */}
          <View style={styles.dateBadge}>
            <Text style={styles.dateBadgeText}>Hoje</Text>
          </View>

          {visibleMessages.length === 0 ? (
            <View style={styles.emptyMessagesBox}>
              <View style={styles.emptyMessagesIconCircle}>
                <Ionicons name="chatbubble-ellipses-outline" size={32} color="#285A71" />
              </View>
              <Text style={styles.emptyMessagesTitle}>Nenhuma mensagem ainda</Text>
              <Text style={styles.emptyMessagesSubtitle}>
                Envie uma mensagem abaixo para iniciar a conversa com {selectedChat.name}!
              </Text>
            </View>
          ) : (
            visibleMessages.map((msg) => {
              const isMe = msg.sender === "me";
              const isDeleted =
                msg.text === "🚫 Esta mensagem foi apagada" ||
                msg.text === "🚫 Você apagou esta mensagem";

              return (
                <View
                  key={msg.id}
                  style={[
                    styles.msgRow,
                    isMe ? styles.msgRowRight : styles.msgRowLeft,
                  ]}
                >
                  {!isMe && (
                    <View style={styles.msgAvatarThem}>
                      {selectedChat.foto ? (
                        <Image
                          source={getAvatarSource(selectedChat.foto)!}
                          style={styles.msgAvatarThemImg}
                        />
                      ) : (
                        <Text style={styles.msgAvatarText}>{selectedChat.avatar}</Text>
                      )}
                    </View>
                  )}

                  <View
                    style={[
                      styles.msgBubble,
                      isMe ? styles.msgBubbleRight : styles.msgBubbleLeft,
                      isDeleted &&
                      (isMe
                        ? styles.msgBubbleDeletedRight
                        : styles.msgBubbleDeletedLeft),
                    ]}
                  >
                    {!isMe && (
                      <Text style={styles.msgSenderName}>{selectedChat.name}</Text>
                    )}
                    {renderMessageBody(msg.text, isMe)}
                    <View style={styles.msgFooter}>
                      <Text
                        style={[
                          styles.msgTime,
                          isMe ? styles.msgTimeRight : styles.msgTimeLeft,
                          isDeleted && styles.msgTimeDeleted,
                        ]}
                      >
                        {msg.time}
                      </Text>
                      {isMe && !isDeleted && (
                        <Ionicons
                          name="checkmark-done"
                          size={14}
                          color="#6EE7B7"
                          style={{ marginLeft: 4 }}
                        />
                      )}
                      {!isDeleted && (
                        <TouchableOpacity
                          style={styles.deleteMsgBtn}
                          onPress={() => handleOpenDeleteModal(msg)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name="chevron-down"
                            size={14}
                            color={isMe ? "rgba(255, 255, 255, 0.75)" : "#64748B"}
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              );
            })
          )}

          {isTyping && (
            <View style={[styles.msgRow, styles.msgRowLeft]}>
              <View style={styles.msgAvatarThem}>
                {selectedChat.foto ? (
                  <Image
                    source={getAvatarSource(selectedChat.foto)!}
                    style={styles.msgAvatarThemImg}
                  />
                ) : (
                  <Text style={styles.msgAvatarText}>{selectedChat.avatar}</Text>
                )}
              </View>
              <View
                style={[
                  styles.msgBubble,
                  styles.msgBubbleLeft,
                  styles.typingBubble,
                ]}
              >
                <Text
                  style={[
                    styles.msgText,
                    styles.msgTextLeft,
                    { fontStyle: "italic", opacity: 0.75 },
                  ]}
                >
                  Digitando...
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input de Mensagem estilo WhatsApp */}
        {renderInputArea()}
      </KeyboardAvoidingView>
    );
  };

  // Renderiza corpo da mensagem com suporte a visualização de fotos e mensagens apagadas estilo WhatsApp
  const renderMessageBody = (text: string, isMe: boolean) => {
    const isDeleted =
        text === "🚫 Esta mensagem foi apagada" ||
        text === "🚫 Você apagou esta mensagem";

        if (isDeleted) {
      return (
        <View style={styles.deletedMessageContent}>
          <Ionicons
            name="ban-outline"
            size={15}
            color={isMe ? "#E2E8F0" : "#94A3B8"}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.deletedMessageText,
              isMe ? styles.deletedMessageTextRight : styles.deletedMessageTextLeft,
            ]}
          >
            {isMe ? "Você apagou esta mensagem" : "Esta mensagem foi apagada"}
          </Text>
        </View>
        );
    }

        const isImage = text.startsWith("📷 [Foto]");
        const isFile = text.startsWith("📎 [Arquivo]");

        if (isImage || isFile) {
      const parts = text.split(" - ");
        const headerPart = parts[0];
      const comment = parts.length > 1 ? parts.slice(1).join(" - ") : null;
        const fileRef = headerPart
        .replace("📷 [Foto]", "")
        .replace("📎 [Arquivo]", "")
        .trim();

        const isUploadedPhoto =
        isImage &&
        (fileRef.startsWith("/uploads/") ||
        fileRef.startsWith("http://") ||
        fileRef.startsWith("https://"));

        // Se for foto real salva no servidor, exibe a imagem aberta na bolha estilo WhatsApp
        if (isUploadedPhoto) {
        const fullPhotoUrl = fileRef.startsWith("http")
        ? fileRef
        : `${API_URL}${fileRef.startsWith("/") ? fileRef : `/${fileRef}`}`;

        return (
        <View style={styles.chatImageBubbleWrapper}>
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => setPreviewImageUrl(fullPhotoUrl)}
            style={styles.chatImageTouch}
          >
            <Image
              source={{ uri: fullPhotoUrl }}
              style={styles.chatImageContent}
              resizeMode="cover"
            />
            <View style={styles.chatImageZoomHint}>
              <Ionicons name="expand-outline" size={14} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
          {comment && (
            <Text
              style={[
                styles.msgText,
                styles.chatImageCaption,
                isMe ? styles.msgTextRight : styles.msgTextLeft,
              ]}
            >
              {comment}
            </Text>
          )}
        </View>
        );
      }

        // Se for arquivo ou documento (PDF, doc, etc.) — permite tocar para abrir/baixar
        const isDownloadableFile =
          fileRef.startsWith("/uploads/") ||
          fileRef.startsWith("http://") ||
          fileRef.startsWith("https://");
        const fullAttachmentUrl = fileRef.startsWith("http")
          ? fileRef
          : `${API_URL}${fileRef.startsWith("/") ? fileRef : `/${fileRef}`}`;

        const handleOpenAttachment = () => {
          if (!isDownloadableFile) {
            Alert.alert("Anexo indisponível", "Este arquivo não possui link disponível no servidor.");
            return;
          }
          if (Platform.OS === "web" && typeof window !== "undefined") {
            window.open(fullAttachmentUrl, "_blank", "noopener,noreferrer");
          } else {
            Linking.openURL(fullAttachmentUrl).catch(() =>
              Alert.alert("Erro", "Não foi possível abrir o anexo.")
            );
          }
        };

        return (
        <View style={styles.attachmentContentWrapper}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleOpenAttachment}
            style={[
              styles.attachmentCard,
              isMe ? styles.attachmentCardRight : styles.attachmentCardLeft,
            ]}
          >
            <View
              style={[
                styles.attachmentIconCircle,
                isImage ? styles.attachmentIconImg : styles.attachmentIconDoc,
              ]}
            >
              <Ionicons
                name={isImage ? "image" : "document-text"}
                size={22}
                color="#FFFFFF"
              />
            </View>
            <View style={styles.attachmentDetails}>
              <Text
                style={[
                  styles.attachmentTitle,
                  isMe ? styles.attachmentTitleRight : styles.attachmentTitleLeft,
                ]}
                numberOfLines={1}
              >
                {getSafeAttachmentTitle(fileRef, isImage)}
              </Text>
              <Text
                style={[
                  styles.attachmentSubtitle,
                  isMe
                    ? styles.attachmentSubtitleRight
                    : styles.attachmentSubtitleLeft,
                ]}
              >
                {isImage ? "Imagem" : "Toque para abrir"}
              </Text>
            </View>
            <Ionicons
              name="download-outline"
              size={18}
              color={isMe ? "#FFFFFF" : "#285A71"}
              style={{ marginLeft: 6, opacity: 0.85 }}
            />
          </TouchableOpacity>
          {comment && (
            <Text
              style={[
                styles.msgText,
                styles.attachmentCaptionText,
                isMe ? styles.msgTextRight : styles.msgTextLeft,
              ]}
            >
              {comment}
            </Text>
          )}
        </View>
        );
    }

        return (
        <Text
          style={[
            styles.msgText,
            isMe ? styles.msgTextRight : styles.msgTextLeft,
          ]}
        >
          {text}
        </Text>
        );
  };

  const handleSelectEmoji = (emoji: string) => {
          setInputText((prev) => (prev + emoji).slice(0, 200));
    requestAnimationFrame(() => {
          inputRef.current?.focus();
    });
  };

  const handleEmojiBackspace = () => {
          setInputText((prev) => {
            if (!prev) return "";
            return Array.from(prev).slice(0, -1).join("");
          });
  };

  const renderEmojiPicker = () => (
        <View style={styles.emojiPickerContainer}>
          <View style={styles.emojiPickerHeader}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.emojiCategoryScroll}
            >
              {EMOJI_CATEGORIES.map((cat, idx) => (
                <TouchableOpacity
                  key={cat.name}
                  style={[
                    styles.emojiCategoryTab,
                    selectedEmojiCategory === idx && styles.emojiCategoryTabActive,
                  ]}
                  onPress={() => setSelectedEmojiCategory(idx)}
                >
                  <Text
                    style={[
                      styles.emojiCategoryTabText,
                      selectedEmojiCategory === idx &&
                      styles.emojiCategoryTabTextActive,
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.emojiHeaderActions}>
              <TouchableOpacity
                style={styles.emojiActionBtn}
                onPress={handleEmojiBackspace}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="backspace-outline" size={18} color="#64748B" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.emojiActionBtn}
                onPress={() => setShowEmojiPicker(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            style={styles.emojiGridScroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.emojiGrid}>
              {EMOJI_CATEGORIES[selectedEmojiCategory].emojis.map((emoji, index) => (
                <TouchableOpacity
                  key={`${emoji}-${index}`}
                  style={styles.emojiGridItem}
                  activeOpacity={0.6}
                  onPress={() => handleSelectEmoji(emoji)}
                >
                  <Text style={styles.emojiGridChar}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
        );

  const renderInputArea = () => (
    <View
      style={[
        styles.inputAreaWrapper,
        {
          paddingBottom:
            Platform.OS === "ios"
              ? isKeyboardVisible
                ? 6
                : Math.max(insets.bottom, 8)
              : 8,
        },
      ]}
    >
      {/* Seletor de Emojis estilo WhatsApp */}
      {showEmojiPicker && renderEmojiPicker()}

      {/* Barra de Pré-visualização do Anexo */}
      {attachedFile && (
        <View style={styles.attachmentPreviewBar}>
          <View style={styles.attachmentPreviewInfo}>
            <View
              style={[
                styles.attachmentPreviewIconCircle,
                attachedFile.type === "image"
                  ? styles.attachmentIconImg
                  : styles.attachmentIconDoc,
              ]}
            >
              <Ionicons
                name={attachedFile.type === "image" ? "image" : "document-text"}
                size={16}
                color="#FFFFFF"
              />
            </View>
            <View style={styles.attachmentPreviewTextGroup}>
              <Text style={styles.attachmentPreviewName} numberOfLines={1}>
                {attachedFile.name}
              </Text>
              <Text style={styles.attachmentPreviewHint}>
                {attachedFile.type === "image"
                  ? "Imagem selecionada"
                  : "Arquivo selecionado"}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.attachmentPreviewRemoveBtn}
            onPress={() => setAttachedFile(null)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputArea}>
        <View style={styles.inputCapsule}>
          <TouchableOpacity
            style={[styles.capsuleIconBtn, { position: "relative", overflow: "hidden" }]}
            activeOpacity={0.7}
            onPress={Platform.OS === "web" ? undefined : handlePickAttachment}
          >
            <Ionicons
              name={attachedFile ? "attach" : "attach-outline"}
              size={22}
              color={attachedFile ? "#285A71" : "#64748B"}
            />
            {Platform.OS === "web" &&
              React.createElement("input", {
                ref: webFileInputRef,
                type: "file",
                accept: "image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv",
                onChange: handleWebFileSelected,
                style: {
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  opacity: 0,
                  cursor: "pointer",
                },
              })}
          </TouchableOpacity>

          <TextInput
            ref={inputRef}
            style={styles.chatInput}
            placeholder={
              attachedFile
                ? "Adicione uma legenda (opcional)..."
                : "Escreva sua mensagem..."
            }
            placeholderTextColor="#94A3B8"
            maxLength={200}
            value={inputText}
            onChangeText={setInputText}
            onFocus={() => {
              setShowEmojiPicker(false);
              requestAnimationFrame(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
              });
            }}
            blurOnSubmit={false}
            onSubmitEditing={handleSendMessage}
            // @ts-ignore
            onKeyPress={(e: any) => {
              if (
                Platform.OS === "web" &&
                e.nativeEvent?.key === "Enter" &&
                !e.shiftKey
              ) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />

          <TouchableOpacity
            style={[
              styles.capsuleIconBtn,
              showEmojiPicker && styles.capsuleIconBtnActive,
            ]}
            activeOpacity={0.7}
            onPress={() => {
              if (!showEmojiPicker) {
                Keyboard.dismiss();
              }
              setShowEmojiPicker((prev) => !prev);
            }}
            accessibilityLabel="Selecionar emojis"
          >
            <Ionicons
              name={showEmojiPicker ? "happy" : "happy-outline"}
              size={22}
              color={showEmojiPicker ? "#285A71" : "#64748B"}
            />
          </TouchableOpacity>
        </View>

            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!inputText.trim() && !attachedFile) || isUploading
                  ? styles.sendBtnDisabled
                  : null,
              ]}
              onPress={() => {
                handleSendMessage();
                inputRef.current?.focus();
              }}
              disabled={(!inputText.trim() && !attachedFile) || isUploading}
              activeOpacity={0.85}
              // @ts-ignore
              onMouseDown={(e: any) => {
                if (Platform.OS === "web") {
                  e.preventDefault();
                }
              }}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="send" size={18} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>
        );

        // ─── Layout Completo: WhatsApp Web Split-Pane 100% da Tela ───────────────────
        return (
        <>
          <Stack.Screen options={{ headerShown: false }} />
          <View style={styles.container}>
            {isDesktop ? (
              // Layout Desktop: Ocupa a tela inteira com contatos na esquerda e conversa na direita
              <View style={styles.whatsappDesktopContainer}>
                <View style={styles.whatsappSidebar}>
                  {renderSidebarContent()}
                </View>
                <View style={styles.whatsappChatPane}>
                  {renderConversationContent()}
                </View>
              </View>
            ) : (
              // Layout Mobile: Alterna entre Lista e Conversa Aberta
              <View style={styles.mobileContainer}>
                {selectedChat ? renderConversationContent() : renderSidebarContent()}
              </View>
            )}

            {/* Modal de Nova Conversa (Novo Chat) */}
            <Modal
              visible={isNewChatModalVisible}
              transparent={true}
              animationType="fade"
              onRequestClose={() => {
                setIsNewChatModalVisible(false);
                setNewChatSearch("");
              }}
            >
              <View style={styles.modalBackdrop}>
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <View>
                      <Text style={styles.modalTitle}>Nova Conversa</Text>
                      <Text style={styles.modalSubtitle}>
                        Selecione um colega de equipe da sua empresa
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.modalCloseBtn}
                      onPress={() => {
                        setIsNewChatModalVisible(false);
                        setNewChatSearch("");
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close" size={22} color="#64748B" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.modalSearchBox}>
                    <Ionicons
                      name="search"
                      size={17}
                      color="#94A3B8"
                      style={{ marginRight: 8 }}
                    />
                    <TextInput
                      style={styles.modalSearchInput}
                      placeholder="Buscar colega por nome ou cargo..."
                      placeholderTextColor="#94A3B8"
                      value={newChatSearch}
                      onChangeText={setNewChatSearch}
                    />
                  </View>

                  <ScrollView
                    style={styles.modalContactsList}
                    showsVerticalScrollIndicator={false}
                  >
                    {modalFilteredContacts.length === 0 ? (
                      <View style={styles.modalEmpty}>
                        <Text style={styles.modalEmptyText}>
                          Nenhum colaborador encontrado.
                        </Text>
                      </View>
                    ) : (
                      modalFilteredContacts.map((contact) => (
                        <TouchableOpacity
                          key={contact.id}
                          style={styles.modalContactItem}
                          activeOpacity={0.7}
                          onPress={() => handleSelectContact(contact)}
                        >
                          <View style={styles.avatarContainer}>
                            <View style={[styles.avatar, styles.contactAvatarBg]}>
                              {contact.foto ? (
                                <Image
                                  source={getAvatarSource(contact.foto)!}
                                  style={styles.avatarImgCover}
                                />
                              ) : (
                                <Text style={styles.avatarText}>{contact.avatar}</Text>
                              )}
                            </View>
                            {contact.online && <View style={styles.onlineDot} />}
                          </View>
                          <View style={styles.chatDetails}>
                            <Text style={styles.chatName}>{contact.name}</Text>
                            <Text style={styles.contactRole}>{contact.role}</Text>
                          </View>
                          <Ionicons
                            name="chatbubble-ellipses-outline"
                            size={20}
                            color="#285A71"
                          />
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                </View>
              </View>
            </Modal>

            {/* Modal de Visualização de Foto em Tela Cheia estilo WhatsApp */}
            <Modal
              visible={!!previewImageUrl}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setPreviewImageUrl(null)}
            >
              <View style={styles.modalImageBackdrop}>
                {/* Barra superior de controles com safe-area */}
                <View
                  style={[
                    styles.modalImageTopBar,
                    {
                      paddingTop:
                        Platform.OS === "web"
                          ? 16
                          : Math.max(
                            insets.top,
                            Platform.OS === "android"
                              ? StatusBar.currentHeight || 24
                              : 20
                          ) + 6,
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.modalImageActionBtn}
                    onPress={() => setPreviewImageUrl(null)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                  >
                    <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                    <Text style={styles.modalImageBtnText}>Voltar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalImageCloseCircle}
                    onPress={() => setPreviewImageUrl(null)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                  >
                    <Ionicons name="close" size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>

                {/* Toque na foto ou no fundo fecha o modal */}
                <TouchableOpacity
                  style={styles.modalImageCenterTouch}
                  activeOpacity={1}
                  onPress={() => setPreviewImageUrl(null)}
                >
                  {previewImageUrl && (
                    <Image
                      source={{ uri: previewImageUrl }}
                      style={styles.modalFullImage}
                      resizeMode="contain"
                    />
                  )}
                </TouchableOpacity>

                {/* Dica no rodapé */}
                <TouchableOpacity
                  style={styles.modalImageFooterHint}
                  onPress={() => setPreviewImageUrl(null)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="hand-left-outline"
                    size={14}
                    color="rgba(255, 255, 255, 0.7)"
                  />
                  <Text style={styles.modalImageFooterText}>
                    Toque em qualquer lugar para fechar
                  </Text>
                </TouchableOpacity>
              </View>
            </Modal>
            {/* Modal de Confirmação para Apagar Mensagem estilo WhatsApp */}
            <Modal
              visible={!!deleteTargetMessage}
              transparent={true}
              animationType="fade"
              onRequestClose={() => {
                if (!isDeletingMessage) setDeleteTargetMessage(null);
              }}
            >
              <View style={styles.waDeleteBackdrop}>
                <View style={styles.waDeleteCard}>
                  <View style={styles.waDeleteIconCircle}>
                    <Ionicons name="trash" size={24} color="#EF4444" />
                  </View>

                  <Text style={styles.waDeleteTitle}>Apagar mensagem?</Text>

                  {deleteTargetMessage && (
                    <View style={styles.waDeletePreviewBox}>
                      <Text style={styles.waDeletePreviewText} numberOfLines={2}>
                        {formatMessagePreview(deleteTargetMessage.text)}
                      </Text>
                      <Text style={styles.waDeletePreviewTime}>
                        {deleteTargetMessage.time}
                      </Text>
                    </View>
                  )}

                  <Text style={styles.waDeleteDescription}>
                    {deleteTargetMessage?.sender === "me"
                      ? "Deseja apagar esta mensagem para todos os participantes da conversa ou apenas da sua visualização?"
                      : "Deseja remover esta mensagem da sua visualização?"}
                  </Text>

                  <View style={styles.waDeleteActionsContainer}>
                    {deleteTargetMessage?.sender === "me" && (
                      <TouchableOpacity
                        style={styles.waDeleteBtnEveryone}
                        activeOpacity={0.85}
                        disabled={isDeletingMessage}
                        onPress={() =>
                          deleteTargetMessage &&
                          executeDeleteMessage(deleteTargetMessage, true)
                        }
                      >
                        <Ionicons
                          name="people-outline"
                          size={18}
                          color="#FFFFFF"
                          style={{ marginRight: 8 }}
                        />
                        <Text style={styles.waDeleteBtnEveryoneText}>
                          Apagar para todos
                        </Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={styles.waDeleteBtnMe}
                      activeOpacity={0.85}
                      disabled={isDeletingMessage}
                      onPress={() =>
                        deleteTargetMessage &&
                        executeDeleteMessage(deleteTargetMessage, false)
                      }
                    >
                      <Ionicons
                        name="person-outline"
                        size={18}
                        color="#285A71"
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.waDeleteBtnMeText}>
                        Apagar para mim
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.waDeleteBtnCancel}
                      activeOpacity={0.7}
                      disabled={isDeletingMessage}
                      onPress={() => setDeleteTargetMessage(null)}
                    >
                      <Text style={styles.waDeleteBtnCancelText}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          </View>
        </>
        );
}

        // ─── Estilos WhatsApp Web Split-Pane ──────────────────────────────────────────

        const styles = StyleSheet.create({
          container: {
          flex: 1,
        width: "100%",
        height: Platform.OS === "web" ? ("100vh" as any) : "100%",
        backgroundColor: "#F8FAFC",
  },

        // ─── Container Desktop (WhatsApp Web) ───────────────────────────────────────
        whatsappDesktopContainer: {
          flex: 1,
        flexDirection: "row",
        width: "100%",
        height: "100%",
        overflow: "hidden",
  },
        whatsappSidebar: {
          width: 380,
        minWidth: 320,
        maxWidth: 420,
        backgroundColor: "#FFFFFF",
        borderRightWidth: 1,
        borderRightColor: "#E2E8F0",
        height: "100%",
        display: "flex",
        flexDirection: "column",
  },
        whatsappChatPane: {
          flex: 1,
        backgroundColor: "#F8FAFC",
        height: "100%",
        display: "flex",
        flexDirection: "column",
  },

        // ─── Container Mobile ───────────────────────────────────────────────────────
        mobileContainer: {
          flex: 1,
        width: "100%",
        height: "100%",
  },

        // ─── Conteúdo da Sidebar ────────────────────────────────────────────────────
        sidebarInner: {
          flex: 1,
        backgroundColor: "#FFFFFF",
        height: "100%",
        display: "flex",
        flexDirection: "column",
  },
        sidebarHeader: {
          paddingTop: 16,
        paddingHorizontal: 16,
        paddingBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
  },
        sidebarHeaderLeft: {
          flexDirection: "row",
        alignItems: "center",
        gap: 10,
  },
        backToDashboardBtn: {
          width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: "#F1F5F9",
        alignItems: "center",
        justifyContent: "center",
  },
        sidebarHeaderTitle: {
          fontSize: 20,
        fontWeight: "800",
        color: "#0F2B3D",
        letterSpacing: -0.4,
  },
        sidebarHeaderSubtitle: {
          fontSize: 11.5,
        color: "#64748B",
        fontWeight: "500",
        marginTop: 1,
  },
        actionButton: {
          width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: "#F1F5F9",
        alignItems: "center",
        justifyContent: "center",
  },
        searchBox: {
          flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F1F5F9",
        marginHorizontal: 14,
        marginTop: 10,
        marginBottom: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        height: 40,
        borderWidth: 1,
        borderColor: "#E2E8F0",
  },
        searchIcon: {
          marginRight: 8,
  },
        searchInput: {
          flex: 1,
        fontSize: 13.5,
        color: "#0F2B3D",
        height: "100%",
  },
        tabBar: {
          flexDirection: "row",
          marginHorizontal: 14,
          marginBottom: 14,
          backgroundColor: "#EFF3DE",
          borderRadius: 16,
          padding: 4,
          borderWidth: 1,
          borderColor: "#D8DFBC",
        },
        tabButton: {
          flex: 1,
          flexDirection: "row",
          paddingVertical: 10,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 12,
        },
        tabButtonActive: {
          backgroundColor: "#FFFFFF",
          shadowColor: "#285A71",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
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
        scrollList: {
          flex: 1,
        paddingHorizontal: 10,
  },
        emptyContainer: {
          alignItems: "center",
        justifyContent: "center",
        paddingVertical: 60,
        paddingHorizontal: 20,
  },
        emptyIconCircle: {
          width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: "#F1F5F9",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 12,
  },
        emptyTitle: {
          fontSize: 15,
        fontWeight: "700",
        color: "#334155",
        marginBottom: 4,
  },
        emptySubtitle: {
          fontSize: 12,
        color: "#64748B",
        textAlign: "center",
        lineHeight: 16,
  },
        chatCard: {
          flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        padding: 12,
        borderRadius: 12,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: "transparent",
  },
        chatCardSelected: {
          backgroundColor: "#EBF3F6",
        borderColor: "#CCE3ED",
        borderLeftWidth: 4,
        borderLeftColor: "#285A71",
  },
        avatarContainer: {
          position: "relative",
  },
        avatar: {
          width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "#285A71",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
  },
        avatarImgCover: {
          width: 44,
        height: 44,
        borderRadius: 22,
  },
        avatarSelected: {
          backgroundColor: "#204658",
  },
        contactAvatarBg: {
          backgroundColor: "#10B981",
  },
        avatarText: {
          color: "#FFFFFF",
        fontSize: 15,
        fontWeight: "800",
  },
        onlineDot: {
          position: "absolute",
        right: 0,
        bottom: 0,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: "#10B981",
        borderWidth: 2,
        borderColor: "#FFFFFF",
  },
        chatDetails: {
          flex: 1,
        marginLeft: 12,
        justifyContent: "center",
  },
        chatHeaderRow: {
          flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 3,
  },
        chatName: {
          fontSize: 14.5,
        fontWeight: "600",
        color: "#0F2B3D",
  },
        chatNameSelected: {
          fontWeight: "700",
        color: "#285A71",
  },
        chatTime: {
          fontSize: 11,
        color: "#94A3B8",
        fontWeight: "500",
  },
        chatMessageRow: {
          flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
  },
        chatMessage: {
          fontSize: 12.5,
        color: "#64748B",
        flex: 1,
        marginRight: 6,
  },
        unreadBadge: {
          backgroundColor: "#10B981",
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 10,
        minWidth: 18,
        alignItems: "center",
        justifyContent: "center",
  },
        unreadText: {
          color: "#FFFFFF",
        fontSize: 10,
        fontWeight: "800",
  },
        contactRole: {
          fontSize: 11.5,
        color: "#64748B",
        marginTop: 2,
  },
        chatArrowCircle: {
          width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: "#F1F5F9",
        alignItems: "center",
        justifyContent: "center",
  },

        // Barra de navegação inferior da sidebar (Idêntica ao Ponto-E)
        sidebarBottomNav: {
          height: 80,
          backgroundColor: "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: "#E5E7EB",
          flexDirection: "row",
          justifyContent: "space-around",
          alignItems: "center",
          paddingBottom: 10,
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
        },

        // ─── Placeholder de Conversa Vazia (WhatsApp Web Style) ─────────────────────
        emptyConversationPane: {
          flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 40,
        backgroundColor: "#F8FAFC",
  },
        emptyConversationIconCircle: {
          width: 110,
        height: 110,
        borderRadius: 55,
        backgroundColor: "#EDF5F8",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 20,
  },
        emptyConversationTitle: {
          fontSize: 24,
        fontWeight: "800",
        color: "#0F2B3D",
        marginBottom: 8,
  },
        emptyConversationSubtitle: {
          fontSize: 14,
        color: "#64748B",
        textAlign: "center",
        maxWidth: 440,
        lineHeight: 22,
        marginBottom: 28,
  },
        emptySecurityBadge: {
          flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#E6F4F2",
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#CCEBE6",
  },
        emptySecurityText: {
          fontSize: 12,
        color: "#0D9488",
        fontWeight: "600",
  },

        // ─── Área da Conversa Ativa ─────────────────────────────────────────────────
        activeChatWrapper: {
          flex: 1,
        backgroundColor: "#F8FAFC",
        height: "100%",
        display: "flex",
        flexDirection: "column",
  },
        chatHeader: {
          height: 66,
        backgroundColor: "#FFFFFF",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 18,
        borderBottomWidth: 1,
        borderBottomColor: "#E2E8F0",
        zIndex: 10,
  },
        chatHeaderLeft: {
          flexDirection: "row",
        alignItems: "center",
        flex: 1,
  },
        backBtn: {
          width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: "#F1F5F9",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 10,
  },
        avatarWrapper: {
          position: "relative",
        marginRight: 12,
  },
        avatarHeader: {
          width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: "#285A71",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
  },
        avatarHeaderImg: {
          width: 42,
        height: 42,
        borderRadius: 21,
  },
        avatarHeaderText: {
          color: "#FFFFFF",
        fontSize: 15,
        fontWeight: "800",
  },
        avatarOnlineBadge: {
          position: "absolute",
        bottom: 0,
        right: 0,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: "#10B981",
        borderWidth: 2,
        borderColor: "#FFFFFF",
  },
        headerInfo: {
          flex: 1,
  },
        headerName: {
          fontSize: 15.5,
        fontWeight: "700",
        color: "#0F2B3D",
  },
        statusRow: {
          flexDirection: "row",
        alignItems: "center",
        marginTop: 2,
  },
        statusDotSmall: {
          width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 5,
  },
        dotOnline: {
          backgroundColor: "#10B981",
  },
        dotOffline: {
          backgroundColor: "#94A3B8",
  },
        headerSubtitle: {
          fontSize: 12,
        color: "#64748B",
        fontWeight: "500",
  },
        chatHeaderActions: {
          flexDirection: "row",
        alignItems: "center",
        gap: 8,
  },
        headerActionBtn: {
          width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "#F1F5F9",
        alignItems: "center",
        justifyContent: "center",
  },
        messageScroll: {
          flex: 1,
        backgroundColor: "#F8FAFC",
  },
        messageContainer: {
          paddingHorizontal: 22,
        paddingTop: 16,
        paddingBottom: 24,
  },
        securityPill: {
          flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        alignSelf: "center",
        backgroundColor: "#E6F4F2",
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 5,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#CCEBE6",
  },
        securityPillText: {
          fontSize: 11,
        fontWeight: "600",
        color: "#0D9488",
  },
        dateBadge: {
          alignSelf: "center",
        backgroundColor: "#FFFFFF",
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        marginBottom: 18,
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 2,
        elevation: 1,
  },
        dateBadgeText: {
          fontSize: 11,
        fontWeight: "600",
        color: "#64748B",
  },
        msgRow: {
          flexDirection: "row",
        marginBottom: 10,
        alignItems: "flex-end",
  },
        msgRowRight: {
          justifyContent: "flex-end",
  },
        msgRowLeft: {
          justifyContent: "flex-start",
  },
        msgAvatarThem: {
          width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: "#285A71",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 8,
        marginBottom: 2,
        overflow: "hidden",
  },
        msgAvatarThemImg: {
          width: 30,
        height: 30,
        borderRadius: 15,
  },
        msgAvatarText: {
          color: "#FFFFFF",
        fontSize: 11,
        fontWeight: "800",
  },
        msgBubble: {
          maxWidth: "75%",
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 18,
  },
        msgBubbleRight: {
          backgroundColor: "#285A71",
        borderBottomRightRadius: 4,
        shadowColor: "#285A71",
        shadowOffset: {width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 5,
        elevation: 2,
  },
        msgBubbleLeft: {
          backgroundColor: "#FFFFFF",
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
  },
        msgSenderName: {
          fontSize: 11,
        fontWeight: "700",
        color: "#285A71",
        marginBottom: 3,
  },
        msgText: {
          fontSize: 14.5,
        lineHeight: 21,
  },
        msgTextRight: {
          color: "#FFFFFF",
  },
        msgTextLeft: {
          color: "#0F2B3D",
  },
        msgFooter: {
          flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        marginTop: 4,
  },
        msgTime: {
          fontSize: 10,
        fontWeight: "500",
  },
        msgTimeRight: {
          color: "rgba(255, 255, 255, 0.75)",
  },
        msgTimeLeft: {
          color: "#94A3B8",
  },
        typingBubble: {
          backgroundColor: "#F1F5F9",
        borderWidth: 0,
  },
        inputAreaWrapper: {
          backgroundColor: "#FFFFFF",
        borderTopWidth: 1,
        borderTopColor: "#E2E8F0",
  },
        attachmentPreviewBar: {
          flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#EDF5F8",
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: "#E2E8F0",
  },
        attachmentPreviewInfo: {
          flexDirection: "row",
        alignItems: "center",
        flex: 1,
        marginRight: 10,
  },
        attachmentPreviewIconCircle: {
          width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 10,
  },
        attachmentPreviewTextGroup: {
          flex: 1,
  },
        attachmentPreviewName: {
          fontSize: 13,
        fontWeight: "700",
        color: "#0F2B3D",
  },
        attachmentPreviewHint: {
          fontSize: 11,
        color: "#285A71",
        fontWeight: "500",
  },
        attachmentPreviewRemoveBtn: {
          padding: 4,
  },
        inputArea: {
          flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 10,
  },
        inputCapsule: {
          flex: 1,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F1F5F9",
        borderRadius: 24,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        paddingHorizontal: 12,
  },
        capsuleIconBtn: {
          padding: 6,
  },
        capsuleIconBtnActive: {
          backgroundColor: "rgba(40, 90, 113, 0.12)",
        borderRadius: 18,
  },
        emojiPickerContainer: {
          backgroundColor: "#FFFFFF",
        borderBottomWidth: 1,
        borderBottomColor: "#E2E8F0",
        maxHeight: 220,
        width: "100%",
  },
        emojiPickerHeader: {
          flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
  },
        emojiCategoryScroll: {
          flex: 1,
  },
        emojiCategoryTab: {
          paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 14,
        marginRight: 6,
        backgroundColor: "#F8FAFC",
  },
        emojiCategoryTabActive: {
          backgroundColor: "#285A71",
  },
        emojiCategoryTabText: {
          fontSize: 12,
        fontWeight: "600",
        color: "#64748B",
  },
        emojiCategoryTabTextActive: {
          color: "#FFFFFF",
  },
        emojiHeaderActions: {
          flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginLeft: 8,
  },
        emojiActionBtn: {
          padding: 6,
        borderRadius: 8,
        backgroundColor: "#F1F5F9",
  },
        emojiGridScroll: {
          paddingHorizontal: 10,
        paddingVertical: 8,
        maxHeight: 165,
  },
        emojiGrid: {
          flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "flex-start",
  },
        emojiGridItem: {
          width: "12.5%",
        aspectRatio: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 4,
        borderRadius: 8,
  },
        emojiGridChar: {
          fontSize: 22,
  },
        chatInput: {
          flex: 1,
        height: 44,
        fontSize: 14.5,
        color: "#0F2B3D",
        paddingHorizontal: 8,
  },
        sendBtn: {
          width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "#285A71",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#285A71",
        shadowOffset: {width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 5,
        elevation: 3,
  },
        sendBtnDisabled: {
          backgroundColor: "#CBD5E1",
        shadowOpacity: 0,
  },
        // Cards de Anexos no Feed de Mensagens
        attachmentContentWrapper: {
          marginBottom: 4,
  },
        attachmentCard: {
          flexDirection: "row",
        alignItems: "center",
        borderRadius: 12,
        padding: 10,
        marginBottom: 4,
        minWidth: 200,
  },
        attachmentCardRight: {
          backgroundColor: "rgba(255, 255, 255, 0.18)",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.25)",
  },
        attachmentCardLeft: {
          backgroundColor: "#F1F5F9",
        borderWidth: 1,
        borderColor: "#E2E8F0",
  },
        attachmentIconCircle: {
          width: 38,
        height: 38,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 10,
  },
        attachmentIconImg: {
          backgroundColor: "#0EA5E9",
  },
        attachmentIconDoc: {
          backgroundColor: "#285A71",
  },
        attachmentDetails: {
          flex: 1,
  },
        attachmentTitle: {
          fontSize: 13.5,
        fontWeight: "700",
  },
        attachmentTitleRight: {
          color: "#FFFFFF",
  },
        attachmentTitleLeft: {
          color: "#0F2B3D",
  },
        attachmentSubtitle: {
          fontSize: 11,
        fontWeight: "500",
        marginTop: 2,
  },
        attachmentSubtitleRight: {
          color: "rgba(255, 255, 255, 0.8)",
  },
        attachmentSubtitleLeft: {
          color: "#64748B",
  },
        attachmentCaptionText: {
          marginTop: 4,
  },
        // Foto estilo WhatsApp na Bolha
        chatImageBubbleWrapper: {
          borderRadius: 14,
        overflow: "hidden",
        marginVertical: 2,
        maxWidth: 270,
  },
        chatImageTouch: {
          position: "relative",
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: "#E2E8F0",
  },
        chatImageContent: {
          width: 250,
        height: 190,
        borderRadius: 12,
  },
        chatImageZoomHint: {
          position: "absolute",
        bottom: 8,
        right: 8,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        borderRadius: 12,
        padding: 4,
  },
        chatImageCaption: {
          marginTop: 6,
        paddingHorizontal: 2,
  },
        // Modal de Foto em Tela Cheia (Zoom) estilo WhatsApp
        modalImageBackdrop: {
          flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.96)",
        justifyContent: "space-between",
  },
        modalImageTopBar: {
          flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingBottom: 12,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        zIndex: 999,
  },
        modalImageActionBtn: {
          flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        backgroundColor: "rgba(255, 255, 255, 0.18)",
  },
        modalImageBtnText: {
          color: "#FFFFFF",
        fontSize: 14,
        fontWeight: "700",
  },
        modalImageCloseCircle: {
          width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: "rgba(255, 255, 255, 0.2)",
        alignItems: "center",
        justifyContent: "center",
  },
        modalImageCenterTouch: {
          flex: 1,
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        paddingHorizontal: 10,
  },
        modalFullImage: {
          width: "100%",
        height: "100%",
        maxHeight: "90%",
  },
        modalImageFooterHint: {
          flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 14,
        paddingBottom: Platform.OS === "ios" ? 28 : 16,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
        modalImageFooterText: {
          color: "rgba(255, 255, 255, 0.8)",
        fontSize: 12,
        fontWeight: "600",
  },
        // Estilos adicionais para contador, exclusão e modal de novo chat
        tabBadge: {
          backgroundColor: "#EF4444",
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 10,
        marginLeft: 6,
        minWidth: 18,
        alignItems: "center",
        justifyContent: "center",
  },
        tabBadgeText: {
          color: "#FFFFFF",
        fontSize: 10,
        fontWeight: "800",
  },
        newChatEmptyBtn: {
          flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#285A71",
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        marginTop: 14,
        shadowColor: "#285A71",
        shadowOffset: {width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
  },
        newChatEmptyBtnText: {
          color: "#FFFFFF",
        fontSize: 13,
        fontWeight: "700",
  },
        deleteMsgBtn: {
          marginLeft: 6,
        padding: 2,
        opacity: 0.8,
  },
        deletedMessageContent: {
          flexDirection: "row",
        alignItems: "center",
        paddingVertical: 2,
  },
        deletedMessageText: {
          fontSize: 13.5,
        fontStyle: "italic",
  },
        deletedMessageTextRight: {
          color: "rgba(255, 255, 255, 0.85)",
  },
        deletedMessageTextLeft: {
          color: "#64748B",
  },
        msgBubbleDeletedRight: {
          backgroundColor: "rgba(40, 90, 113, 0.7)",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.2)",
  },
        msgBubbleDeletedLeft: {
          backgroundColor: "#F1F5F9",
        borderWidth: 1,
        borderColor: "#E2E8F0",
  },
        msgTimeDeleted: {
          opacity: 0.65,
  },

        // ─── Modal Apagar Mensagem estilo WhatsApp ──────────────────────────────────
        waDeleteBackdrop: {
          flex: 1,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
  },
        waDeleteCard: {
          width: "100%",
        maxWidth: 380,
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 24,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
        elevation: 10,
        borderWidth: 1,
        borderColor: "#E2E8F0",
  },
        waDeleteIconCircle: {
          width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: "#FEE2E2",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
  },
        waDeleteTitle: {
          fontSize: 19,
        fontWeight: "700",
        color: "#0F172A",
        marginBottom: 12,
        textAlign: "center",
  },
        waDeletePreviewBox: {
          width: "100%",
        backgroundColor: "#F8FAFC",
        borderRadius: 12,
        padding: 12,
        borderLeftWidth: 4,
        borderLeftColor: "#285A71",
        marginBottom: 12,
  },
        waDeletePreviewText: {
          fontSize: 13.5,
        color: "#334155",
        fontStyle: "italic",
  },
        waDeletePreviewTime: {
          fontSize: 11,
        color: "#94A3B8",
        marginTop: 4,
        textAlign: "right",
  },
        waDeleteDescription: {
          fontSize: 13.5,
        lineHeight: 19,
        color: "#64748B",
        textAlign: "center",
        marginBottom: 20,
        paddingHorizontal: 8,
  },
        waDeleteActionsContainer: {
          width: "100%",
        gap: 8,
  },
        waDeleteBtnEveryone: {
          flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#EF4444",
        paddingVertical: 13,
        borderRadius: 12,
        shadowColor: "#EF4444",
        shadowOffset: {width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 2,
  },
        waDeleteBtnEveryoneText: {
          color: "#FFFFFF",
        fontSize: 14,
        fontWeight: "700",
  },
        waDeleteBtnMe: {
          flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#EDF5F8",
        paddingVertical: 13,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#D2E4EC",
  },
        waDeleteBtnMeText: {
          color: "#285A71",
        fontSize: 14,
        fontWeight: "600",
  },
        waDeleteBtnCancel: {
          alignItems: "center",
        justifyContent: "center",
        paddingVertical: 12,
        borderRadius: 12,
  },
        waDeleteBtnCancelText: {
          color: "#64748B",
        fontSize: 14,
        fontWeight: "600",
  },
        emptyMessagesBox: {
          alignItems: "center",
        justifyContent: "center",
        paddingVertical: 60,
        paddingHorizontal: 24,
  },
        emptyMessagesIconCircle: {
          width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: "#ECEFD9",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 12,
  },
        emptyMessagesTitle: {
          fontSize: 16,
        fontWeight: "700",
        color: "#285A71",
        marginBottom: 6,
        textAlign: "center",
  },
        emptyMessagesSubtitle: {
          fontSize: 13,
        color: "#64748B",
        textAlign: "center",
        lineHeight: 18,
        maxWidth: 320,
  },
        // Modal Novo Chat
        modalBackdrop: {
          flex: 1,
        backgroundColor: "rgba(15, 23, 42, 0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
  },
        modalContent: {
          width: "100%",
        maxWidth: 480,
        maxHeight: "80%",
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 8,
  },
        modalHeader: {
          flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 16,
  },
        modalTitle: {
          fontSize: 18,
        fontWeight: "800",
        color: "#285A71",
  },
        modalSubtitle: {
          fontSize: 12,
        color: "#64748B",
        marginTop: 2,
  },
        modalCloseBtn: {
          padding: 4,
  },
        modalSearchBox: {
          flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F1F5F9",
        borderRadius: 14,
        paddingHorizontal: 12,
        height: 42,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        marginBottom: 14,
  },
        modalSearchInput: {
          flex: 1,
        fontSize: 13.5,
        color: "#0F2B3D",
        height: "100%",
  },
        modalContactsList: {
          maxHeight: 360,
  },
        modalEmpty: {
          alignItems: "center",
        paddingVertical: 30,
  },
        modalEmptyText: {
          fontSize: 13,
        color: "#94A3B8",
  },
        modalContactItem: {
          flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 12,
        marginBottom: 6,
        backgroundColor: "#F8FAFC",
  },
});
