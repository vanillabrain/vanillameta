import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import ArtifactLibrary from './ArtifactLibrary';
vi.mock('react-i18next', async () => {
  const ko = (await import('@/i18n/locales/ko')).default;
  return {
    useTranslation: () => ({
      t: (key: string, values: Record<string, string | number> = {}) => {
        const text = key.startsWith('artifact.')
          ? Object.entries(ko.artifact).find(([name]) => name === key.slice(9))?.[1] ?? key
          : key;
        return text.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? ''));
      },
    }),
  };
});
vi.mock('@/components/BoardItem', () => ({
  default: ({ data, studioHref, handleDeleteSelect, archiveAction }: any) => (
    <li data-testid="artifact-row">
      <a href={'/dashboard/' + data.id}>{data.title}</a>
      {studioHref && <a href={studioHref}>{data.title} Studio</a>}
      {archiveAction && (
        <button disabled={archiveAction.disabled} onClick={archiveAction.onClick}>
          {data.title} {archiveAction.label}
        </button>
      )}
      <button onClick={() => handleDeleteSelect(data.id, data.title)}>{data.title} 삭제</button>
    </li>
  ),
}));
afterEach(cleanup);
const items = [
  { id: 1, title: 'Alpha 매출', updatedAt: '2026-10-01', analysisDefinition: '{}' },
  { id: 2, title: 'Beta 매출', updatedAt: '2026-10-03' },
  { id: 3, title: 'Gamma 환불', updatedAt: '2026-10-02', analysisDefinition: '{}' },
];
const show = (rows = items, onDelete = vi.fn()) =>
  render(
    <MemoryRouter>
      <ArtifactLibrary items={rows} onDelete={onDelete} />
    </MemoryRouter>,
  );
const titles = () => screen.getAllByTestId('artifact-row').map(row => row.querySelector('a')?.textContent);
it('combines normalized title search and type filters, preserves input order and existing links/actions', () => {
  const onDelete = vi.fn();
  show(items, onDelete);
  expect(titles()).toEqual(['Beta 매출', 'Gamma 환불', 'Alpha 매출']);
  fireEvent.change(screen.getByLabelText('산출물 제목 검색'), { target: { value: ' ＡＬＰＨＡ ' } });
  expect(titles()).toEqual(['Alpha 매출']);
  expect(screen.getByRole('link', { name: 'Alpha 매출 Studio' }).getAttribute('href')).toBe('/dashboard/1/studio');
  fireEvent.click(screen.getByRole('button', { name: 'Alpha 매출 삭제' }));
  expect(onDelete).toHaveBeenCalledWith(1, 'Alpha 매출');
  fireEvent.change(screen.getByLabelText('산출물 유형'), { target: { value: 'dashboard' } });
  expect(screen.queryByTestId('artifact-row')).toBeNull();
  expect(screen.getByText(/조건에 맞는 산출물이 없습니다/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '검색 조건 초기화' }));
  expect(titles()).toEqual(['Beta 매출', 'Gamma 환불', 'Alpha 매출']);
  fireEvent.change(screen.getByLabelText('산출물 정렬'), { target: { value: 'title' } });
  expect(titles()).toEqual(['Alpha 매출', 'Beta 매출', 'Gamma 환불']);
  expect(items.map(item => item.id)).toEqual([1, 2, 3]);
});
it('returns to the first page after searching from page two and handles unmatched/cleared filters', () => {
  show(
    Array.from({ length: 12 }, (_, index) => ({
      id: index + 1,
      title: `Report ${String(index + 1).padStart(2, '0')}`,
      updatedAt: '2026-10-01',
    })),
  );
  fireEvent.click(screen.getByRole('link', { name: '2' }));
  expect(titles()).toEqual(['Report 11', 'Report 12']);
  fireEvent.change(screen.getByLabelText('산출물 제목 검색'), { target: { value: 'Report 01' } });
  expect(titles()).toEqual(['Report 01']);
  expect(screen.getByRole('status').textContent).toBe('전체 12개 중 1개');
  fireEvent.change(screen.getByLabelText('산출물 제목 검색'), { target: { value: 'absent' } });
  expect(screen.queryByTestId('artifact-row')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '검색 조건 초기화' }));
  expect(titles()).toHaveLength(10);
  expect(titles()[0]).toBe('Report 01');
});
it('filters analyses and ordinary dashboards without fabricating Studio links', () => {
  show();
  fireEvent.change(screen.getByLabelText('산출물 유형'), { target: { value: 'analysis' } });
  expect(titles()).toEqual(['Gamma 환불', 'Alpha 매출']);
  fireEvent.change(screen.getByLabelText('산출물 유형'), { target: { value: 'dashboard' } });
  expect(titles()).toEqual(['Beta 매출']);
  expect(screen.queryByRole('link', { name: /Studio/ })).toBeNull();
});

