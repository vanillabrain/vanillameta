import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const SCRYPT_KEY_LENGTH = 64;
const HASH_PREFIX = 's2';

/**
 * 비밀번호 해시 생성 (scrypt + 랜덤 salt)
 * 포맷: s2:<salt_hex>:<derivedKey_hex>
 */
export function hashPassword(plainPassword: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(String(plainPassword), salt, SCRYPT_KEY_LENGTH);
  return `${HASH_PREFIX}:${salt}:${derived.toString('hex')}`;
}

/**
 * 비밀번호 검증
 * - 신규 포맷(s2:): scrypt 비교
 * - 레거시(salt 없는 sha512 hex): 비교 후 needsRehash=true 반환해 점진적 재해싱 유도
 */
export function verifyPassword(
  plainPassword: string,
  stored: string,
): { ok: boolean; needsRehash: boolean } {
  if (!stored) return { ok: false, needsRehash: false };

  if (stored.startsWith(`${HASH_PREFIX}:`)) {
    const [, salt, hash] = stored.split(':');
    const derived = scryptSync(String(plainPassword), salt, SCRYPT_KEY_LENGTH);
    const storedBuf = Buffer.from(hash, 'hex');
    const ok = storedBuf.length === derived.length && timingSafeEqual(storedBuf, derived);
    return { ok, needsRehash: false };
  }

  const legacy = createHash('sha512').update(String(plainPassword)).digest('hex');
  const ok =
    legacy.length === stored.length && timingSafeEqual(Buffer.from(legacy), Buffer.from(stored));
  return { ok, needsRehash: ok };
}
