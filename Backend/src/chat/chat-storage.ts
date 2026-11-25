import { ServiceUnavailableException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

export const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.mp4': 'video/mp4',
};

export function isServerlessRuntime(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

/**
 * Configuração opcional do Supabase Storage (bucket PÚBLICO para os anexos do chat).
 */
export function getSupabaseStorageConfig(): { url: string; key: string; bucket: string } | null {
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const bucket = (process.env.SUPABASE_STORAGE_BUCKET || 'chat-uploads').trim();
  if (!url || !key) return null;
  return { url, key, bucket };
}

export function getPublicChatFileUrl(fileName: string): string | null {
  const cfg = getSupabaseStorageConfig();
  if (!cfg) return null;
  return `${cfg.url}/storage/v1/object/public/${cfg.bucket}/chat/${fileName}`;
}

export async function uploadChatFileToSupabase(fileName: string, ext: string, buffer: Buffer): Promise<void> {
  const cfg = getSupabaseStorageConfig();
  if (!cfg) {
    throw new ServiceUnavailableException('Armazenamento externo não configurado.');
  }

  const response = await fetch(`${cfg.url}/storage/v1/object/${cfg.bucket}/chat/${fileName}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.key}`,
      apikey: cfg.key,
      'Content-Type': MIME_BY_EXT[ext] || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: new Uint8Array(buffer),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new ServiceUnavailableException(
      `Falha ao salvar o arquivo no Supabase Storage (HTTP ${response.status}). ${detail.slice(0, 160)}`,
    );
  }
}

let chatFilesTableReady = false;

async function ensureChatFilesTable(manager: EntityManager): Promise<void> {
  if (chatFilesTableReady) return;
  await manager.query(`
    CREATE TABLE IF NOT EXISTS chat_arquivos (
      filename VARCHAR(160) PRIMARY KEY,
      mime_type VARCHAR(100) NOT NULL,
      original_name VARCHAR(255),
      conteudo BYTEA NOT NULL,
      criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);
  chatFilesTableReady = true;
}

/**
 * Persiste o anexo diretamente no PostgreSQL (funciona automaticamente na Vercel + Supabase
 * mesmo sem configurar bucket externo ou SUPABASE_SERVICE_ROLE_KEY).
 */
export async function saveChatFileToDatabase(
  manager: EntityManager | undefined,
  fileName: string,
  ext: string,
  originalName: string,
  buffer: Buffer,
): Promise<boolean> {
  if (!manager || typeof manager.query !== 'function') {
    return false;
  }
  await ensureChatFilesTable(manager);
  const mimeType = MIME_BY_EXT[ext] || 'application/octet-stream';
  await manager.query(
    `INSERT INTO chat_arquivos (filename, mime_type, original_name, conteudo)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (filename) DO NOTHING`,
    [fileName, mimeType, originalName.slice(0, 255), buffer],
  );
  return true;
}

export async function getChatFileFromDatabase(
  manager: EntityManager | undefined,
  fileName: string,
): Promise<{ mimeType: string; originalName: string | null; buffer: Buffer } | null> {
  if (!manager || typeof manager.query !== 'function') {
    return null;
  }
  await ensureChatFilesTable(manager);
  const rows = await manager.query(
    `SELECT mime_type, original_name, conteudo FROM chat_arquivos WHERE filename = $1 LIMIT 1`,
    [fileName],
  );
  if (!rows || rows.length === 0) return null;
  const row = rows[0];
  const buffer = Buffer.isBuffer(row.conteudo) ? row.conteudo : Buffer.from(row.conteudo);
  return {
    mimeType: row.mime_type || 'application/octet-stream',
    originalName: row.original_name || null,
    buffer,
  };
}
