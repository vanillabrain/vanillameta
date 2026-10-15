import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const REQUEST_ID = '3f1a2b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b';
const diagnostic = {
  requestId: REQUEST_ID,
  errorCode: 'SAMPLE_UNAVAILABLE',
  stage: 'sample-install',
  version: 1,
  target: 'commerce-sample',
  dataHealth: 'unverified',
};
const sampleFailure = (value: unknown) => ({
  response: {
    status: 503,
    data: { success: false, code: 503, data: { message: '샘플을 준비할 수 없습니다.', diagnostic: value } },
  },
});
const helpSuccess = (explanation: string) => ({
  data: {
    status: 'SUCCESS',
    data: { requestId: REQUEST_ID, explanation, actions: ['retry-sample', 'open-files'], dataHealth: 'unverified' },
  },
});
const helpButton = () => screen.queryByRole('button', { name: /^(AI로 오류 설명 보기|오류 설명 준비 중…)$/ });
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
it('never offers AI help without a validated server diagnostic', async () => {
  mocks.post.mockRejectedValueOnce(new Error('offline'));
  render(<GettingStarted />);
  fireEvent.click(screen.getByRole('button', { name: '샘플 대시보드 보기' }));
  await screen.findByRole('alert');
  expect(helpButton()).toBeNull();
  expect(mocks.post).toHaveBeenCalledTimes(1);
});
it('offers help only on explicit click and posts nothing but the validated requestId', async () => {
  mocks.post.mockImplementationOnce(() => Promise.reject(sampleFailure(diagnostic)));
  mocks.post.mockImplementationOnce(() => Promise.resolve(helpSuccess('설치 단계에서 데이터 확인이 중단되었습니다.')));
  render(<GettingStarted />);
  fireEvent.click(screen.getByRole('button', { name: '샘플 대시보드 보기' }));
  const button = await screen.findByRole('button', { name: 'AI로 오류 설명 보기' });
  expect(mocks.post).toHaveBeenCalledTimes(1);
  fireEvent.click(button);
  await screen.findByText('설치 단계에서 데이터 확인이 중단되었습니다.');
  expect(mocks.post.mock.calls[1][0]).toBe('/commerce/sample-help');
  expect(mocks.post.mock.calls[1][1]).toEqual({ requestId: REQUEST_ID });
  expect(mocks.post.mock.calls[1][2]).toMatchObject({ signal: expect.any(AbortSignal) });
  expect(screen.getByText('가능한 원인')).toBeTruthy();
  expect(screen.getByText('복구 상태: 확인되지 않음 (unverified)')).toBeTruthy();
});
it('issues a single help call while pending and reuses the cached explanation', async () => {
  let resolveHelp: (value: unknown) => void = () => undefined;
  mocks.post.mockImplementationOnce(() => Promise.reject(sampleFailure(diagnostic)));
  mocks.post.mockImplementationOnce(
    () =>
      new Promise(r => {
        resolveHelp = r;
      }),
  );
  render(<GettingStarted />);
  fireEvent.click(screen.getByRole('button', { name: '샘플 대시보드 보기' }));
  await screen.findByRole('button', { name: 'AI로 오류 설명 보기' });
  fireEvent.click(screen.getByRole('button', { name: /^(AI로 오류 설명 보기|오류 설명 준비 중…)$/ }));
  fireEvent.click(screen.getByRole('button', { name: /^(AI로 오류 설명 보기|오류 설명 준비 중…)$/ }));
  fireEvent.click(screen.getByRole('button', { name: /^(AI로 오류 설명 보기|오류 설명 준비 중…)$/ }));
  expect(mocks.post).toHaveBeenCalledTimes(2);
  await act(async () => {
    resolveHelp(helpSuccess('중복 요청 없이 한 번만 설명합니다.'));
  });
  await screen.findByText('중복 요청 없이 한 번만 설명합니다.');
  fireEvent.click(screen.getByRole('button', { name: 'AI로 오류 설명 보기' }));
  await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(2));
});
it('aborts help and ignores a response that lands after the sample is retried', async () => {
  let resolveHelp: (value: unknown) => void = () => undefined;
  mocks.post.mockImplementationOnce(() => Promise.reject(sampleFailure(diagnostic)));
  mocks.post.mockImplementationOnce(
    () =>
      new Promise(r => {
        resolveHelp = r;
      }),
  );
  mocks.post.mockImplementationOnce(() => Promise.reject(new Error('sample still offline')));
  render(<GettingStarted />);
  fireEvent.click(screen.getByRole('button', { name: '샘플 대시보드 보기' }));
  fireEvent.click(await screen.findByRole('button', { name: 'AI로 오류 설명 보기' }));
  const signal = mocks.post.mock.calls[1][2].signal as AbortSignal;
  fireEvent.click(screen.getByRole('button', { name: '샘플 다시 시도' }));
  await screen.findByRole('alert');
  expect(signal.aborted).toBe(true);
  await act(async () => {
    resolveHelp(helpSuccess('늦게 도착한 설명'));
  });
  expect(screen.queryByText('늦게 도착한 설명')).toBeNull();
  expect(helpButton()).toBeNull();
});
it('aborts help on unmount and never applies the late response', async () => {
  let resolveHelp: (value: unknown) => void = () => undefined;
  mocks.post.mockImplementationOnce(() => Promise.reject(sampleFailure(diagnostic)));
  mocks.post.mockImplementationOnce(
    () =>
      new Promise(r => {
        resolveHelp = r;
      }),
  );
  const view = render(<GettingStarted />);
  fireEvent.click(screen.getByRole('button', { name: '샘플 대시보드 보기' }));
  fireEvent.click(await screen.findByRole('button', { name: 'AI로 오류 설명 보기' }));
  const signal = mocks.post.mock.calls[1][2].signal as AbortSignal;
  view.unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => {
    resolveHelp(helpSuccess('도착하면 안 되는 설명'));
  });
  expect(screen.queryByText('도착하면 안 되는 설명')).toBeNull();
});
it.each([
  { code: 'ECONNABORTED', message: 'private timeout detail' },
  { response: { status: 503, data: { message: 'private unsupported model detail' } } },
])('keeps the sample retry path after transport/provider failure %#', async error => {
  mocks.post.mockImplementationOnce(() => Promise.reject(sampleFailure(diagnostic)));
  mocks.post.mockImplementationOnce(() => Promise.reject(error));
  mocks.post.mockImplementationOnce(() => Promise.resolve({ data: { status: 'SUCCESS', data: { projectId: 21 } } }));
  render(<GettingStarted />);
  fireEvent.click(screen.getByRole('button', { name: '샘플 대시보드 보기' }));
  fireEvent.click(await screen.findByRole('button', { name: 'AI로 오류 설명 보기' }));
  await screen.findByText(/AI 오류 설명을 가져오지 못했습니다/);
  expect(screen.queryByText(/private.*detail/)).toBeNull();
  expect(screen.getByRole('button', { name: '내 파일 연결로 이동' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '샘플 다시 시도' }));
  await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/commerce/21?sample=1'));
});
it('rejects a help payload whose dataHealth is not unverified', async () => {
  mocks.post.mockImplementationOnce(() => Promise.reject(sampleFailure(diagnostic)));
  mocks.post.mockImplementationOnce(() =>
    Promise.resolve({
      data: {
        status: 'SUCCESS',
        data: {
          requestId: REQUEST_ID,
          explanation: '검증되지 않은 설명',
          actions: ['retry-sample', 'ftp://evil'],
          dataHealth: 'verified',
        },
      },
    }),
  );
  render(<GettingStarted />);
  fireEvent.click(screen.getByRole('button', { name: '샘플 대시보드 보기' }));
  fireEvent.click(await screen.findByRole('button', { name: 'AI로 오류 설명 보기' }));
  await screen.findByText(/AI 오류 설명을 가져오지 못했습니다/);
  expect(screen.queryByText('검증되지 않은 설명')).toBeNull();
});
it('keeps help disabled for forged, mismatched or missing diagnostics', async () => {
  mocks.post.mockImplementationOnce(() => Promise.reject(sampleFailure({ ...diagnostic, requestId: 'not-a-uuid' })));
  const forged = render(<GettingStarted />);
  fireEvent.click(screen.getByRole('button', { name: '샘플 대시보드 보기' }));
  await screen.findByRole('alert');
  expect(helpButton()).toBeNull();
  forged.unmount();
  cleanup();

  mocks.post.mockReset();
  mocks.post.mockImplementationOnce(() => Promise.reject(sampleFailure({ ...diagnostic, stage: 'other-stage' })));
  const mismatched = render(<GettingStarted />);
  fireEvent.click(screen.getByRole('button', { name: '샘플 대시보드 보기' }));
  await screen.findByRole('alert');
  expect(helpButton()).toBeNull();
  mismatched.unmount();
  cleanup();

  mocks.post.mockReset();
  mocks.post.mockImplementationOnce(() => Promise.reject(sampleFailure(null)));
  render(<GettingStarted />);
  fireEvent.click(screen.getByRole('button', { name: '샘플 대시보드 보기' }));
  await screen.findByRole('alert');
  expect(helpButton()).toBeNull();
  expect(mocks.post).toHaveBeenCalledTimes(1);
});

