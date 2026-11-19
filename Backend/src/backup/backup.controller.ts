import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { BackupService, BackupItem } from './backup.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/authorization.decorators';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES } from '../auth/authorization.constants';

@Controller('backup')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.MASTER_ADMIN)

export class BackupController {
    constructor(private readonly backupService: BackupService) { }

    // 1 Rota para GERAR um novo backup 
    @Post('create')
    async create(@Request() req): Promise<{ message: string, data: BackupItem }> {
        const empresaId = req.user?.empresa_id || 1;
        const userId = req.user?.sub || 1;

        const backup = await this.backupService.createBackup(empresaId, userId);
        return {
            message: 'Backup gerado com sucesso!',
            data: backup,
        };
    }
    // 2 Rota para LISTAR backups ja feitos 
    @Get('list')
    async list(@Request() req): Promise<{ message: string; data: BackupItem[] }> {
        const empresaId = req.user?.empresa_id || 1;
        const backups = await this.backupService.listBackups(empresaId);
        return {
            message: 'Lista de backups obtida com sucesso',
            data: backups,
        };
    }

    // 3. Rota para RESTAURAR um backup específico
    @Post('restore')
    async restore(
        @Body('filename') filename: string,
        @Request() req,
    ): Promise<{ message: string; filename: string }> {
        const empresaId = req.user?.empresa_id || 1;
        const userId = req.user?.sub || 1;
        return this.backupService.restoreBackup(filename, empresaId, userId);
    }
}
