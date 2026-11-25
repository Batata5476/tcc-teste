import { BackupService } from './backup.service';
import { ForbiddenException, BadRequestException } from '@nestjs/common';

describe('BackupService (Cloud-Native PostgreSQL Snapshot)', () => {
  const mockConfig = {
    get: jest.fn().mockReturnValue('COOPERA'),
  } as any;

  it('should create and list company-scoped backups via PostgreSQL without pg_dump', async () => {
    const queryMock = jest.fn(async (sql: string) => {
      if (sql.includes('FROM empresa WHERE id')) {
        return [{ id: 1, cnpj: '99888777000100', nome: 'Empresa Teste', email: 'a@b.com' }];
      }
      if (sql.includes('FROM empresa_backups') && sql.includes('SELECT filename')) {
        return [
          {
            filename: 'backup_COOPERA_empresa1_2026-11-25_11-50-00.sql',
            size_bytes: 2048,
            criado_em: new Date('2026-11-25T11:50:00Z'),
          },
        ];
      }
      return [];
    });

    const dataSourceMock = {
      query: queryMock,
      transaction: jest.fn(),
    } as any;

    const service = new BackupService(mockConfig, dataSourceMock);
    const created = await service.createBackup(1, 10);

    expect(created.filename).toContain('backup_COOPERA_empresa1_');
    expect(created.sizeBytes).toBeGreaterThan(0);

    const list = await service.listBackups(1);
    expect(list).toHaveLength(1);
    expect(list[0].filename).toBe('backup_COOPERA_empresa1_2026-11-25_11-50-00.sql');
  });

  it('should block restoring a backup that belongs to another company', async () => {
    const dataSourceMock = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('SELECT empresa_id, payload FROM empresa_backups')) {
          return [{ empresa_id: 2, payload: {} }];
        }
        return [];
      }),
    } as any;

    const service = new BackupService(mockConfig, dataSourceMock);

    await expect(
      service.restoreBackup('backup_COOPERA_empresa2_2026-11-25_11-50-00.sql', 1, 10),
    ).rejects.toThrow(ForbiddenException);

    await expect(service.restoreBackup('../etc/passwd', 1, 10)).rejects.toThrow(
      BadRequestException,
    );
  });
});
