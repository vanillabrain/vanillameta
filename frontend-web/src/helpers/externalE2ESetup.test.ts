import { afterEach, expect, it, vi } from 'vitest';
import globalSetup from '../../e2e/global-setup';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), seed: vi.fn() }));
vi.mock('@playwright/test', () => ({ request: { newContext: async () => ({ get: mocks.get, post: mocks.post }) } }));
vi.mock('node:child_process', async importOriginal => ({
  ...(await importOriginal<typeof import('node:child_process')>()),
  execFileSync: mocks.seed,
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

it('refuses to seed the default local database when the external server has no components', async () => {
  vi.stubEnv('E2E_EXTERNAL_SERVER', '1');
  mocks.get.mockResolvedValue({ json: async () => [] });
  mocks.post
    .mockResolvedValueOnce({ status: () => 201 })
    .mockResolvedValueOnce({ ok: () => true, json: async () => ({ accessToken: 'synthetic-test-token' }) });
  await expect(globalSetup()).rejects.toThrow('기본 로컬 DB에는 시드하지 않습니다.');
  expect(mocks.seed).not.toHaveBeenCalled();
});
