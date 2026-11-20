import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { Task } from './entities/task.entity';
import { FuncTarefa } from './entities/func-tarefa.entity';
import { User } from '../users/entities/user.entity';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Task, FuncTarefa, User])],
  controllers: [TasksController],
  providers: [TasksService, RolesGuard, PermissionsGuard],
  exports: [TasksService, TypeOrmModule],
})
export class TasksModule {}
