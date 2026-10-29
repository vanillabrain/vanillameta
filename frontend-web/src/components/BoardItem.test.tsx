import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import BoardItem from './BoardItem';
import { artifactListNavigation } from '@/helpers/artifactNavigation';

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
afterEach(cleanup);

function Destination() {
  const location = useLocation();
  return <div data-testid="destination">{location.pathname + location.search}</div>;
}
const remove = vi.fn();
const renderItem = (id: string | number, studioHref?: string) =>
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route
          path="/dashboard"
          element={
            <ul>
              <BoardItem
                data={{ id, title: 'Sample dashboard', updatedAt: '2026-10-15T00:00:00.000Z' }}
                handleDeleteSelect={remove}
                studioHref={studioHref}
              />
            </ul>
          }
        />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );

it('keeps the numeric dashboard id inside the row link path', () => {
  renderItem(1);
  expect(screen.getByRole('link').getAttribute('href')).toBe('/dashboard/1');
});

it('keeps string ids unchanged', () => {
  renderItem('widget-42');
  expect(screen.getByRole('link').getAttribute('href')).toBe('/dashboard/widget-42');
});

it('opens Studio through a separate named link while preserving the title view', async () => {
  renderItem(45, '/dashboard/45/studio');
  expect(screen.getByText('Sample dashboard').closest('a')?.getAttribute('href')).toBe('/dashboard/45');
  const studio = screen.getByRole('link', { name: 'Sample dashboard · Studio 열기' });
  expect(studio.closest('a')?.parentElement?.closest('a')).toBeNull();
  expect(document.querySelector('a button, a a')).toBeNull();
  fireEvent.click(studio);
  expect((await screen.findByTestId('destination')).textContent).toBe('/dashboard/45/studio');
});
it('keeps ordinary rows free of Studio links and preserves independent rename and delete actions', async () => {
  renderItem('widget-42');
  expect(screen.queryByRole('link', { name: /Studio 열기/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Sample dashboard · 삭제' }));
  expect(remove).toHaveBeenCalledWith('widget-42', 'Sample dashboard');
  expect(screen.queryByTestId('destination')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Sample dashboard · 수정' }));
  expect((await screen.findByTestId('destination')).textContent).toContain(
    '/dashboard/modify?id=widget-42&title=Sample dashboard',
  );
});

it('supports an independent optional archive/restore action without changing links or legacy delete', () => {
  const onClick = vi.fn();
  const data = { id: 45, title: 'Analysis', updatedAt: '2026-10-15' };
  const view = render(
    <MemoryRouter>
      <ul>
        <BoardItem
          data={data}
          handleDeleteSelect={remove}
          studioHref="/dashboard/45/studio"
          archiveAction={{ label: '보관', onClick }}
        />
      </ul>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Analysis · 보관' }));
  expect(onClick).toHaveBeenCalledOnce();
  expect(screen.getByText('Analysis').closest('a')?.getAttribute('href')).toBe('/45');
  expect(screen.getByRole('link', { name: 'Analysis · Studio 열기' })).toBeTruthy();
  expect(document.querySelector('a button, a a')).toBeNull();
  view.rerender(
    <MemoryRouter>
      <ul>
        <BoardItem data={data} handleDeleteSelect={remove} archiveAction={{ label: '복원', onClick, disabled: true }} />
      </ul>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Analysis · 복원' }));
  expect(onClick).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Analysis · 삭제' }));
  expect(remove).toHaveBeenCalledWith(45, 'Analysis');
});

it('offers separate view, Studio and archive controls in the grid without inventing a chart result', () => {
  const archive = vi.fn();
  render(
    <MemoryRouter initialEntries={['/dashboard?artifactDisplay=grid']}>
      <Routes>
        <Route
          path="/dashboard"
          element={
            <ul>
              <BoardItem
                data={{ id: 45, title: '실제 저장된 분석', updatedAt: '2026-10-29' }}
                display="grid"
                studioHref="/dashboard/45/studio"
                handleDeleteSelect={remove}
                archiveAction={{ label: '보관', onClick: archive }}
              />
            </ul>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
  const detail = new URL(
    screen.getByRole('link', { name: '실제 저장된 분석 · 열기' }).getAttribute('href') ?? '',
    'https://vm.test',
  );
  const studio = new URL(
    screen.getByRole('link', { name: '실제 저장된 분석 · Studio 열기' }).getAttribute('href') ?? '',
    'https://vm.test',
  );
  expect(detail.pathname).toBe('/dashboard/45');
  expect(studio.pathname).toBe('/dashboard/45/studio');
  expect(artifactListNavigation(detail).listHref).toBe('/dashboard?artifactDisplay=grid');
  expect(artifactListNavigation(studio).listHref).toBe('/dashboard?artifactDisplay=grid');
  expect(document.querySelector('a a, a button')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '실제 저장된 분석 · 보관' }));
  expect(archive).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: '실제 저장된 분석 · 삭제' }));
  expect(remove).toHaveBeenCalledWith(45, '실제 저장된 분석');
  expect(screen.getByText('열어서 저장된 시각화를 확인하세요')).toBeTruthy();
});
