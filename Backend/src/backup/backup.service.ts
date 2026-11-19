import { Injectable, Logger, BadRequestException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Tipo que define os dados de cada backup
export interface BackupItem {
    filename: string;
    sizeBytes: number;
    sizeFormatted: string;
    createdAt: string;
    formattedDate: string;
}

@Injectable()
export class BackupService {
    private readonly logger = new Logger(BackupService.name);
    private readonly backupDir: string;

    constructor(private readonly configService: ConfigService) {
        // Pasta onde os backups ficarão salvos: BD/backups
        this.backupDir = path.resolve(process.cwd(), '..', 'BD', 'backups');
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
    }

    // Localiza o executável do PostgreSQL no Windows sem interpolar aspas de shell
    private findPgBinary(binaryName: string): string {
        try {
            execFileSync('where', [binaryName], { stdio: 'ignore' });
            return binaryName;
        } catch {
            // Procura nas pastas de instalação do PostgreSQL
        }

        const baseDir = 'C:\\Program Files\\PostgreSQL';
        if (fs.existsSync(baseDir)) {
            const versions = fs.readdirSync(baseDir).sort((a, b) => Number(b) - Number(a));
            for (const v of versions) {
                const candidate = path.join(baseDir, v, 'bin', `${binaryName}.exe`);
                if (fs.existsSync(candidate)) {
                    return candidate;
                }
            }
        }

        return binaryName;
    }

    private belongsToCompany(filename: string, empresaId: number): boolean {
        return (
            filename.includes(`_empresa${empresaId}_`) ||
            filename.includes(`_empresa_${empresaId}_`)
        );
    }

    // Formata o tamanho do arquivo para fácil leitura (ex: 250 KB)
    private formatFileSize(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    // 1. CRIAR BACKUP
    async createBackup(empresaId: number, userId: number): Promise<BackupItem> {
        const host = this.configService.get<string>('DB_HOST', 'localhost');
        const port = String(this.configService.get<string>('DB_PORT', '5432'));
        const user = this.configService.get<string>('DB_USERNAME', 'postgres');
        const password = this.configService.get<string>('DB_PASSWORD', '');
        const database = this.configService.get<string>('DB_DATABASE', 'COOPERA');

        const now = new Date();
        const timestamp = now
            .toISOString()
            .replace(/T/, '_')
            .replace(/:/g, '-')
            .replace(/\..+/, '');

        const filename = `backup_${database}_empresa${empresaId}_${timestamp}.sql`;
        const outputPath = path.join(this.backupDir, filename);

        this.logger.log(`Iniciando backup solicitado pelo usuário #${userId} (empresa #${empresaId})...`);

        try {
            const pgDumpCmd = this.findPgBinary('pg_dump');
            const env = { ...process.env, PGPASSWORD: password };

            execFileSync(
                pgDumpCmd,
                ['-h', host, '-p', port, '-U', user, '--clean', '--if-exists', '-F', 'p', '-b', '-f', outputPath, database],
                { env, stdio: 'pipe' },
            );

            const stats = fs.statSync(outputPath);
            const item: BackupItem = {
                filename,
                sizeBytes: stats.size,
                sizeFormatted: this.formatFileSize(stats.size),
                createdAt: now.toISOString(),
                formattedDate: now.toLocaleString('pt-BR'),
            };

            this.logger.log(`Backup gerado com sucesso: ${filename} (${item.sizeFormatted})`);
            return item;
        } catch (error: any) {
            this.logger.error(`Falha ao gerar backup: ${error.message}`);
            throw new InternalServerErrorException(`Erro ao gerar backup: ${error.message}`);
        }
    }

    // 2. LISTAR BACKUPS (isolado pela empresa autenticada)
    async listBackups(empresaId: number): Promise<BackupItem[]> {
        if (!fs.existsSync(this.backupDir)) {
            return [];
        }

        const files = fs.readdirSync(this.backupDir);
        const backupList: BackupItem[] = [];

        for (const f of files) {
            if (!f.endsWith('.sql')) continue;
            if (!this.belongsToCompany(f, empresaId)) continue;

            const fullPath = path.join(this.backupDir, f);
            const stats = fs.statSync(fullPath);
            const mtime = stats.mtime;

            backupList.push({
                filename: f,
                sizeBytes: stats.size,
                sizeFormatted: this.formatFileSize(stats.size),
                createdAt: mtime.toISOString(),
                formattedDate: mtime.toLocaleString('pt-BR'),
            });
        }

        return backupList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    // 3. RESTAURAR BACKUP
    async restoreBackup(filename: string, empresaId: number, userId: number): Promise<{ message: string; filename: string }> {
        if (!filename || typeof filename !== 'string') {
            throw new BadRequestException('Nome do arquivo de backup não informado.');
        }

        const safeFilename = path.basename(filename);
        if (!safeFilename.endsWith('.sql') || !/^[a-zA-Z0-9._-]+$/.test(safeFilename)) {
            throw new BadRequestException('Nome de arquivo de backup inválido.');
        }

        if (!this.belongsToCompany(safeFilename, empresaId)) {
            throw new ForbiddenException('Este arquivo de backup não pertence à sua empresa.');
        }

        const targetPath = path.join(this.backupDir, safeFilename);

        if (!fs.existsSync(targetPath)) {
            throw new BadRequestException(`Arquivo de backup "${safeFilename}" não encontrado.`);
        }

        const host = this.configService.get<string>('DB_HOST', 'localhost');
        const port = String(this.configService.get<string>('DB_PORT', '5432'));
        const user = this.configService.get<string>('DB_USERNAME', 'postgres');
        const password = this.configService.get<string>('DB_PASSWORD', '');
        const database = this.configService.get<string>('DB_DATABASE', 'COOPERA');

        this.logger.warn(`RESTAURAÇÃO iniciada pelo usuário #${userId} (empresa #${empresaId}) com: ${safeFilename}`);

        try {
            const psqlCmd = this.findPgBinary('psql');
            const env = { ...process.env, PGPASSWORD: password };

            execFileSync(
                psqlCmd,
                ['-h', host, '-p', port, '-U', user, '-d', database, '-f', targetPath],
                { env, stdio: 'pipe' },
            );

            this.logger.log(`Banco restaurado com sucesso a partir de ${safeFilename}`);
            return {
                message: 'Backup restaurado com sucesso no banco de dados!',
                filename: safeFilename,
            };
        } catch (error: any) {
            this.logger.error(`Falha ao restaurar backup: ${error.message}`);
            throw new InternalServerErrorException(`Erro ao restaurar backup: ${error.message}`);
        }
    }
}
