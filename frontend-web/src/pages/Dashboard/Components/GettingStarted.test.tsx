import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import GettingStarted from './GettingStarted';
const mocks = vi.hoisted(() => ({ navigate: vi.fn(), post: vi.fn() }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/helpers/apiHelper', () => ({ post: mocks.post }));
vi.mock('@mui/material', async () => {
  const { createRequire } = await import('node:module');
  return createRequire(import.meta.url)('@mui/material');
});
afterEach(cleanup);
beforeEach(() => {
  mocks.navigate.mockReset();
  mocks.post.mockReset();
});
it('connects both file workflows without invoking AI or installing a sample', () => {
  render(<GettingStarted />);
  fireEvent.click(screen.getByRole('button', { name: '매출·환불 파일 연결' }));
  expect(mocks.navigate).toHaveBeenLastCalledWith('/commerce?import=1');
  fireEvent.click(screen.getByRole('button', { name: '일반 CSV·JSON·Parquet 분석' }));
  expect(mocks.navigate).toHaveBeenLastCalledWith('/data/file');
  expect(mocks.post).not.toHaveBeenCalled();
});
it('keeps an actionable error and retries the exact sample operation', async () => {
  mocks.post
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ data: { status: 'SUCCESS', data: { projectId: 9 } } });
  render(<GettingStarted />);
  fireEvent.click(screen.getByRole('button', { name: '샘플 대시보드 보기' }));
  await screen.findByRole('alert');
  expect(mocks.navigate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '샘플 다시 시도' }));
  await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/commerce/9?sample=1'));
});
it('blocks repeated activation while pending and rejects an invalid success payload', async () => {
  let resolve: (value: any) => void;
  mocks.post.mockImplementation(
    () =>
      new Promise(r => {
        resolve = r;
      }),
  );
  render(<GettingStarted returning />);
  const button = screen.getByRole('button', { name: '샘플 대시보드 보기' });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(mocks.post).toHaveBeenCalledTimes(1);
  resolve!({ data: { status: 'SUCCESS', data: { projectId: -1 } } });
  await screen.findByRole('alert');
  expect(mocks.navigate).not.toHaveBeenCalled();
});
