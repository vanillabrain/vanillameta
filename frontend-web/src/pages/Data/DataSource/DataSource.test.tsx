import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import DataSource from './index';
import { LoadingContext } from '@/contexts/LoadingContext';

const mocks = vi.hoisted(() => ({
  types: vi.fn(),
  info: vi.fn(),
  test: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}));
vi.mock('@/api/databaseService', () => ({
  default: { selectDatabaseTypeList: mocks.types, selectDatabaseInfo: mocks.info, testConnection: mocks.test },
}));
vi.mock('react-alert', () => ({ useAlert: () => ({ error: mocks.error, success: mocks.success }) }));

const MYSQL = { id: 1, type: 'mysql', engine: 'mysql2', title: 'MySQL' };
const SQLITE = { id: 2, type: 'sqlite', engine: 'sqlite3', title: 'SQLite' };

afterEach(cleanup);
beforeEach(() => {
  mocks.types.mockReset();
  mocks.info.mockReset();
  mocks.test.mockReset();
  mocks.error.mockReset();
  mocks.success.mockReset();
  mocks.types.mockResolvedValue({ data: { data: [MYSQL] } });
});

// react-i18next has no instance in tests, so t() returns the key: the assertions name the key shown.
const renderPage = (entry = '/data/source/create') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <LoadingContext.Provider value={{ showLoading: vi.fn(), hideLoading: vi.fn() } as any}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/data/source/create" element={<DataSource />} />
            <Route path="/data/source/modify/:sourceId" element={<DataSource />} />
          </Routes>
        </MemoryRouter>
      </LoadingContext.Provider>
    </QueryClientProvider>,
  );

const submitMysql = async () => {
  renderPage();
  fireEvent.click(await screen.findByText('MySQL'));
  const form = document.querySelector('form') as HTMLFormElement;
  for (const [name, value] of [
    ['name', 'beta'],
    ['host', 'db'],
    ['port', '3306'],
    ['user', 'u'],
    ['password', 'p'],
    ['database', 'd'],
  ]) {
    const input = form.elements.namedItem(name) as HTMLInputElement;
    fireEvent.change(input, { target: { name, value } });
    // DatabaseForm reads `event.target.<field>.value`; browsers expose a form's controls by name
    // (even shadowing `form.name`), jsdom does not, so mirror that here.
    Object.defineProperty(form, name, { value: input, configurable: true });
  }
  fireEvent.click(screen.getByRole('button', { name: 'TEST CONNECT' }));
};

it('tells the user a type this environment refuses is unavailable', async () => {
  mocks.test.mockRejectedValue({ response: { status: 403 } });
  await submitMysql();
  await waitFor(() => expect(mocks.error).toHaveBeenCalledTimes(1));
  expect(mocks.error).toHaveBeenCalledWith('dataSource.typeUnavailable');
  expect(mocks.success).not.toHaveBeenCalled();
});

it('shows the generic connection failure for other request errors', async () => {
  mocks.test.mockRejectedValue(new Error('network down'));
  await submitMysql();
  await waitFor(() => expect(mocks.error).toHaveBeenCalledTimes(1));
  expect(mocks.error).toHaveBeenCalledWith('dataSource.connectFail');
});

it('explains why a saved source whose type the environment no longer lists cannot be edited', async () => {
  mocks.types.mockResolvedValue({ data: { data: [SQLITE] } });
  mocks.info.mockResolvedValue({
    data: { data: { databaseInfo: { name: 'old', type: 'mysql', engine: 'mysql2', connectionConfig: {} } } },
  });
  renderPage('/data/source/modify/5');
  expect(await screen.findByText('dataSource.typeUnavailable')).toBeTruthy();
  expect(screen.queryByText('dataSource.selectType')).toBeNull();
});

// The form is chosen by the saved `type`, so a listed row with the same engine does not make it editable.
it('still explains it when another listed type shares the saved source engine', async () => {
  mocks.types.mockResolvedValue({ data: { data: [MYSQL] } });
  mocks.info.mockResolvedValue({
    data: { data: { databaseInfo: { name: 'old', type: 'maria', engine: 'mysql2', connectionConfig: {} } } },
  });
  renderPage('/data/source/modify/6');
  expect(await screen.findByText('dataSource.typeUnavailable')).toBeTruthy();
  expect(screen.queryByText('dataSource.selectType')).toBeNull();
});
