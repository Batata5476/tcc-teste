import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChatService } from './chat.service';
import { Message } from './entities/message.entity';
import { Chat } from './entities/chat.entity';
import { ChatParticipant } from './entities/chat-participant.entity';
import { User } from '../users/entities/user.entity';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';

describe('ChatService', () => {
  let service: ChatService;
  let messageRepository: any;
  let chatRepository: any;
  let chatParticipantRepository: any;
  let userRepository: any;

  const mockCaller = {
    sub: 10,
    empresa_id: 1,
    role: 'FUNCIONARIO',
  };

  beforeEach(async () => {
    messageRepository = {
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => Promise.resolve({ pk_id_mensagens: 1, ...entity })),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    };

    chatRepository = {
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => Promise.resolve({ pk_id_chat: 5, ...entity })),
      findOne: jest.fn(),
      find: jest.fn(),
    };

    chatParticipantRepository = {
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => Promise.resolve(entity)),
      findOne: jest.fn(),
      find: jest.fn(),
    };

    userRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: getRepositoryToken(Message),
          useValue: messageRepository,
        },
        {
          provide: getRepositoryToken(Chat),
          useValue: chatRepository,
        },
        {
          provide: getRepositoryToken(ChatParticipant),
          useValue: chatParticipantRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getContacts', () => {
    it('should return list of contacts excluding current user', async () => {
      userRepository.find.mockResolvedValue([
        { id: 10, nome: 'User Me', empresa_id: 1, status: 'ACTIVE' },
        { id: 20, nome: 'User Other', empresa_id: 1, status: 'ACTIVE', setor: { desc_setor: 'TI' } },
      ]);

      const result = await service.getContacts(mockCaller);
      expect(result.status).toBe('success');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(20);
      expect(result.data[0].name).toBe('User Other');
    });
  });

  describe('create (send message)', () => {
    it('should throw NotFoundException if chat does not exist', async () => {
      chatRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create({ fk_id_chat: 99, conteudo_mensagens: 'Hello' }, mockCaller),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not participant of chat', async () => {
      chatRepository.findOne.mockResolvedValue({ pk_id_chat: 5, fk_cod_empresa: 1 });
      chatParticipantRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create({ fk_id_chat: 5, conteudo_mensagens: 'Hello' }, mockCaller),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should save message when user has access', async () => {
      chatRepository.findOne.mockResolvedValue({ pk_id_chat: 5, fk_cod_empresa: 1 });
      chatParticipantRepository.findOne.mockResolvedValue({ fk_id_chat: 5, fk_id_func: 10 });
      userRepository.findOne.mockResolvedValue({ id: 10, nome: 'User Me' });

      const response = await service.create({ fk_id_chat: 5, conteudo_mensagens: 'Olá!' }, mockCaller);

      expect(messageRepository.save).toHaveBeenCalled();
      expect(response.status).toBe('success');
      expect(response.data.conteudo_mensagens).toBe('Olá!');
    });
  });

  describe('uploadMedia & remove security', () => {
    it('rejects dangerous file extensions (.html, .svg, .js)', async () => {
      await expect(
        service.uploadMedia({ filename: 'exploit.html', base64: 'PGh0bWw+PC9odG1sPg==' }, mockCaller),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.uploadMedia({ filename: 'xss.svg', base64: 'PHN2Zz48L3N2Zz4=' }, mockCaller),
      ).rejects.toThrow(BadRequestException);
    });

    it('does not delete message from DB for everyone when forEveryone is false', async () => {
      messageRepository.findOne.mockResolvedValue({
        pk_id_mensagens: 42,
        fk_id_chat: 5,
        fk_id_func: 10,
        conteudo_mensagens: 'Mensagem privada',
      });
      chatRepository.findOne.mockResolvedValue({ pk_id_chat: 5, fk_cod_empresa: 1 });
      chatParticipantRepository.findOne.mockResolvedValue({ fk_id_chat: 5, fk_id_func: 10 });

      const res = await service.remove(42, mockCaller, false);
      expect(res.status).toBe('success');
      expect(messageRepository.remove).not.toHaveBeenCalled();
    });
  });
});
