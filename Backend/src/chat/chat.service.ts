import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
  HttpException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UploadMediaDto } from './dto/upload-media.dto';
import {
  getSupabaseStorageConfig,
  isServerlessRuntime,
  saveChatFileToDatabase,
  uploadChatFileToSupabase,
} from './chat-storage';
import { Message } from './entities/message.entity';
import { Chat } from './entities/chat.entity';
import { ChatParticipant } from './entities/chat-participant.entity';
import { User } from '../users/entities/user.entity';

// Horário padrão em Brasília caso o cliente não formate sentAt localmente
const timeFormatterBR = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'America/Sao_Paulo',
});

function formatTimeBR(value: Date | string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return timeFormatterBR.format(date);
}

function toIsoSafe(value: Date | string | undefined | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isTransientDbError(error: any): boolean {
  if (!error || error instanceof HttpException) return false;
  const code = String(error?.code || error?.driverError?.code || '');
  const msg = String(error?.message || error?.driverError?.message || '').toLowerCase();
  if (['53300', '08006', '08003', '08001', '57P01', 'XX000'].includes(code)) {
    return true;
  }
  return (
    msg.includes('maxclientsinsessionmode') ||
    msg.includes('max clients reached') ||
    msg.includes('too many clients') ||
    msg.includes('connection terminated') ||
    msg.includes('timeout exceeded when trying to connect') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('server closed the connection unexpectedly')
  );
}

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Chat)
    private readonly chatRepository: Repository<Chat>,
    @InjectRepository(ChatParticipant)
    private readonly chatParticipantRepository: Repository<ChatParticipant>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  private async withDbRetry<T>(operation: () => Promise<T>): Promise<T> {
    const delays = [180, 420];
    let lastError: any;

    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        return await operation();
      } catch (err) {
        lastError = err;
        if (!isTransientDbError(err) || attempt === delays.length) {
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
      }
    }

    throw lastError;
  }

  private async validateChatAccess(chatId: number, caller: any): Promise<Chat> {
    const chat = await this.chatRepository.findOne({ where: { pk_id_chat: chatId } });

    if (!chat) {
      throw new NotFoundException(`Chat com ID ${chatId} não encontrado`);
    }

    if (chat.fk_cod_empresa !== caller.empresa_id) {
      throw new ForbiddenException('Este chat não pertence à sua empresa');
    }

    const participant = await this.chatParticipantRepository.findOne({
      where: { fk_id_chat: chatId, fk_id_func: caller.sub },
    });

    if (!participant) {
      throw new ForbiddenException('Você não é participante deste chat');
    }

    return chat;
  }

  // ─── Listar Contatos da Empresa ─────────────────────────────────────────────
  async getContacts(caller: any) {
    return this.withDbRetry(async () => {
      const users = await this.userRepository.find({
        where: { empresa_id: caller.empresa_id },
        relations: ['setor', 'role'],
      });

      const contacts = users
        .filter((u) => u.id !== caller.sub && u.status !== 'DELETED')
        .map((u) => {
          const initials = u.nome
            .split(' ')
            .map((n) => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();

          return {
            id: u.id,
            name: u.nome,
            avatar: initials,
            foto: u.foto_func || u.foto || null,
            online: u.status === 'ACTIVE',
            role: u.cargo || u.setor?.nome || u.role?.nome || 'Colaborador',
          };
        });

      return {
        status: 'success',
        data: contacts,
      };
    });
  }

  // ─── Listar Conversas Ativas do Usuário (em lote, sem N+1 queries) ──────────
  async getConversations(caller: any) {
    return this.withDbRetry(async () => {
      const callerId = caller.sub;

      const myParticipations = await this.chatParticipantRepository.find({
        where: { fk_id_func: callerId },
        relations: ['chat'],
      });

      if (myParticipations.length === 0) {
        return { status: 'success', data: [] };
      }

      const chatIds = Array.from(new Set(myParticipations.map((p) => p.fk_id_chat)));

      // Execução sequencial para consumir apenas 1 conexão do pool por requisição serverless
      const allParticipantsList = await this.chatParticipantRepository.find({
        where: { fk_id_chat: In(chatIds) },
        relations: ['funcionario', 'funcionario.setor', 'funcionario.role'],
      });

      const allRecentMessages = await this.messageRepository.find({
        where: { fk_id_chat: In(chatIds) },
        order: { data_envio: 'DESC' },
      });

      const participantsByChat = new Map<number, ChatParticipant[]>();
      for (const part of allParticipantsList) {
        const list = participantsByChat.get(part.fk_id_chat) || [];
        list.push(part);
        participantsByChat.set(part.fk_id_chat, list);
      }

      const lastMsgByChat = new Map<number, Message>();
      for (const msg of allRecentMessages) {
        if (!lastMsgByChat.has(msg.fk_id_chat)) {
          lastMsgByChat.set(msg.fk_id_chat, msg);
        }
      }

      const conversations = myParticipations.map((p) => {
        const chatId = p.fk_id_chat;
        const allParticipants = participantsByChat.get(chatId) || [];
        const lastMsg = lastMsgByChat.get(chatId);

        const other =
          allParticipants.find((item) => item.fk_id_func !== callerId)?.funcionario ||
          allParticipants[0]?.funcionario;

        const name = other ? other.nome : `Conversa #${chatId}`;
        const initials = name
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase();

        const formattedTime = lastMsg?.data_envio ? formatTimeBR(lastMsg.data_envio) : '';
        const lastSentAt = toIsoSafe(lastMsg?.data_envio);
        const photo = other ? other.foto_func || other.foto || null : null;

        const rawLastMsg = lastMsg ? lastMsg.conteudo_mensagens : 'Conversa iniciada';
        let safeLastMessage = rawLastMsg;
        if (safeLastMessage && safeLastMessage !== 'Conversa iniciada') {
          if (
            safeLastMessage === '🚫 Esta mensagem foi apagada' ||
            safeLastMessage === '🚫 Você apagou esta mensagem'
          ) {
            safeLastMessage = '🚫 Mensagem apagada';
          } else if (safeLastMessage.startsWith('📷 [Foto]') || safeLastMessage.startsWith('📷 Foto')) {
            const parts = safeLastMessage.split(' - ');
            const comment = parts.length > 1 ? parts.slice(1).join(' - ').trim() : null;
            safeLastMessage = comment ? `📷 ${comment}` : '📷 Foto';
          } else if (
            safeLastMessage.startsWith('📎 [Arquivo]') ||
            safeLastMessage.startsWith('📎 Arquivo')
          ) {
            const parts = safeLastMessage.split(' - ');
            const headerPart = parts[0];
            const comment = parts.length > 1 ? parts.slice(1).join(' - ').trim() : null;
            const fileRef = headerPart
              .replace('📎 [Arquivo]', '')
              .replace('📎 Arquivo', '')
              .trim();
            const fileName =
              fileRef && !fileRef.startsWith('/uploads/') && !fileRef.startsWith('http')
                ? fileRef.split('/').pop() || 'Documento'
                : 'Documento';
            safeLastMessage = comment ? `📎 ${fileName} • ${comment}` : `📎 ${fileName}`;
          } else if (safeLastMessage.includes('/uploads/chat/')) {
            safeLastMessage = /\.(jpg|jpeg|png|webp|gif|heic|heif|svg)$/i.test(safeLastMessage)
              ? '📷 Foto'
              : '📎 Arquivo';
          }
        }

        return {
          id: chatId,
          name,
          avatar: initials,
          foto: photo,
          online: other ? other.status === 'ACTIVE' : false,
          lastMessage: safeLastMessage,
          time: formattedTime,
          lastSentAt,
          unreadCount: 0,
          role: other ? other.cargo || other.setor?.nome || 'Colaborador' : 'Chat',
          targetUserId: other ? other.id : null,
        };
      });

      return {
        status: 'success',
        data: conversations,
      };
    });
  }

  // ─── Criar ou Obter Conversa Direta ─────────────────────────────────────────
  async createConversation(dto: CreateConversationDto, caller: any) {
    return this.withDbRetry(async () => {
      const callerId = caller.sub;
      const targetUserId = dto.targetUserId;

      if (callerId === targetUserId) {
        throw new BadRequestException('Você não pode iniciar uma conversa consigo mesmo');
      }

      const targetUser = await this.userRepository.findOne({ where: { id: targetUserId } });

      if (!targetUser) {
        throw new NotFoundException('Usuário de destino não encontrado');
      }

      if (targetUser.empresa_id !== caller.empresa_id) {
        throw new ForbiddenException('Usuário pertence a outra empresa');
      }

      const callerChats = await this.chatParticipantRepository.find({
        where: { fk_id_func: callerId },
      });

      if (callerChats.length > 0) {
        const chatIds = callerChats.map((cp) => cp.fk_id_chat);
        const existingTargetPart = await this.chatParticipantRepository.findOne({
          where: { fk_id_chat: In(chatIds), fk_id_func: targetUserId },
        });
        if (existingTargetPart) {
          return {
            status: 'success',
            message: 'Conversa existente localizada',
            data: { id: existingTargetPart.fk_id_chat },
          };
        }
      }

      const newChat = this.chatRepository.create({
        tipo_chat: 'direct',
        fk_cod_empresa: caller.empresa_id,
      });
      const savedChat = await this.chatRepository.save(newChat);

      const part1 = this.chatParticipantRepository.create({
        fk_id_chat: savedChat.pk_id_chat,
        fk_id_func: callerId,
      });
      const part2 = this.chatParticipantRepository.create({
        fk_id_chat: savedChat.pk_id_chat,
        fk_id_func: targetUserId,
      });

      await this.chatParticipantRepository.save([part1, part2]);

      return {
        status: 'success',
        message: 'Conversa criada com sucesso',
        data: { id: savedChat.pk_id_chat },
      };
    });
  }

  // ─── Listar Mensagens de um Chat Específico (Cronológico ASC) ───────────────
  async getMessages(chatId: number, caller: any) {
    return this.withDbRetry(async () => {
      await this.validateChatAccess(chatId, caller);

      const messages = await this.messageRepository.find({
        where: { fk_id_chat: chatId },
        relations: ['funcionario'],
        order: { data_envio: 'ASC' },
      });

      const formattedMessages = messages.map((m) => ({
        id: String(m.pk_id_mensagens),
        text: m.conteudo_mensagens,
        sender: m.fk_id_func === caller.sub ? 'me' : 'them',
        senderName: m.funcionario ? m.funcionario.nome : 'Usuário',
        time: formatTimeBR(m.data_envio),
        sentAt: toIsoSafe(m.data_envio),
      }));

      return {
        status: 'success',
        data: formattedMessages,
      };
    });
  }

  // ─── Enviar Mensagem ────────────────────────────────────────────────────────
  async create(createMessageDto: CreateMessageDto, caller: any) {
    const safeContent = String(createMessageDto.conteudo_mensagens ?? '')
      .trim()
      .slice(0, 200);

    if (!safeContent) {
      throw new BadRequestException('A mensagem não pode estar vazia');
    }

    return this.withDbRetry(async () => {
      await this.validateChatAccess(createMessageDto.fk_id_chat, caller);

      const buildMessage = () =>
        this.messageRepository.create({
          conteudo_mensagens: safeContent,
          data_envio: new Date(),
          fk_id_chat: createMessageDto.fk_id_chat,
          fk_id_func: caller.sub,
          fk_id_midia: createMessageDto.fk_id_midia,
        });

      let saved: Message;
      try {
        saved = await this.messageRepository.save(buildMessage());
      } catch (err: any) {
        const code = String(err?.code || err?.driverError?.code || '');
        if (code === '23505') {
          // Realinha sequence caso algum seed SQL tenha inserido pk_id_mensagens manual
          await this.messageRepository.query(
            `SELECT setval(pg_get_serial_sequence('mensagens', 'pk_id_mensagens'), COALESCE((SELECT MAX(pk_id_mensagens) FROM mensagens), 1), true)`,
          );
          saved = await this.messageRepository.save(buildMessage());
        } else {
          throw err;
        }
      }

      return {
        status: 'success',
        message: 'Mensagem enviada com sucesso',
        data: saved,
      };
    });
  }

  // ─── Remover Mensagem (Estilo WhatsApp) ────────────────────────────────────
  async remove(id: number, caller: any, forEveryone = true) {
    return this.withDbRetry(async () => {
      const message = await this.messageRepository.findOne({
        where: { pk_id_mensagens: id },
      });

      if (!message) {
        throw new NotFoundException(`Mensagem com ID ${id} não encontrada`);
      }

      await this.validateChatAccess(message.fk_id_chat, caller);

      if (message.fk_id_func !== caller.sub) {
        throw new ForbiddenException('Você só pode remover mensagens enviadas por você');
      }

      if (forEveryone) {
        message.conteudo_mensagens = '🚫 Esta mensagem foi apagada';
        await this.messageRepository.save(message);
      }

      return {
        status: 'success',
        message: 'Mensagem apagada com sucesso',
      };
    });
  }

  // ─── Upload de Mídia / Documento do Chat ───────────────────────────────────
  async uploadMedia(dto: UploadMediaDto, _caller: any) {
    if (!dto.base64 || !dto.filename) {
      throw new BadRequestException('Arquivo inválido ou base64 não fornecido');
    }

    const ALLOWED_EXTENSIONS = new Set([
      '.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv', '.mp4',
    ]);

    const extMatch = dto.filename.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : '.jpg';
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new BadRequestException('Formato de arquivo não permitido por segurança');
    }

    const base64Data = dto.base64.replace(/^data:([A-Za-z0-9.+/-]+);base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB
    if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) {
      throw new BadRequestException('Arquivo vazio ou excede o limite máximo de 5MB');
    }

    const safeName = `chat-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;

    // 1. Persiste no PostgreSQL para funcionar 100% na Vercel + Supabase sem configuração extra
    const savedInDb = await this.withDbRetry(() =>
      saveChatFileToDatabase(
        this.messageRepository.manager,
        safeName,
        ext,
        dto.filename,
        buffer,
      ),
    );

    // 2. Se Supabase Storage também estiver configurado, envia cópia para o bucket
    if (getSupabaseStorageConfig()) {
      await uploadChatFileToSupabase(safeName, ext, buffer);
    } else if (!savedInDb && isServerlessRuntime()) {
      throw new ServiceUnavailableException('Não foi possível persistir o arquivo enviado.');
    }

    // 3. Em ambiente local, mantém também cópia em disco em uploads/chat
    if (!isServerlessRuntime()) {
      try {
        const uploadDir = join(process.cwd(), 'uploads', 'chat');
        if (!existsSync(uploadDir)) {
          mkdirSync(uploadDir, { recursive: true });
        }
        writeFileSync(join(uploadDir, safeName), buffer);
      } catch {
        // Ignora caso o diretório local não permita escrita e o arquivo já esteja no banco
      }
    }

    return {
      status: 'success',
      data: {
        url: `/uploads/chat/${safeName}`,
        filename: safeName,
        originalName: dto.filename,
      },
    };
  }
}
