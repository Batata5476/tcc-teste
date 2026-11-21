import { ForbiddenException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UploadMediaDto } from './dto/upload-media.dto';
import { Message } from './entities/message.entity';
import { Chat } from './entities/chat.entity';
import { ChatParticipant } from './entities/chat-participant.entity';
import { User } from '../users/entities/user.entity';

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

  private async validateChatAccess(chatId: number, caller: any): Promise<Chat> {
    const chat = await this.chatRepository.findOne({
      where: { pk_id_chat: chatId },
    });

    if (!chat) {
      throw new NotFoundException(`Chat com ID ${chatId} não encontrado`);
    }

    if (chat.fk_cod_empresa !== caller.empresa_id) {
      throw new ForbiddenException('Este chat não pertence à sua empresa');
    }

    const participant = await this.chatParticipantRepository.findOne({
      where: {
        fk_id_chat: chatId,
        fk_id_func: caller.sub,
      },
    });

    if (!participant) {
      throw new ForbiddenException('Você não é participante deste chat');
    }

    return chat;
  }

  // ─── Listar Contatos da Empresa ─────────────────────────────────────────────
  async getContacts(caller: any) {
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
  }

  // ─── Listar Conversas Ativas do Usuário ────────────────────────────────────
  async getConversations(caller: any) {
    const callerId = caller.sub;

    const myParticipations = await this.chatParticipantRepository.find({
      where: { fk_id_func: callerId },
      relations: ['chat'],
    });

    const conversations = await Promise.all(
      myParticipations.map(async (p) => {
        const chatId = p.fk_id_chat;

        // Busca o outro participante da conversa
        const otherParticipant = await this.chatParticipantRepository.findOne({
          where: { fk_id_chat: chatId },
          relations: ['funcionario', 'funcionario.setor', 'funcionario.role'],
        });

        // Busca todas as participações para encontrar o outro participante diferente de mim
        const allParticipants = await this.chatParticipantRepository.find({
          where: { fk_id_chat: chatId },
          relations: ['funcionario', 'funcionario.setor', 'funcionario.role'],
        });

        const other = allParticipants.find((item) => item.fk_id_func !== callerId)?.funcionario
          || otherParticipant?.funcionario;

        // Busca a última mensagem enviada no chat
        const lastMsg = await this.messageRepository.findOne({
          where: { fk_id_chat: chatId },
          order: { data_envio: 'DESC' },
        });

        const name = other ? other.nome : `Conversa #${chatId}`;
        const initials = name
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase();

        let formattedTime = '';
        if (lastMsg?.data_envio) {
          const d = new Date(lastMsg.data_envio);
          const hours = String(d.getHours()).padStart(2, '0');
          const minutes = String(d.getMinutes()).padStart(2, '0');
          formattedTime = `${hours}:${minutes}`;
        }

        const photo = other ? (other.foto_func || other.foto || null) : null;

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
          } else if (safeLastMessage.startsWith('📎 [Arquivo]') || safeLastMessage.startsWith('📎 Arquivo')) {
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
            safeLastMessage = /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(safeLastMessage)
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
          unreadCount: 0,
          role: other ? (other.cargo || other.setor?.nome || 'Colaborador') : 'Chat',
          targetUserId: other ? other.id : null,
        };
      }),
    );

    return {
      status: 'success',
      data: conversations,
    };
  }

  // ─── Criar ou Obter Conversa Direta ─────────────────────────────────────────
  async createConversation(dto: CreateConversationDto, caller: any) {
    const callerId = caller.sub;
    const targetUserId = dto.targetUserId;

    if (callerId === targetUserId) {
      throw new BadRequestException('Você não pode iniciar uma conversa consigo mesmo');
    }

    const targetUser = await this.userRepository.findOne({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new NotFoundException('Usuário de destino não encontrado');
    }

    if (targetUser.empresa_id !== caller.empresa_id) {
      throw new ForbiddenException('Usuário pertence a outra empresa');
    }

    // Verifica se já existe um chat direto entre callerId e targetUserId
    const callerChats = await this.chatParticipantRepository.find({
      where: { fk_id_func: callerId },
    });

    for (const cp of callerChats) {
      const otherCp = await this.chatParticipantRepository.findOne({
        where: { fk_id_chat: cp.fk_id_chat, fk_id_func: targetUserId },
      });
      if (otherCp) {
        return {
          status: 'success',
          message: 'Conversa existente localizada',
          data: { id: cp.fk_id_chat },
        };
      }
    }

    // Cria o registro na tabela chats
    const newChat = this.chatRepository.create({
      tipo_chat: 'direct',
      fk_cod_empresa: caller.empresa_id,
    });
    const savedChat = await this.chatRepository.save(newChat);

    // Cria as participações para os dois usuários
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
  }

  // ─── Listar Mensagens de um Chat Específico (Cronológico ASC) ───────────────
  async getMessages(chatId: number, caller: any) {
    await this.validateChatAccess(chatId, caller);

    const messages = await this.messageRepository.find({
      where: { fk_id_chat: chatId },
      relations: ['funcionario'],
      order: { data_envio: 'ASC' },
    });

    const formattedMessages = messages.map((m) => {
      const d = new Date(m.data_envio);
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');

      return {
        id: String(m.pk_id_mensagens),
        text: m.conteudo_mensagens,
        sender: m.fk_id_func === caller.sub ? 'me' : 'them',
        senderName: m.funcionario ? m.funcionario.nome : 'Usuário',
        time: `${hours}:${minutes}`,
      };
    });

    return {
      status: 'success',
      data: formattedMessages,
    };
  }

  // ─── Enviar Mensagem ────────────────────────────────────────────────────────
  async create(createMessageDto: CreateMessageDto, caller: any) {
    await this.validateChatAccess(createMessageDto.fk_id_chat, caller);

    const message = this.messageRepository.create({
      conteudo_mensagens: createMessageDto.conteudo_mensagens,
      data_envio: new Date(),
      fk_id_chat: createMessageDto.fk_id_chat,
      fk_id_func: caller.sub,
      fk_id_midia: createMessageDto.fk_id_midia,
    });

    const saved = await this.messageRepository.save(message);

    return {
      status: 'success',
      message: 'Mensagem enviada com sucesso',
      data: saved,
    };
  }

  // ─── Remover Mensagem (Estilo WhatsApp) ────────────────────────────────────
  async remove(id: number, caller: any, forEveryone = true) {
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
  }

  // ─── Upload de Mídia / Imagem do Chat ──────────────────────────────────────
  async uploadMedia(dto: UploadMediaDto, caller: any) {
    if (!dto.base64 || !dto.filename) {
      throw new BadRequestException('Arquivo inválido ou base64 não fornecido');
    }

    const ALLOWED_EXTENSIONS = new Set([
      '.jpg', '.jpeg', '.png', '.webp', '.gif',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv', '.mp4',
    ]);

    const extMatch = dto.filename.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : '.jpg';
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new BadRequestException('Formato de arquivo não permitido por segurança');
    }

    const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    const baseUploadDir = isServerless ? '/tmp' : process.cwd();
    const uploadDir = join(baseUploadDir, 'uploads', 'chat');
    try {
      if (!existsSync(uploadDir)) {
        mkdirSync(uploadDir, { recursive: true });
      }
    } catch {
      // Ignore directory creation error in read-only environments
    }

    // Limpa prefixos do tipo 'data:image/...;base64,' se presentes
    const base64Data = dto.base64.replace(/^data:([A-Za-z0-9.+/-]+);base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB
    if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) {
      throw new BadRequestException('Arquivo vazio ou excede o limite máximo de 5MB');
    }

    const safeName = `chat-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    const filePath = join(uploadDir, safeName);

    writeFileSync(filePath, buffer);

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
