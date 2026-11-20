import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WellbeingController } from './wellbeing.controller';
import { WellbeingService } from './wellbeing.service';
import { Humor } from './entities/humor.entity';
import { User } from '../users/entities/user.entity';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Humor, User])],
  controllers: [WellbeingController],
  providers: [WellbeingService, RolesGuard, PermissionsGuard],
  exports: [WellbeingService],
})
export class WellbeingModule {}
