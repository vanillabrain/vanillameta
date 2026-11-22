import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AiArtifactView from './AiArtifactView';
import { aiArtifactService } from '@/api/aiArtifactService';

vi.mock('@/api/aiArtifactService', () => ({
  aiArtifactService: { detail: vi.fn(), revisions: vi.fn(), revision: vi.fn(), restore: vi.fn() },
}));
vi.mock('@/api/personalLibraryService', () => ({ personalLibrarySessionScope: () => 'session-a' }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('echarts-for-react', () => ({
  default: ({ option }: { option: { series: unknown } }) => (
    <div data-testid="chart-option">{JSON.stringify(option.series)}</div>
  ),
}));

const id = '33333333-3333-4333-8333-333333333333';
const context = { version: 1, query: 'alpha', kind: 'ai', sort: 'title', display: 'grid', view: 'active' };
function show(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/ai-artifacts/:id" element={<AiArtifactView />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

it('returns from the viewer to the same filtered hub', async () => {
  vi.mocked(aiArtifactService.detail).mockResolvedValue({
    id,
    kind: 'document',
    title: 'Alpha briefing',
    revision: 2,
    updatedAt: '2026-11-22T00:00:00.000Z',
    content: { markdown: 'Readable body' },
  });
  show('/ai-artifacts/' + id + '?artifactReturn=' + encodeURIComponent(JSON.stringify(context)));
  await screen.findByRole('heading', { name: 'Alpha briefing' });
  const target = new URL(screen.getByRole('link', { name: 'aiArtifact.back' }).getAttribute('href') ?? '', 'http://vm');
  expect(target.pathname).toBe('/dashboard');
  expect(target.searchParams.get('artifactQuery')).toBe('alpha');
  expect(target.searchParams.get('artifactKind')).toBe('ai');
  expect(target.searchParams.get('artifactSort')).toBe('title');
  expect(target.searchParams.get('artifactDisplay')).toBe('grid');
});

it('shows real chart values as visible rows and labels bars without replacing supplied series names', async () => {
  vi.mocked(aiArtifactService.detail).mockResolvedValue({
    id,
    kind: 'chart',
    title: 'Revenue by month',
    revision: 3,
    updatedAt: '2026-11-22T00:00:00.000Z',
    content: {
      chartType: 'bar',
      labels: ['Jan', 'Feb'],
      series: [
        { name: 'Net revenue', data: [120, 90] },
        { name: 'Refunds', data: [15, 8] },
      ],
    },
  });
  show('/ai-artifacts/' + id);
  await screen.findByRole('heading', { name: 'Revenue by month' });
  const table = screen.getByRole('table', { name: 'aiArtifact.chartValues' }) as HTMLTableElement;
  expect(within(table).getByRole('columnheader', { name: 'Net revenue' })).toBeTruthy();
  expect(within(table).getByRole('rowheader', { name: 'Jan' })).toBeTruthy();
  expect(within(table).getByRole('cell', { name: '120' })).toBeTruthy();
  expect(within(table).getByRole('cell', { name: '15' })).toBeTruthy();
  const oracle = [
    ['Jan', '120', '15'],
    ['Feb', '90', '8'],
  ];
  expect(Array.from(table.tBodies[0].rows, row => Array.from(row.cells, cell => cell.textContent))).toEqual(oracle);
  const series = screen.getByTestId('chart-option').textContent ?? '';
  expect(series).toContain('"name":"Net revenue"');
  expect(series).toContain('"show":true');
  expect(series).toContain('"position":"top"');
});

const current = {
  id, kind: 'document' as const, role: 'owner' as const, title: 'Latest title',
  updatedAt: '2026-11-22T00:00:00.000Z', revision: 2, content: { markdown: 'Latest body' },
};

it('opens a saved revision URL and restores the current version on explicit return', async () => {
  vi.mocked(aiArtifactService.detail).mockResolvedValue(current);
  vi.mocked(aiArtifactService.revisions).mockResolvedValue([2, 1].map(revision => ({ revision, updatedAt: current.updatedAt })));
  vi.mocked(aiArtifactService.revision).mockResolvedValue({ ...current, revision: 1, title: 'Earlier title', content: { markdown: 'Earlier body' } });
  show('/ai-artifacts/' + id + '?revision=1');
  await screen.findByText('Earlier body');
  expect(screen.queryByText('Latest body')).toBeNull();
  expect(screen.queryByText('aiArtifact.shareTitle')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'aiArtifact.returnLatest' }));
  await screen.findByText('Latest body');
  expect(screen.queryByText('Earlier body')).toBeNull();
});

it('never requests historical content or its index on a recipient link', async () => {
  vi.mocked(aiArtifactService.detail).mockResolvedValue({ ...current, role: 'recipient' });
  show('/ai-artifacts/' + id + '?revision=1');
  await screen.findByText('Latest body');
  expect(screen.getByText('aiArtifact.readOnly')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'aiArtifact.downloadSource' })).toBeNull();
  expect(aiArtifactService.revisions).not.toHaveBeenCalled();
  expect(aiArtifactService.revision).not.toHaveBeenCalled();
});

