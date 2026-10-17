import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import ArtifactLibrary from './ArtifactLibrary';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/components/BoardItem', () => ({
  default: ({ data, studioHref, handleDeleteSelect }: any) => (
    <li data-testid="artifact-row">
      <a href={'/dashboard/' + data.id}>{data.title}</a>
      {studioHref && <a href={studioHref}>{data.title} Studio</a>}
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
