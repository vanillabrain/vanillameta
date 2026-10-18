import { beforeEach, expect, it, vi } from 'vitest';
import { DEPARTURE_COUNT_KEYS, fetchStaffDepartureImpact } from './staffDepartureService';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
const scope = { organizationId: 7, organizationVersion: 3, targetId: 42 };
const impact = () => ({
  ...scope,
  targetActive: false,
  observedAt: '2026-10-19T01:00:00Z',
  counts: Object.fromEntries(DEPARTURE_COUNT_KEYS.map(key => [key, 0])),
});
beforeEach(() => vi.resetAllMocks());
it('performs only the explicit GET, preserves config and accepts all eleven zero counts', async () => {
  api.get.mockResolvedValue({ data: impact() });
  const config = { signal: new AbortController().signal };
  await expect(fetchStaffDepartureImpact(scope, config)).resolves.toEqual(impact());
  expect(api.get).toHaveBeenCalledExactlyOnceWith('/enterprise/members/42/departure-impact', undefined, config);
  expect(api.post).not.toHaveBeenCalled();
  expect(api.patch).not.toHaveBeenCalled();
  expect(api.del).not.toHaveBeenCalled();
});
it.each([
  ['organizationId', 8],
  ['organizationId', '7'],
  ['organizationVersion', 4],
  ['organizationVersion', '3'],
  ['targetId', 43],
  ['targetId', '42'],
  ['targetActive', 0],
  ['observedAt', 'invalid'],
  ['observedAt', 1792350000000],
])('rejects wrong scope or malformed %s=%s', async (key, value) => {
  api.get.mockResolvedValue({ data: { ...impact(), [key]: value } });
  await expect(fetchStaffDepartureImpact(scope)).rejects.toMatchObject({ kind: 'invalid' });
});
it.each(DEPARTURE_COUNT_KEYS)('requires a safe nonnegative integer for %s', async key => {
  for (const value of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN, '1', null, undefined]) {
    const data: any = impact();
    data.counts[key] = value;
    api.get.mockResolvedValue({ data });
    await expect(fetchStaffDepartureImpact(scope)).rejects.toMatchObject({ kind: 'invalid' });
  }
});
it('rejects missing or additional fields instead of accepting content or a partial count set', async () => {
  const missingCount = impact();
  delete missingCount.counts.exportJobs;
  const missingField = { ...impact() };
  delete missingField.targetActive;
  for (const data of [
    null,
    [],
    missingField,
    missingCount,
    { ...impact(), title: 'private' },
    { ...impact(), counts: { ...impact().counts, total: 1 } },
  ]) {
    api.get.mockResolvedValue({ data });
    await expect(fetchStaffDepartureImpact(scope)).rejects.toMatchObject({ kind: 'invalid' });
  }
});
it('rejects invalid requested scope before making a request', async () => {
  for (const input of [
    { ...scope, targetId: 0 },
    { ...scope, organizationId: -1 },
    { ...scope, organizationVersion: -1 },
    { ...scope, targetId: Number.MAX_SAFE_INTEGER + 1 },
  ])
    await expect(fetchStaffDepartureImpact(input)).rejects.toMatchObject({ kind: 'invalid' });
  expect(api.get).not.toHaveBeenCalled();
});
it.each([
  [401, 'auth'],
  [403, 'forbidden'],
  [409, 'conflict'],
  [undefined, 'network'],
])('maps %s errors through enterpriseError', async (status, kind) => {
  api.get.mockRejectedValue(status ? { response: { status } } : new Error('offline'));
  await expect(fetchStaffDepartureImpact(scope)).rejects.toMatchObject({ kind });
});
