import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Permission } from './entities/permission.entity';
import { Role } from './entities/role.entity';
import { Setor } from '../company/entities/setor.entity';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';

@Module({
  imports: [TypeOrmModule.forFeature([User, Permission, Role, Setor])],
  controllers: [UsersController],
  providers: [UsersService, RolesGuard, PermissionsGuard],
  exports: [UsersService],
})
export class UsersModule {}
