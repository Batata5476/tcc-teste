import { Controller, Get, Post, Body, Param, Patch, Delete, UseGuards, Req } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { UpdateMeetingStatusDto } from './dto/update-meeting-status.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions, Roles } from '../auth/authorization.decorators';
import { ADMIN_ROLES } from '../auth/authorization.constants';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Get()
  @Permissions('meetings.read')
  findAll(@Req() req) {
    return this.meetingsService.findAll(req.user);
  }

  @Get(':id')
  @Permissions('meetings.read')
  findOne(@Param('id') id: string, @Req() req) {
    return this.meetingsService.findOne(+id, req.user);
  }

  @Post('request')
  @Permissions('meetings.create')
  requestMeeting(@Body() createMeetingDto: CreateMeetingDto, @Req() req) {
    return this.meetingsService.requestMeeting(createMeetingDto, req.user);
  }

  @Post()
  @Roles(...ADMIN_ROLES)
  @Permissions('meetings.create')
  create(@Body() createMeetingDto: CreateMeetingDto, @Req() req) {
    return this.meetingsService.create(createMeetingDto, req.user);
  }

  @Patch(':id/status')
  @Permissions('meetings.update')
  updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateMeetingStatusDto,
    @Req() req,
  ) {
    return this.meetingsService.updateStatus(+id, updateStatusDto, req.user);
  }

  @Patch(':id')
  @Roles(...ADMIN_ROLES)
  @Permissions('meetings.update')
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateMeetingDto,
    @Req() req,
  ) {
    return this.meetingsService.update(+id, updateDto, req.user);
  }

  @Delete(':id')
  @Roles(...ADMIN_ROLES)
  @Permissions('meetings.delete')
  remove(@Param('id') id: string, @Req() req) {
    return this.meetingsService.remove(+id, req.user);
  }
}