it('does not display the latest body as a missing old version', async () => {
  vi.mocked(aiArtifactService.detail).mockResolvedValue(current);
  vi.mocked(aiArtifactService.revisions).mockResolvedValue([{ revision: 2, updatedAt: current.updatedAt }]);
  vi.mocked(aiArtifactService.revision).mockRejectedValue(new Error('Unavailable'));
  show('/ai-artifacts/' + id + '?revision=1');
  expect((await screen.findByRole('alert')).textContent).toContain('aiArtifact.unavailableRevision');
  expect(screen.queryByText('Latest body')).toBeNull();
});

it('requires confirmation, cancels without writing and reopens the newly restored head', async () => {
  const earlier = { ...current, title: 'First title', revision: 1, content: { markdown: 'First body' } };
  vi.mocked(aiArtifactService.detail).mockResolvedValue(current);
  vi.mocked(aiArtifactService.revision).mockResolvedValue(earlier);
  vi.mocked(aiArtifactService.restore).mockResolvedValue({ ...earlier, revision: 3 });
  show('/ai-artifacts/' + id + '?revision=1');
  await screen.findByText('First body');
  fireEvent.click(screen.getByRole('button', { name: 'aiArtifact.restore' }));
  fireEvent.click(screen.getByRole('button', { name: 'aiArtifact.cancelRestore' }));
  expect(aiArtifactService.restore).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'aiArtifact.restore' }));
  fireEvent.click(screen.getByRole('button', { name: 'aiArtifact.confirmRestore' }));
  await screen.findByText('aiArtifact.shareTitle');
  expect(aiArtifactService.restore).toHaveBeenCalledExactlyOnceWith(id, 1, 2);
  expect(screen.getByRole('heading', { name: 'First title' })).toBeTruthy();
});

it('opens the current head after a conflicting restore without submitting a second write', async () => {
  vi.mocked(aiArtifactService.detail).mockResolvedValue(current);
  vi.mocked(aiArtifactService.revision).mockResolvedValue({
    ...current, revision: 1, content: { markdown: 'Earlier body' },
  });
  vi.mocked(aiArtifactService.restore).mockRejectedValue(new Error('revision mismatch'));
  show('/ai-artifacts/' + id + '?revision=1');
  await screen.findByText('Earlier body');
  fireEvent.click(screen.getByRole('button', { name: 'aiArtifact.restore' }));
  fireEvent.click(screen.getByRole('button', { name: 'aiArtifact.confirmRestore' }));
  const check = await screen.findByRole('button', { name: 'aiArtifact.checkLatest' });
  vi.mocked(aiArtifactService.detail).mockResolvedValue({
    ...current, revision: 3, content: { markdown: 'Concurrent edit' },
  });
  fireEvent.click(check);
  await screen.findByText('Concurrent edit');
  expect(screen.queryByText('Earlier body')).toBeNull();
  expect(aiArtifactService.restore).toHaveBeenCalledTimes(1);
});

it('downloads only creation fields from the authorized selected version', async () => {
  const older = { ...current, title: '분기 / 매출', revision: 1, content: { markdown: 'Earlier body' } };
  vi.mocked(aiArtifactService.detail).mockResolvedValue(current);
  vi.mocked(aiArtifactService.revision).mockResolvedValue(older);
  const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:artifact-source');
  let name = '';
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    name = this.download;
  });
  try {
    show('/ai-artifacts/' + id + '?revision=1');
    await screen.findByText('Earlier body');
    fireEvent.click(screen.getByRole('button', { name: 'aiArtifact.downloadSource' }));
    await screen.findByText('aiArtifact.downloadStarted');
    expect(name).toBe('분기  매출-v1.json');
    expect(aiArtifactService.revision).toHaveBeenLastCalledWith(id, 1, expect.any(AbortSignal));
    const file = create.mock.calls[0][0] as Blob;
    const raw = await new Promise<string>(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(file);
    });
    expect(JSON.parse(raw)).toEqual({ kind: 'document', title: older.title, content: older.content });
  } finally {
    click.mockRestore();
    create.mockRestore();
  }
});

it('keeps source private when ownership cannot be confirmed', async () => {
  vi.mocked(aiArtifactService.detail).mockResolvedValue(current);
  vi.mocked(aiArtifactService.revision).mockRejectedValue(new Error('Access revoked'));
  const create = vi.spyOn(URL, 'createObjectURL');
  try {
    show('/ai-artifacts/' + id);
    fireEvent.click(await screen.findByRole('button', { name: 'aiArtifact.downloadSource' }));
    expect((await screen.findByRole('alert')).textContent).toContain('aiArtifact.downloadError');
    expect(create).not.toHaveBeenCalled();
  } finally {
    create.mockRestore();
  }
});