it('never displays raw response messages containing secrets or local paths', async () => {
  mocks.post.mockRejectedValueOnce({ response: { data: { message: 'password=secret /private/customer/orders.csv' } } });
  render(<GettingStarted />);
  fireEvent.click(screen.getByRole('button', { name: '샘플 대시보드 보기' }));
  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toContain('샘플을 준비하지 못했습니다.');
  expect(alert.textContent).not.toContain('password=secret');
  expect(alert.textContent).not.toContain('/private/customer');
});

it('cancels help, returns focus and keeps an immediate retry pending when the old response arrives', async () => {
  let resolveOld: (value: unknown) => void = () => undefined;
  let resolveNew: (value: unknown) => void = () => undefined;
  mocks.post.mockRejectedValueOnce(sampleFailure(diagnostic));
  mocks.post
    .mockImplementationOnce(
      () =>
        new Promise(r => {
          resolveOld = r;
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise(r => {
          resolveNew = r;
        }),
    );
  render(<GettingStarted />);
  fireEvent.click(screen.getByRole('button', { name: '샘플 대시보드 보기' }));
  fireEvent.click(await screen.findByRole('button', { name: 'AI로 오류 설명 보기' }));
  const signal = mocks.post.mock.calls[1][2].signal as AbortSignal;
  fireEvent.click(screen.getByRole('button', { name: '오류 설명 취소' }));
  expect(signal.aborted).toBe(true);
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'AI로 오류 설명 보기' }));
  expect(screen.getByText(/AI 오류 설명 요청을 취소했습니다/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'AI로 오류 설명 보기' }));
  await act(async () => {
    resolveOld(helpSuccess('오래된 설명'));
  });
  expect(screen.queryByText('오래된 설명')).toBeNull();
  expect(screen.getByRole('button', { name: '오류 설명 준비 중…' }).getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: '오류 설명 준비 중…' }));
  expect(mocks.post).toHaveBeenCalledTimes(3);
  await act(async () => {
    resolveNew(helpSuccess('새 설명'));
  });
  await screen.findByText('새 설명');
  expect(screen.queryByRole('button', { name: '오류 설명 취소' })).toBeNull();
});

it('opens the Studio creation entry without installing a sample or invoking AI', () => {
  render(<GettingStarted />);
  fireEvent.click(screen.getByRole('button', { name: 'Studio에서 내 데이터로 시작' }));
  expect(mocks.navigate).toHaveBeenCalledWith('/studio/new');
  expect(mocks.post).not.toHaveBeenCalled();
});
