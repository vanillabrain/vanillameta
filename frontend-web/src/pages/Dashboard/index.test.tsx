import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { vi, expect, it, afterEach } from 'vitest';
import { LoadingProvider } from '@/contexts/LoadingContext';
import Dashboard from './index';

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: [{ id: 45, analysisDefinition: '{}' }, { id: 28 }], isFetching: true, isError: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/contexts/AlertContext', () => ({ SnackbarContext: {} }));
vi.mock('@/components/loading', () => ({
  Loading: ({ in: loading }: any) => (loading ? <div role="progressbar" /> : null),
}));
vi.mock('react-alert', () => ({ useAlert: () => ({ error: vi.fn(), success: vi.fn() }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/api/dashboardService', () => ({ default: {} }));
afterEach(cleanup);
vi.mock('@/components/PageTitleBox', () => ({
  default: ({ button, children }: any) => (
    <>
      {button}
      {children}
    </>
  ),
}));
vi.mock('@/components/button/AddIconButton', () => ({
  MenuButton: ({ menuList, handleSelect }: any) =>
    menuList.map((item: any) => (
      <button key={item.id} onClick={() => handleSelect(item)}>
        {item.name}
      </button>
    )),
}));
vi.mock('@/components/BoardList', () => ({
  default: ({ postList, studioHrefForItem }: any) => (
    <div>
      {postList.map(item => (
        <span key={item.id} data-testid={'studio-path-' + item.id}>
          {studioHrefForItem?.(item) ?? '조회만'}
        </span>
      ))}
    </div>
  ),
}));
vi.mock('@/seo/Seo', () => ({ default: () => null }));
vi.mock('./Components/GettingStarted', () => ({ default: () => null }));
vi.mock('./Components/AiDashboardPanel', () => ({
  default: ({ onSaved, open, initialDatabaseId }: any) => (
    <>
      {open && <div role="status">기존 소스 {initialDatabaseId} 편집</div>}
      <button onClick={() => onSaved(31, { publication: true })}>저장 후 게시 준비</button>
    </>
  ),
}));

function Destination() {
  const location = useLocation();
  return <div>이동 완료 {location.pathname + location.search}</div>;
}

it.each([
  ['AI 대시보드 만들기', '/studio/new'],
  ['nav.dashboard', '/dashboard/create?createType=dashboard'],
  ['list.recommend', '/dashboard/create?createType=recommend'],
])('routes the %s menu to its intended workflow', async (name, destination) => {
  render(
    <LoadingProvider>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="*" element={<Destination />} />
        </Routes>
      </MemoryRouter>
    </LoadingProvider>,
  );
  expect(screen.queryByText(/기존 소스 \d+ 편집/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name }));
  expect(await screen.findByText('이동 완료 ' + destination)).toBeTruthy();
});

it('preserves the existing source-specific AI panel link', () => {
  render(
    <LoadingProvider>
      <MemoryRouter initialEntries={['/dashboard?aiSourceId=32']}>
        <Dashboard />
      </MemoryRouter>
    </LoadingProvider>,
  );
  expect(screen.getByText('기존 소스 32 편집')).toBeTruthy();
});

it('releases the list loading overlay when a save handoff leaves a pending list refetch', async () => {
  render(
    <LoadingProvider>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/31/publication" element={<button>게시 결과 미리보기</button>} />
        </Routes>
      </MemoryRouter>
    </LoadingProvider>,
  );
  expect(screen.getByRole('progressbar')).toBeTruthy();
  fireEvent.click(screen.getByText('저장 후 게시 준비'));
  expect(await screen.findByText('게시 결과 미리보기')).toBeTruthy();
  expect(screen.queryByRole('progressbar')).toBeNull();
});

it('offers direct Studio reentry for analysis rows only', () => {
  render(
    <LoadingProvider>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Dashboard />
      </MemoryRouter>
    </LoadingProvider>,
  );
  expect(screen.getByTestId('studio-path-45').textContent).toBe('/dashboard/45/studio');
  expect(screen.getByTestId('studio-path-28').textContent).toBe('조회만');
});
