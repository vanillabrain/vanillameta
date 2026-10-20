import { beforeEach, expect, it, vi } from 'vitest';
import { EnterpriseApiError } from '@/api/enterpriseService';
import {
  fetchSourceLifecycle,
  saveSourceLifecycle,
  sourceLifecycleError,
  sourceLifecyclePath,
} from './sourceLifecycleService';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, post: api.post, patch: vi.fn(), del: vi.fn() }));

const raw = (data: unknown) => ({ data });
const failureOf = async (promise: Promise<unknown>) => (await promise.catch(error => error)) as EnterpriseApiError;

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
});

it('reads the availability of the exact requested source and rejects any other answer', async () => {
  api.get.mockResolvedValueOnce(raw({ sourceId: 5, active: true, version: 3 }));
  await expect(fetchSourceLifecycle(5)).resolves.toEqual({ sourceId: 5, active: true, version: 3 });
  expect(api.get).toHaveBeenCalledWith(sourceLifecyclePath(5), undefined, {});
  expect(sourceLifecyclePath(5)).toBe('/enterprise/resources/source/5/lifecycle');

  // An answer for another source, a non boolean state or a negative version is never rendered as this source's state.
  api.get.mockResolvedValueOnce(raw({ sourceId: 6, active: true, version: 3 }));
  expect((await failureOf(fetchSourceLifecycle(5))).kind).toBe('invalid');
  api.get.mockResolvedValueOnce(raw({ sourceId: 5, active: 'yes', version: 3 }));
  expect((await failureOf(fetchSourceLifecycle(5))).kind).toBe('invalid');
  api.get.mockResolvedValueOnce(raw({ sourceId: 5, active: false, version: -1 }));
  expect((await failureOf(fetchSourceLifecycle(5))).kind).toBe('invalid');
});

it('sends exactly the target state with the version it was read at, and expects version+1 back', async () => {
  api.post.mockResolvedValueOnce(raw({ sourceId: 5, active: false, version: 4 }));
  await expect(saveSourceLifecycle(5, { active: false, expectedVersion: 3 })).resolves.toEqual({
    sourceId: 5,
    active: false,
    version: 4,
  });
  const [url, body] = api.post.mock.calls[0];
  expect(url).toBe('/enterprise/resources/source/5/lifecycle');
  // The body carries exactly the two documented keys; the actor, owner and organization stay server-side.
  expect(Object.keys(body).sort()).toEqual(['active', 'expectedVersion']);
  expect(body).toEqual({ active: false, expectedVersion: 3 });

  // A receipt must describe this exact request: version+1, the requested state, and the same source.
  api.post.mockResolvedValueOnce(raw({ sourceId: 5, active: false, version: 3 }));
  expect((await failureOf(saveSourceLifecycle(5, { active: false, expectedVersion: 3 }))).kind).toBe('invalid');
  api.post.mockResolvedValueOnce(raw({ sourceId: 5, active: false, version: 5 }));
  expect((await failureOf(saveSourceLifecycle(5, { active: false, expectedVersion: 3 }))).kind).toBe('invalid');
  api.post.mockResolvedValueOnce(raw({ sourceId: 5, active: true, version: 4 }));
  expect((await failureOf(saveSourceLifecycle(5, { active: false, expectedVersion: 3 }))).kind).toBe('invalid');
  api.post.mockResolvedValueOnce(raw({ sourceId: 6, active: false, version: 4 }));
  expect((await failureOf(saveSourceLifecycle(5, { active: false, expectedVersion: 3 }))).kind).toBe('invalid');
});

it('maps refusals onto the shared lifecycle error kinds', () => {
  expect(sourceLifecycleError({ response: { status: 403 } }).kind).toBe('forbidden');
  expect(sourceLifecycleError({ response: { status: 401 } }).kind).toBe('auth');
  expect(sourceLifecycleError({ response: { status: 409 } }).message).toMatch(/최신 상태를 다시 읽은 뒤/);
  expect(sourceLifecycleError(new Error('Network Error')).kind).toBe('network');
  expect(sourceLifecycleError(new Error('Network Error')).message).toMatch(/선택한 상태는 그대로 두었습니다/);
  expect(sourceLifecycleError({ response: { status: 400, data: { message: 'source unavailable' } } }).message).toBe(
    'source unavailable',
  );

  // A payload that failed the shape check is already classified and passes through unchanged.
  const invalid = new EnterpriseApiError('bad shape', 'invalid');
  expect(sourceLifecycleError(invalid)).toBe(invalid);
});
