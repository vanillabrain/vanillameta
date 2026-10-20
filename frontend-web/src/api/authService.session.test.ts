import { describe, expect, it, vi } from 'vitest';
const calls = vi.hoisted(() => ({ del: vi.fn().mockResolvedValue({ data: 'success' }) }));
vi.mock('@/helpers/apiHelper', () => ({ del: calls.del, get: vi.fn(), patch: vi.fn(), post: vi.fn() }));
import authService from './authService';

describe('authenticated account-delete payload', () => {
  it('passes the body inside the axios DELETE config data field', async () => {
    const body = { password: 'unit-password-fixture' };
    await authService.deleteUser(body);
    expect(calls.del).toHaveBeenCalledWith('/user/delete-account', { data: body });
  });
});
