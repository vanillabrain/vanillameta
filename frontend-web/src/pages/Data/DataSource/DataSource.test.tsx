import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import DataSource from './index';
import { LoadingContext } from '@/contexts/LoadingContext';

const mocks = vi.hoisted(() => ({
  types: vi.fn(),
  test: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}));
vi.mock('@/api/databaseService', () => ({
  default: { selectDatabaseTypeList: mocks.types, testConnection: mocks.test },
}));
vi.mock('react-alert', () => ({ useAlert: () => ({ error: mocks.error, success: mocks.success }) }));

afterEach(cleanup);
beforeEach(() => {
  mocks.types.mockReset();
  mocks.test.mockReset();
  mocks.error.mockReset();
  mocks.success.mockReset();
  mocks.types.mockResolvedValue({ data: { data: [{ type: 'mysql', engine: 'mysql2', label: 'MySQL' }] } });
});

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <LoadingContext.Provider value={{ showLoading: vi.fn(), hideLoading: vi.fn() } as any}>
        <MemoryRouter>
          <DataSource />
        </MemoryRouter>
      </LoadingContext.Provider>
    </QueryClientProvider>,
  );

const submitMysql = async () => {
  renderPage();
  fireEvent.click(await screen.findByText('MySQL'));
  for (const [name, value] of [
    ['name', 'beta'],
    ['host', 'db'],
    ['port', '3306'],
    ['user', 'u'],
    ['password', 'p'],
    ['database', 'd'],
  ]) {
    fireEvent.change(document.querySelector(`input[name="${name}"]`)!, { target: { name, value } });
  }
  fireEvent.click(screen.getByRole('button', { name: 'TEST CONNECT' }));
};

it('tells the user a type this environment refuses is unavailable', async () => {
  mocks.test.mockRejectedValue({ response: { status: 403 } });
  await submitMysql();
  await waitFor(() => expect(mocks.error).toHaveBeenCalledTimes(1));
  expect(mocks.error.mock.calls[0][0]).toContain('사용할 수 없습니다');
  expect(mocks.success).not.toHaveBeenCalled();
});

it('shows the generic connection failure for other request errors', async () => {
  mocks.test.mockRejectedValue(new Error('network down'));
  await submitMysql();
  await waitFor(() => expect(mocks.error).toHaveBeenCalledTimes(1));
  expect(mocks.error.mock.calls[0][0]).toContain('연결할 수 없습니다');
});
