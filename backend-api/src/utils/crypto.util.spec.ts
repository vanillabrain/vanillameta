import {
  decryptConnectionConfig,
  encryptConnectionConfig,
  parseConnectionConfig,
} from './crypto.util';

describe('crypto.util', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, CONFIG_SECRET_KEY: 'test-secret' };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('암호화/복호화 라운드트립', () => {
    const plain = JSON.stringify({ client: 'mysql2', connection: { password: 'secret' } });
    const encrypted = encryptConnectionConfig(plain);
    expect(encrypted.startsWith('enc:v1:')).toBe(true);
    expect(encrypted).not.toContain('secret');
    expect(decryptConnectionConfig(encrypted)).toBe(plain);
    expect(parseConnectionConfig(encrypted)).toEqual({
      client: 'mysql2',
      connection: { password: 'secret' },
    });
  });

  it('같은 입력도 IV가 달라 다른 암호문이 생성된다', () => {
    expect(encryptConnectionConfig('{}')).not.toEqual(encryptConnectionConfig('{}'));
  });

  it('기존 평문 JSON은 그대로 반환한다(하위호환)', () => {
    const plain = '{"a":1}';
    expect(decryptConnectionConfig(plain)).toBe(plain);
    expect(parseConnectionConfig(plain)).toEqual({ a: 1 });
  });

  it('잘못된 키로 복호화하면 실패한다', () => {
    const encrypted = encryptConnectionConfig('{"a":1}');
    process.env.CONFIG_SECRET_KEY = 'other-secret';
    expect(() => decryptConnectionConfig(encrypted)).toThrow();
  });
});
