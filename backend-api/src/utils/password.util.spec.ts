import { createHash } from 'crypto';
import { hashPassword, verifyPassword } from './password.util';

describe('password.util', () => {
  describe('hashPassword/verifyPassword', () => {
    it('해시된 비밀번호를 검증한다', () => {
      const hashed = hashPassword('Admin!@12');
      expect(hashed.startsWith('s2:')).toBe(true);
      expect(verifyPassword('Admin!@12', hashed)).toEqual({ ok: true, needsRehash: false });
    });

    it('같은 비밀번호도 salt가 달라 다른 해시가 생성된다', () => {
      expect(hashPassword('pw')).not.toEqual(hashPassword('pw'));
    });

    it('틀린 비밀번호는 실패한다', () => {
      const hashed = hashPassword('right');
      expect(verifyPassword('wrong', hashed).ok).toBe(false);
    });
  });

  describe('레거시 sha512 호환', () => {
    it('기존 sha512 해시로 검증 후 재해싱을 요청한다', () => {
      const legacy = createHash('sha512').update('Admin!@12').digest('hex');
      const result = verifyPassword('Admin!@12', legacy);
      expect(result).toEqual({ ok: true, needsRehash: true });
    });

    it('레거시 해시도 틀린 비밀번호는 실패한다', () => {
      const legacy = createHash('sha512').update('correct').digest('hex');
      expect(verifyPassword('nope', legacy).ok).toBe(false);
    });
  });
});
