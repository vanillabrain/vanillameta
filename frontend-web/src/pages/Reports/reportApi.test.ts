import { expect, it, vi } from 'vitest';
import { reportError } from './reportApi';
vi.mock('@/helpers/apiHelper', () => ({ get: vi.fn(), post: vi.fn() }));
it.each([
  [401, '로그인이 만료됐습니다'],
  [403, '접근할 수 없습니다'],
  [404, '찾을 수 없습니다'],
  [409, '기준이 변경됐습니다'],
])('describes HTTP %s in Korean without requiring a response body', (status, message) => {
  expect(reportError({ response: { status } })).toContain(message);
  expect(reportError({ response: { status, data: { message: 'Forbidden' } } }, 'load')).toContain(message);
});
it('distinguishes failed initial reads from uncertain actions', () => {
  expect(reportError(new Error('offline'), 'load')).toContain('다시 불러오기');
  expect(reportError(new Error('offline'), 'load')).not.toContain('초안');
  expect(reportError(new Error('offline'))).toContain('초안을 유지했습니다');
});