it('preserves search/type/sort across library views and exposes optional archive actions only when enabled', () => {
  const onArchive = vi.fn();
  const onViewChange = vi.fn();
  const active = { ...items[0], library: { archived: false, version: 3 } };
  const archived = { ...active, library: { archived: true, version: 4 } };
  const props = { onDelete: vi.fn(), onArchive, onViewChange, canArchive: true };
  const view = render(
    <MemoryRouter>
      <ArtifactLibrary {...props} items={[active]} view="active" />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText('산출물 제목 검색'), { target: { value: 'Alpha' } });
  fireEvent.change(screen.getByLabelText('산출물 유형'), { target: { value: 'analysis' } });
  fireEvent.change(screen.getByLabelText('산출물 정렬'), { target: { value: 'title' } });
  fireEvent.click(screen.getByRole('button', { name: 'Alpha 매출 보관' }));
  expect(onArchive).toHaveBeenCalledWith(active);
  fireEvent.click(screen.getByRole('button', { name: '보관함' }));
  expect(onViewChange).toHaveBeenCalledWith('archived');
  view.rerender(
    <MemoryRouter>
      <ArtifactLibrary {...props} items={[archived]} view="archived" archiveDisabled />
    </MemoryRouter>,
  );
  expect((screen.getByLabelText('산출물 제목 검색') as HTMLInputElement).value).toBe('Alpha');
  expect((screen.getByLabelText('산출물 유형') as HTMLSelectElement).value).toBe('analysis');
  expect((screen.getByLabelText('산출물 정렬') as HTMLSelectElement).value).toBe('title');
  expect((screen.getByRole('button', { name: 'Alpha 매출 복원' }) as HTMLButtonElement).disabled).toBe(true);
  view.rerender(
    <MemoryRouter>
      <ArtifactLibrary {...props} items={[archived]} view="archived" canArchive={false} />
    </MemoryRouter>,
  );
  expect(screen.queryByRole('button', { name: 'Alpha 매출 복원' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Alpha 매출 Studio' })).toBeTruthy();
});

it('hides even provided stale rows on query failure while preserving filters and explicit reload', () => {
  const onReload = vi.fn();
  const props = { items, onDelete: vi.fn(), onViewChange: vi.fn(), onReload };
  const view = render(
    <MemoryRouter>
      <ArtifactLibrary {...props} />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText('산출물 제목 검색'), { target: { value: 'Alpha' } });
  view.rerender(
    <MemoryRouter>
      <ArtifactLibrary {...props} listError />
    </MemoryRouter>,
  );
  expect(screen.queryByTestId('artifact-row')).toBeNull();
  expect((screen.getByLabelText('산출물 제목 검색') as HTMLInputElement).value).toBe('Alpha');
  fireEvent.click(screen.getByRole('button', { name: '목록 다시 읽기' }));
  expect(onReload).toHaveBeenCalledOnce();
});

function LocationQuery() {
  return <output data-testid="library-url">{useLocation().search}</output>;
}

it('restores display and filters from the URL and keeps unrelated parameters when switching or resetting', () => {
  render(
    <MemoryRouter
      initialEntries={[
        '/dashboard?artifactDisplay=grid&artifactQuery=Alpha&artifactKind=analysis&artifactSort=title&aiSourceId=32',
      ]}
    >
      <ArtifactLibrary items={items} onDelete={vi.fn()} />
      <LocationQuery />
    </MemoryRouter>,
  );
  expect(screen.getByRole('button', { name: '그리드' }).getAttribute('aria-pressed')).toBe('true');
  expect(titles()).toEqual(['Alpha 매출']);
  fireEvent.click(screen.getByRole('button', { name: '목록', exact: true }));
  expect(screen.getByRole('list', { name: '산출물 목록' })).toBeTruthy();
  expect(titles()).toEqual(['Alpha 매출']);
  expect(screen.getByTestId('library-url').textContent).toContain('aiSourceId=32');
  fireEvent.click(screen.getByRole('button', { name: '그리드' }));
  fireEvent.click(screen.getByRole('button', { name: '검색 조건 초기화' }));
  expect(titles()).toEqual(['Beta 매출', 'Gamma 환불', 'Alpha 매출']);
  const params = new URLSearchParams(screen.getByTestId('library-url').textContent ?? '');
  expect(params.get('artifactDisplay')).toBe('grid');
  expect(params.get('aiSourceId')).toBe('32');
  expect(params.has('artifactQuery')).toBe(false);
});
