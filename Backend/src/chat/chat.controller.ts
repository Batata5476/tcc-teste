import { Controller, Get, Post, Body, Param, Delete, Query, UseGuards, Req } from '@nestjs/common';
import { ChatService } from './chat.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UploadMediaDto } from './dto/upload-media.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/authorization.decorators';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('contacts')
  @Permissions('chat.read')
  getContacts(@Req() req) {
    return this.chatService.getContacts(req.user);
  }

  @Get('conversations')
  @Permissions('chat.read')
  getConversations(@Req() req) {
    return this.chatService.getConversations(req.user);
  }

  @Post('conversations')
  @Permissions('chat.create')
  createConversation(@Body() dto: CreateConversationDto, @Req() req) {
    return this.chatService.createConversation(dto, req.user);
  }

  @Get(':id/messages')
  @Permissions('chat.read')
  getMessages(@Param('id') id: string, @Req() req) {
    return this.chatService.getMessages(+id, req.user);
  }

  @Post()
  @Permissions('chat.create')
  create(@Body() createMessageDto: CreateMessageDto, @Req() req) {
    return this.chatService.create(createMessageDto, req.user);
  }

  @Post('upload')
  @Permissions('chat.create')
  uploadMedia(@Body() dto: UploadMediaDto, @Req() req) {
    return this.chatService.uploadMedia(dto, req.user);
  }

  @Delete(':id')
  @Permissions('chat.delete')
  remove(
    @Param('id') id: string,
    @Query('forEveryone') forEveryone: string,
    @Req() req,
  ) {
    const isEveryone = forEveryone !== 'false';
    return this.chatService.remove(+id, req.user, isEveryone);
  }
}
