import { Controller, Get, Post, Body, Param, Patch, Delete, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions, Roles } from '../auth/authorization.decorators';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { ADMIN_ROLES } from '../auth/authorization.constants';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
  
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard) // apenas requisicoes autorizadas
  @Roles(...ADMIN_ROLES)
  @Permissions('users.read')
  @Get()
  findAll(@Request() req) {
    return this.usersService.findAll(req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('users.read')
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.usersService.findOne(+id, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(...ADMIN_ROLES)
  @Permissions('users.create')
  @Post()
  create(@Body() createUserDto: CreateUserDto, @Request() req) {
    return this.usersService.create(createUserDto, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('users.update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto, @Request() req) {
    return this.usersService.update(+id, updateUserDto, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(...ADMIN_ROLES)
  @Permissions('users.delete')
  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.usersService.remove(+id, req.user);
  }
}
