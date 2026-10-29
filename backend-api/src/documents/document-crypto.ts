import { ServiceUnavailableException, ForbiddenException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

function key() {
  if (!process.env.CONFIG_SECRET_KEY)
    throw new ServiceUnavailableException('CONFIG_SECRET_KEY required.');
  return createHash('sha256').update(process.env.CONFIG_SECRET_KEY).digest();
}
export function seal(value: unknown, binding: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(binding));
  const content = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return [
    'doc:v1',
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    content.toString('base64'),
  ].join(':');
}
export function unseal(value: string, binding: string): unknown {
  const secret = key();
  try {
    const [prefix, version, iv, tag, content, extra] = value.split(':');
    if (prefix !== 'doc' || version !== 'v1' || !iv || !tag || !content || extra) throw new Error();
    const decipher = createDecipheriv('aes-256-gcm', secret, Buffer.from(iv, 'base64'));
    decipher.setAAD(Buffer.from(binding));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return JSON.parse(
      Buffer.concat([decipher.update(Buffer.from(content, 'base64')), decipher.final()]).toString(
        'utf8',
      ),
    );
  } catch {
    throw new ForbiddenException('Stored document authorization is invalid.');
  }
}
