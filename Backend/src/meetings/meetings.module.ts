import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { Meeting } from './entities/meeting.entity';
import { MeetingParticipant } from './entities/meeting-participant.entity';
import { User } from '../users/entities/user.entity';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Meeting, MeetingParticipant, User])],
  controllers: [MeetingsController],
  providers: [MeetingsService, RolesGuard, PermissionsGuard],
  exports: [MeetingsService],
})
export class MeetingsModule {}

