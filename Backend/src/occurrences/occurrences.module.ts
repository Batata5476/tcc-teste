import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OccurrencesController } from './occurrences.controller';
import { OccurrencesService } from './occurrences.service';
import { Occurrence } from './entities/occurrence.entity';
import { User } from '../users/entities/user.entity';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Occurrence, User])],
  controllers: [OccurrencesController],
  providers: [OccurrencesService, RolesGuard, PermissionsGuard],
  exports: [OccurrencesService],
})
export class OccurrencesModule {}
