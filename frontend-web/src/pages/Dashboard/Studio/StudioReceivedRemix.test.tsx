import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import StudioReceivedRemix from './StudioReceivedRemix';
import { fetchRemixRequirements } from './studioRemixApi';
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), navigate: vi.fn(), id: '20', save: vi.fn() }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate, useParams: () => ({ dashboardId: mocks.id }) }));
vi.mock('@/helpers/apiHelper', () => ({ get: mocks.get, post: mocks.post }));
vi.mock('./StudioRemix', () => ({
  StudioRemixFlow: ({ token, onSave, onOriginRefresh }: any) => (
    <div>
      <p>{token}</p>
      <button onClick={onOriginRefresh}>원본 새로 확인</button>
      <button onClick={() => onSave({ requestId: 'private-copy' }, () => true)}>복제 저장</button>
      <button onClick={() => onSave({ requestId: 'late-copy' }, () => false)}>늦은 복제 응답</button>
    </div>
  ),
}));
vi.mock('./studioRemixApi', async () => ({
  ...(await vi.importActual<any>('./studioRemixApi')),
  saveRemix: (...args: unknown[]) => mocks.save(...args),
}));
const reference = 'd-1-7-20-2-' + 'a'.repeat(64);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.id = '20';
  mocks.get.mockResolvedValue({ data: { reference } });
  mocks.save.mockResolvedValue({ dashboardId: 90 });
});
afterEach(cleanup);
it('fetches a private current reference then saves through the same remix flow and opens only the new copy', async () => {
  render(<StudioReceivedRemix />);
  await screen.findByText(reference);
  expect(mocks.get).toHaveBeenCalledWith('/studio/received/20/remix-reference');
  fireEvent.click(screen.getByRole('button', { name: '복제 저장' }));
  await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/dashboard/90/studio'));
  expect(mocks.save).toHaveBeenCalledWith(reference, { requestId: 'private-copy' });
  mocks.navigate.mockClear();
  fireEvent.click(screen.getByRole('button', { name: '늦은 복제 응답' }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2));
  expect(mocks.navigate).not.toHaveBeenCalled();
});
it('keeps denial separate and explicitly retries permission/reference lookup', async () => {
  mocks.get.mockRejectedValueOnce(new Error('403'));
  render(<StudioReceivedRemix />);
  await screen.findByText(/현재 복제 허용과 원본/);
  expect(screen.queryByRole('button', { name: '복제 저장' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '복제 허용 다시 확인' }));
  await screen.findByText(reference);
  expect(mocks.save).not.toHaveBeenCalled();
});
it('refreshes the immutable reference explicitly when the original changes', async () => {
  const latest = 'd-1-7-20-3-' + 'b'.repeat(64);
  mocks.get.mockResolvedValueOnce({ data: { reference } }).mockResolvedValueOnce({ data: { reference: latest } });
  render(<StudioReceivedRemix />);
  await screen.findByText(reference);
  fireEvent.click(screen.getByRole('button', { name: '원본 새로 확인' }));
  await screen.findByText(latest);
  expect(mocks.save).not.toHaveBeenCalled();
});
it('rejects a reference for a different dashboard and ignores late lookup answers', async () => {
  let finish!: (value: unknown) => void;
  mocks.get.mockReturnValueOnce(
    new Promise(resolve => {
      finish = resolve;
    }),
  );
  const view = render(<StudioReceivedRemix />);
  view.unmount();
  await act(async () => finish({ data: { reference } }));
  expect(mocks.save).not.toHaveBeenCalled();
  mocks.get.mockResolvedValueOnce({ data: { reference: reference.replace('-20-', '-21-') } });
  render(<StudioReceivedRemix />);
  await screen.findByText(/현재 복제 허용과 원본/);
  expect(screen.queryByRole('button', { name: '복제 저장' })).toBeNull();
});
it('routes received templates to the JWT-only API and keeps publication requests separate', async () => {
  const requirements = {
    token: reference,
    version: 2,
    title: 'Received',
    requiredFields: [],
    blocks: [{ id: 'block-1', title: 'Total', kind: 'BOARD_NUMERIC', supported: true }],
  };
  mocks.get.mockResolvedValueOnce({ data: requirements });
  await fetchRemixRequirements(reference);
  expect(mocks.get.mock.calls[0][0]).toBe('/studio/received/' + reference + '/remix-template');
  mocks.get.mockResolvedValueOnce({ data: { ...requirements, token: 'c'.repeat(64) } });
  await fetchRemixRequirements('c'.repeat(64));
  expect(mocks.get.mock.calls[1][0]).toBe('/studio/publications/' + 'c'.repeat(64) + '/remix-template');
});
