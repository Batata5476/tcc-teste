import { Controller, Get, Post, Body, Param, Patch, Delete, UseGuards, Req } from '@nestjs/common';
import { WorkService } from './work.service';
import { CreateWorkDto } from './dto/create-work.dto';
import { UpdateWorkDto } from './dto/update-work.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/authorization.decorators';


// todas as rotas exigem um token JWT válido para acesso
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('work')
export class WorkController {
  constructor(private readonly workService: WorkService) {}

  @Get()
  @Permissions('work.read')
  findAll(@Req() req) {
    return this.workService.findAll(req.user);
  }

  @Get(':id')
  @Permissions('work.read')
  findOne(@Param('id') id: string, @Req() req) {
    return this.workService.findOne(+id, req.user);
  }

  @Post()
  @Permissions('work.create')
  create(@Body() createWorkDto: CreateWorkDto, @Req() req) {
    return this.workService.create(createWorkDto, req.user);
  }

  @Patch(':id')
  @Permissions('work.update')
  update(@Param('id') id: string, @Body() updateDto: UpdateWorkDto, @Req() req) {
    return this.workService.update(+id, updateDto, req.user);
  }

  @Delete(':id')
  @Permissions('work.delete')
  remove(@Param('id') id: string, @Req() req) {
    return this.workService.remove(+id, req.user);
  }
}
