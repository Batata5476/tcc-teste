import { Controller, Get, Post, Body, Param, Patch, Delete, UseGuards, Req } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { CreateTaskPayloadDto } from './dto/create-task-payload.dto';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { ADMIN_ROLES } from '../auth/authorization.constants';
import { Permissions, Roles } from '../auth/authorization.decorators';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get('my-tasks')
  @Permissions('tasks.read')
  async findMyTasks(@Req() req) {
    return this.tasksService.findAllByEmployee(req.user);
  }

  @Get('company-tasks')
  @Roles(...ADMIN_ROLES)
  @Permissions('tasks.read')
  async findCompanyTasks(@Req() req) {
    // Para empresas / administradores
    const companyId = req.user.empresa_id || req.user.sub;
    return this.tasksService.findAllByCompany(companyId);
  }

  @Post()
  @Permissions('tasks.create')
  async create(@Req() req, @Body() body: CreateTaskPayloadDto) {
    return this.tasksService.create({
      tipo_tarefa: body.tipo_tarefa,
      validade_tarefa: body.validade_tarefa,
      prioridade_tarefa: body.prioridade_tarefa,
      fk_id_func: body.fk_id_func,
    }, req.user);
  }

  @Patch(':id/status')
  @Permissions('tasks.update')
  async updateStatus(@Param('id') id: string, @Body() body: UpdateTaskStatusDto, @Req() req) {
    return this.tasksService.updateStatus(+id, body.status, req.user);
  }

  @Get(':id')
  @Permissions('tasks.read')
  async findOne(@Param('id') id: string, @Req() req) {
    return this.tasksService.findOne(+id, req.user);
  }

  @Delete(':id')
  @Roles(...ADMIN_ROLES)
  @Permissions('tasks.delete')
  async remove(@Param('id') id: string, @Req() req) {
    return this.tasksService.remove(+id, req.user);
  }
}
