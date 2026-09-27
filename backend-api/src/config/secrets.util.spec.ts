import { buildParameterNames, findMissingSecrets, resolveSecrets } from './secrets.util';

describe('secrets.util', () => {
  describe('buildParameterNames', () => {
    it('prefix 하위에 키별 파라미터 이름을 만든다', () => {
      expect(buildParameterNames('/vanillameta/prod', ['ACCESS_SECRET'])).toEqual({
        ACCESS_SECRET: '/vanillameta/prod/ACCESS_SECRET',
      });
    });

    it('prefix 끝의 슬래시를 정규화한다', () => {
      expect(buildParameterNames('/vanillameta/prod/', ['A'])).toEqual({ A: '/vanillameta/prod/A' });
    });
  });

  describe('resolveSecrets', () => {
    it('조회된 값만 반환하고 없는 값은 건너뛴다', async () => {
      const fetchParameter = async (name: string) =>
        name.endsWith('/FOUND') ? 'value' : undefined;

      const result = await resolveSecrets(fetchParameter, {
        FOUND: '/p/FOUND',
        MISSING: '/p/MISSING',
      });

      expect(result).toEqual({ FOUND: 'value' });
    });

    it('빈 문자열은 건너뛴다', async () => {
      const result = await resolveSecrets(async () => '', { A: '/p/A' });
      expect(result).toEqual({});
    });
  });

  describe('findMissingSecrets', () => {
    it('비어 있는 필수 키를 반환한다', () => {
      expect(findMissingSecrets({ ACCESS_SECRET: 'x' }, ['ACCESS_SECRET', 'REFRESH_SECRET'])).toEqual([
        'REFRESH_SECRET',
      ]);
    });
  });
});
