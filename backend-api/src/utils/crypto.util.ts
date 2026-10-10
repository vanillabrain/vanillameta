import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const PREFIX = 'enc:v1:';

function getKey(): Buffer {
  const secret = process.env.CONFIG_SECRET_KEY || process.env.ACCESS_SECRET;
  if (!secret) {
    throw new Error('CONFIG_SECRET_KEY or ACCESS_SECRET environment variable is required');
  }
  return createHash('sha256').update(String(secret)).digest();
}

/**
 * DB 접속정보 JSON 문자열을 AES-256-GCM으로 암호화
 * 포맷: enc:v1:<iv_b64>:<tag_b64>:<cipher_b64>
 */
export function encryptConnectionConfig(plainJson: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainJson, 'utf8'), cipher.final()]);
  return `${PREFIX}${iv.toString('base64')}:${cipher
    .getAuthTag()
    .toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * 저장된 접속정보 복호화. enc:v1: 접두사가 없으면 기존 평문 JSON으로 간주하고 그대로 반환
 */
export function decryptConnectionConfig(stored: string): string {
  if (!stored || !stored.startsWith(PREFIX)) return stored;
  const parts = stored.split(':');
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(parts[2], 'base64'));
  decipher.setAuthTag(Buffer.from(parts[3], 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(parts[4], 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export function parseConnectionConfig(stored: string): any {
  return JSON.parse(decryptConnectionConfig(stored));
}
