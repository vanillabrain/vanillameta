import React, { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import ClassificationPicker from './ClassificationPicker';
const api = vi.hoisted(() => ({ get: vi.fn(), epoch: 'session-1' }));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, post: vi.fn() }));
vi.mock('@/helpers/editorDraftStorage', () => ({ editorDraftSessionEpoch: () => api.epoch }));
const entry = { id: 4, name: '매출', active: true, version: 2 };
const page = (over = {}) => ({
  data: { actorId: 1, organizationId: 7, canManage: false, entries: [entry], nextAfterId: null, ...over },
});
beforeEach(() => {
  vi.resetAllMocks();
  api.epoch = 'session-1';
  api.get.mockResolvedValue(page());
});
afterEach(cleanup);
const mount = (onSelect = vi.fn()) => {
  render(
    <StrictMode>
      <ClassificationPicker
        column="amount"
        reference={{ organizationId: 99, id: 3, version: 1 }}
        detachPending={false}
        onSelect={onSelect}
        onDetach={vi.fn()}
      />
    </StrictMode>,
  );
  return onSelect;
};
const load = async () => {
  fireEvent.click(screen.getByRole('button', { name: '공통 분류 불러오기' }));
  await screen.findByRole('option', { name: /매출 · ID 4/ });
};
it('StrictMode explicit load/search/refresh preserves historical ref and does not apply; selection adopts current server version', async () => {
  const select = mount();
  expect(api.get).not.toHaveBeenCalled();
  expect(screen.getByText(/조직 99 · 분류 3 · 버전 1/)).toBeTruthy();
  await load();
  fireEvent.change(screen.getByLabelText('amount 불러온 분류 검색'), { target: { value: '매출' } });
  expect(select).not.toHaveBeenCalled();
  api.get.mockResolvedValueOnce(page({ entries: [{ ...entry, name: '매출 최신', version: 3 }] }));
  fireEvent.change(screen.getByLabelText('amount 공통 분류'), { target: { value: '4' } });
  await waitFor(() => expect(select).toHaveBeenCalledWith('매출 최신', { organizationId: 7, id: 4, version: 3 }));
  expect(api.get.mock.lastCall).toEqual(['/enterprise/classifications', { afterId: 3 }]);
});
it.each([{ actorId: 2 }, { organizationId: 8 }, { entries: [{ ...entry, active: false }] }])(
  'revalidates selection and preserves parent inputs on changed identity or inactive entry %j',
  async over => {
    const select = mount();
    await load();
    api.get.mockResolvedValueOnce(page(over));
    fireEvent.change(screen.getByLabelText('amount 공통 분류'), { target: { value: '4' } });
    await screen.findByRole('alert');
    expect(select).not.toHaveBeenCalled();
    expect(screen.getByText(/조직 99 · 분류 3 · 버전 1/)).toBeTruthy();
  },
);
it('ignores a late selection response after a login-generation change', async () => {
  let resolve!: (v: any) => void;
  const select = mount();
  await load();
  api.get.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  fireEvent.change(screen.getByLabelText('amount 공통 분류'), { target: { value: '4' } });
  act(() => {
    api.epoch = 'session-2';
    window.dispatchEvent(new Event('storage'));
  });
  await act(async () => resolve(page()));
  expect(select).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('amount 공통 분류')).toBeNull();
});
it('cursor appends only current-context entries and inactive classifications cannot be selected', async () => {
  const select = mount();
  api.get.mockResolvedValueOnce(page({ nextAfterId: 4 }));
  await load();
  api.get.mockResolvedValueOnce(page({ entries: [{ ...entry, id: 8, name: '비활성', active: false }] }));
  fireEvent.click(screen.getByRole('button', { name: '분류 더 불러오기' }));
  await waitFor(() => expect(api.get.mock.lastCall).toEqual(['/enterprise/classifications', { afterId: 4 }]));
  expect(screen.queryByRole('option', { name: /비활성/ })).toBeNull();
  expect(select).not.toHaveBeenCalled();
});
