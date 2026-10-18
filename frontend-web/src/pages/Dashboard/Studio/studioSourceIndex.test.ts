import { afterEach, expect, it, vi } from 'vitest';
import { get } from '@/helpers/apiHelper';
import { fetchStudioSources } from './studioCreation';
vi.mock('@/helpers/apiHelper', () => ({ get: vi.fn(), post: vi.fn() }));
afterEach(() => vi.resetAllMocks());
const row = { id: 3, name: 'orders.csv', engine: 'duckdb' };
const response = (data: any) => ({
  data: { status: 'SUCCESS', data },
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {},
});
it('opts into summaries and accepts original-only and labeled sources', async () => {
  const rows = [row, { ...row, id: 4, catalogLabel: '매출', catalogVersion: 2 }];
  vi.mocked(get).mockResolvedValue(response(rows));
  expect(await fetchStudioSources()).toEqual(rows);
  expect(get).toHaveBeenCalledWith('/bi/sources', { catalog: '1' });
});
it.each([
  { catalogLabel: 7, catalogVersion: 1 },
  { catalogLabel: ' ', catalogVersion: 1 },
  { catalogLabel: '매출' },
  { catalogVersion: 1 },
  { catalogLabel: '매출', catalogVersion: '1' },
])('rejects malformed optional summaries %j', async patch => {
  vi.mocked(get).mockResolvedValue(response([{ ...row, ...patch }]));
  await expect(fetchStudioSources()).rejects.toThrow();
});
