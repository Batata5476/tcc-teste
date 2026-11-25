import { BadRequestException, Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Response } from 'express';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { getChatFileFromDatabase, getPublicChatFileUrl } from './chat-storage';

const SAFE_FILENAME_REGEX = /^chat-[a-zA-Z0-9_-]+\.[a-z0-9]{2,5}$/;

@Controller('uploads')
export class UploadsController {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {}

  @Get('chat/:filename')
  async serveChatUpload(@Param('filename') filename: string, @Res() res: Response) {
    if (!SAFE_FILENAME_REGEX.test(filename)) {
      throw new BadRequestException('Nome de arquivo inválido');
    }

    const stored = await getChatFileFromDatabase(this.messageRepository.manager, filename);
    if (stored) {
      const safeOriginal = (stored.originalName || filename).replace(/["\r\n]/g, '_');
      res.setHeader('Content-Type', stored.mimeType);
      res.setHeader('Content-Length', String(stored.buffer.length));
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; img-src 'self' data:; media-src 'self'; sandbox",
      );
      res.setHeader('Content-Disposition', `inline; filename="${safeOriginal}"`);
      return res.status(200).send(stored.buffer);
    }

    const publicUrl = getPublicChatFileUrl(filename);
    if (publicUrl) {
      return res.redirect(302, publicUrl);
    }

    throw new NotFoundException('Arquivo não encontrado');
  }
}
