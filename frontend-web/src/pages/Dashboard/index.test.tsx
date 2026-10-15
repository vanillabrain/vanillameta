import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, expect, it } from 'vitest';
import { LoadingProvider } from '@/contexts/LoadingContext';
import Dashboard from './index';

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: [], isFetching: true, isError: false }),
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
vi.mock('@/components/PageTitleBox', () => ({ default: () => null }));
vi.mock('@/components/BoardList', () => ({ default: () => null }));
vi.mock('@/seo/Seo', () => ({ default: () => null }));
vi.mock('./Components/GettingStarted', () => ({ default: () => null }));
vi.mock('./Components/AiDashboardPanel', () => ({
  default: ({ onSaved }: any) => <button onClick={() => onSaved(31, { publication: true })}>저장 후 게시 준비</button>,
}));

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
