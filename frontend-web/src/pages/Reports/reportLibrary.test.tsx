import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ArtifactLibrary from '../Dashboard/ArtifactLibrary';
import { artifactListNavigation } from '@/helpers/artifactNavigation';
import type { ReportLibraryItem } from './reportSharingApi';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/components/BoardItem', () => ({
  default: ({
    data,
    handleDeleteSelect,
    archiveAction,
  }: {
    data: { id: number; title: string };
    handleDeleteSelect: (id: number, title: string) => void;
    archiveAction?: { onClick: () => void };
  }) => (
    <li>
      <a href={'/dashboard/' + data.id}>{data.title}</a>
      <button onClick={() => handleDeleteSelect(data.id, data.title)}>대시보드 삭제</button>
      {archiveAction && <button onClick={archiveAction.onClick}>대시보드 보관</button>}
    </li>
  ),
}));
afterEach(cleanup);
const report: ReportLibraryItem = {
  kind: 'report',
  id: '12345678-1234-4234-8234-123456789abc',
  title: '받은 매출 보고서',
  ownership: 'received',
  version: 3,
  updatedAt: '2026-10-29',
};
it('mixes report/dashboard results in search/list/grid while only dashboards expose destructive actions', () => {
  const onDelete = vi.fn(),
    onArchive = vi.fn();
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <ArtifactLibrary
        items={[{ id: 1, title: '매출 대시보드', updatedAt: '2026-10-28', library: { archived: false, version: 1 } }]}
        reports={[report]}
        onDelete={onDelete}
        canArchive
        onArchive={onArchive}
      />
    </MemoryRouter>,
  );
  expect(screen.getByRole('link', { name: report.title }).getAttribute('href')).toBe(`/reports/${report.id}/read`);
  expect(screen.getByText('보고서 · 받은 보고서 · 버전 3')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('artifact.kindLabel'), { target: { value: 'report' } });
  expect(screen.queryByRole('button', { name: '대시보드 삭제' })).toBeNull();
  expect(screen.queryByRole('button', { name: '대시보드 보관' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'artifact.grid' }));
  expect(screen.getByRole('list', { name: 'artifact.gridLabel' })).toBeTruthy();
  const href = screen.getByRole('link', { name: report.title }).getAttribute('href');
  expect(href).toContain('artifactReturn');
  expect(onDelete).not.toHaveBeenCalled();
  expect(onArchive).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('artifact.searchLabel'), { target: { value: '다른 제목' } });
  expect(screen.queryByRole('link', { name: report.title })).toBeNull();
});
it('keeps reports out of archive and preserves authorized reports during dashboard-only failure', () => {
  const props = { items: [{ id: 1, title: 'hidden dashboard' }], reports: [report], onDelete: vi.fn(), listError: true };
  const view = render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <ArtifactLibrary {...props} />
    </MemoryRouter>,
  );
  expect(screen.getByRole('link', { name: report.title })).toBeTruthy();
  expect(screen.queryByText('hidden dashboard')).toBeNull();
  view.rerender(
    <MemoryRouter initialEntries={['/dashboard']}>
      <ArtifactLibrary {...props} view="archived" />
    </MemoryRouter>,
  );
  expect(screen.queryByRole('link', { name: report.title })).toBeNull();
});
it('round-trips the report filter with search/grid context through reader and editor navigation', () => {
  const hub = artifactListNavigation({
    pathname: '/dashboard',
    search: '?artifactKind=report&artifactQuery=매출&artifactDisplay=grid&artifactSort=title',
  });
  const reader = new URL(hub.link(`/reports/${report.id}/read`), 'http://local');
  const back = artifactListNavigation(reader);
  expect(back.listHref).toBe(hub.listHref);
  const editor = new URL(back.link(`/reports/${report.id}`), 'http://local');
  expect(artifactListNavigation(editor).listHref).toBe(hub.listHref);
});
