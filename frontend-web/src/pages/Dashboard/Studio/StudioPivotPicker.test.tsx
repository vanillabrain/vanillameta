import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import StudioPivotPicker from './StudioPivotPicker';
import StudioSavedCopy from './StudioSavedCopy';
import { pivotBlock, pivotDocument, mixedPivotDocument } from './studioPivot.fixture';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
vi.mock('@/helpers/authResponseFence', () => ({ captureAuthResponseFence: () => () => undefined }));
afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());
it('selection only reads and adds the canonical cloned block only after explicit confirmation', async () => {
  const document = pivotDocument();
  document.blocks = [];
  document.layouts = { lg: [], md: [], xs: [] };
  const block = pivotBlock(),
    onAdd = vi.fn((block: ReturnType<typeof pivotBlock>) => Boolean(block));
  api.get.mockResolvedValue({ data: { options: [{ viewId: 1, name: '저장한 고객 Pivot', block }] } });
  render(<StudioPivotPicker document={document} disabled={false} onAdd={onAdd} />);
  expect(api.get).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '저장 Pivot 추가' }));
  await screen.findByRole('option', { name: '저장한 고객 Pivot' });
  fireEvent.change(screen.getByLabelText('저장한 집계 Pivot'), { target: { value: '1' } });
  expect(onAdd).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '초안에 추가' }));
  expect(onAdd).toHaveBeenCalledWith(block);
  expect(onAdd.mock.calls[0][0]).not.toBe(block);
  expect(api.get).toHaveBeenCalledWith('/studio/dashboards/3/pivot-options', undefined, { signal: expect.anything() });
});
it('refuses another source recipe without adding or writing', async () => {
  const block = pivotBlock();
  block.dimensionRefs[0].sourceId = 99;
  api.get.mockResolvedValue({ data: { options: [{ viewId: 1, name: '잘못된 보기', block }] } });
  const onAdd = vi.fn();
  render(<StudioPivotPicker document={pivotDocument()} disabled={false} onAdd={onAdd} />);
  fireEvent.click(screen.getByRole('button', { name: '저장 Pivot 추가' }));
  await screen.findByRole('alert');
  expect(onAdd).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
});
it('copy requires explicit saved-only confirmation and retries the exact body after an unknown outcome', async () => {
  api.post.mockRejectedValue(new Error('response lost'));
  render(
    <StudioSavedCopy
      dashboardId={3}
      revision={'a'.repeat(64)}
      sourceRevision={'c'.repeat(64)}
      disabled={false}
      onCopied={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Studio 저장본 복제' }));
  expect(api.post).not.toHaveBeenCalled();
  expect(screen.getByText(/현재 미저장 변경은 제외됩니다/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '저장본 복제' }));
  await screen.findByRole('alert');
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  const body = structuredClone(api.post.mock.calls[0][1]);
  fireEvent.click(screen.getByRole('button', { name: '같은 복제 요청 확인' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  expect(api.post.mock.calls[1][1]).toEqual(body);
});
it('keeps the completed copy dialog and draft context, links a new tab without another POST, and resets for a new saved revision', async () => {
  const original = mixedPivotDocument();
  original.blocks[1].id = 'saved-1';
  for (const bp of ['lg', 'md', 'xs'] as const) original.layouts[bp][1].id = 'saved-1';
  const document = structuredClone(original);
  document.dashboardId = 8;
  const idMap = { chart1: 'copied-chart', 'saved-1': 'copied-pivot' };
  for (const block of document.blocks) block.id = idMap[block.id];
  for (const bp of ['lg', 'md', 'xs'] as const)
    document.layouts[bp] = document.layouts[bp].map(g => ({ ...g, id: idMap[g.id] }));
  const onCopied = vi.fn();
  api.post.mockResolvedValue({ data: { dashboardId: 8, document, idMap } });
  const { rerender } = render(
    <StudioSavedCopy
      dashboardId={3}
      revision={'a'.repeat(64)}
      sourceRevision={'c'.repeat(64)}
      disabled={false}
      savedDocument={original}
      onCopied={onCopied}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Studio 저장본 복제' }));
  fireEvent.click(screen.getByRole('button', { name: '저장본 복제' }));
  await waitFor(() => expect(onCopied).toHaveBeenCalledWith(8));
  expect(api.post.mock.calls[0][1].document).toBeUndefined();
  expect(screen.getByRole('dialog')).toBeTruthy();
  const link = screen.getByRole('link', { name: '복사본 Studio 새 탭에서 열기' });
  expect(link.getAttribute('href')).toBe('/dashboard/8/studio');
  expect(link.getAttribute('target')).toBe('_blank');
  expect(link.getAttribute('rel')).toContain('noopener');
  // Suppress jsdom navigation; the product link has no click handler or async popup.
  link.addEventListener('click', event => event.preventDefault());
  fireEvent.click(link);
  expect(api.post).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: '닫기' }));
  fireEvent.click(screen.getByRole('button', { name: 'Studio 저장본 복제' }));
  expect(screen.getByRole('link', { name: '복사본 Studio 새 탭에서 열기' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: '저장본 복제' })).toBeNull();
  const firstRequest = api.post.mock.calls[0][1];
  rerender(
    <StudioSavedCopy
      dashboardId={3}
      revision={'b'.repeat(64)}
      sourceRevision={'c'.repeat(64)}
      disabled={false}
      savedDocument={original}
      onCopied={onCopied}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Studio 저장본 복제' }));
  expect(screen.queryByRole('link')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '저장본 복제' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  expect(api.post.mock.calls[1][1].expectedRevision).toBe('b'.repeat(64));
  expect(api.post.mock.calls[1][1].requestId).not.toBe(firstRequest.requestId);
});
