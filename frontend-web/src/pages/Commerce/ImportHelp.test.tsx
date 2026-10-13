import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ImportHelp, { parseImportDiagnostic } from './ImportHelp';

const mocks = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => ({ post: mocks.post }));
vi.mock('@mui/material', async () => {
  const { createRequire } = await import('node:module');
  return createRequire(import.meta.url)('@mui/material');
});

const REQUEST_ID = '3f1a2b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b';
const diagnostic = { requestId: REQUEST_ID, errorCode: 'IMPORT_INVALID_DATE' as const };
const envelopeDiagnostic = {
  requestId: REQUEST_ID,
  errorCode: 'IMPORT_INVALID_DATE',
  stage: 'commerce-import',
  version: 1,
  target: 'commerce-bundle',
  dataHealth: 'unverified',
};
const import400 = (value: unknown) => ({
  response: {
    status: 400,
    data: { success: false, code: 400, data: { message: 'raw internal detail', diagnostic: value } },
  },
});
const helpOk = (explanation: string, actions: string[] = ['reselect-files']) => ({
  data: {
    status: 'SUCCESS',
    data: { requestId: REQUEST_ID, explanation, actions, dataHealth: 'unverified' },
  },
});
beforeEach(() => mocks.post.mockReset());
afterEach(cleanup);

it('offers the manual reselect action before any help response', () => {
  const onReselect = vi.fn();
  render(<ImportHelp diagnostic={diagnostic} onReselectFiles={onReselect} />);
  expect(mocks.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '파일 다시 선택' }));
  expect(onReselect).toHaveBeenCalledTimes(1);
});

it('accepts only the validated import diagnostic envelope', () => {
  expect(parseImportDiagnostic(import400(envelopeDiagnostic))).toEqual(diagnostic);
  expect(
    parseImportDiagnostic({
      response: { data: { diagnostic: { ...envelopeDiagnostic, errorCode: 'IMPORT_MISSING_COLUMNS' } } },
    }),
  ).toEqual({ requestId: REQUEST_ID, errorCode: 'IMPORT_MISSING_COLUMNS' });
  expect(parseImportDiagnostic(import400({ ...envelopeDiagnostic, requestId: 'not-a-uuid' }))).toBeNull();
  expect(
    parseImportDiagnostic(import400({ ...envelopeDiagnostic, requestId: '3f1a2b4c-5d6e-1f70-8a9b-0c1d2e3f4a5b' })),
  ).toBeNull();
  expect(parseImportDiagnostic(import400({ ...envelopeDiagnostic, errorCode: 'IMPORT_OTHER' }))).toBeNull();
  expect(parseImportDiagnostic(import400({ ...envelopeDiagnostic, stage: 'commerce-import-x' }))).toBeNull();
  expect(parseImportDiagnostic(import400({ ...envelopeDiagnostic, version: 2 }))).toBeNull();
  expect(parseImportDiagnostic(import400({ ...envelopeDiagnostic, target: 'commerce-sample' }))).toBeNull();
  expect(parseImportDiagnostic(import400({ ...envelopeDiagnostic, dataHealth: 'verified' }))).toBeNull();
  expect(parseImportDiagnostic(import400(null))).toBeNull();
  expect(parseImportDiagnostic(new Error('offline'))).toBeNull();
});

it('makes no call before an explicit click and posts only the requestId', async () => {
  mocks.post.mockResolvedValueOnce(helpOk('가져온 날짜 형식을 확인하세요.'));
  render(<ImportHelp diagnostic={diagnostic} onReselectFiles={vi.fn()} />);
  expect(mocks.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'AI로 오류 설명 보기' }));
  await screen.findByText('가져온 날짜 형식을 확인하세요.');
  expect(mocks.post).toHaveBeenCalledTimes(1);
  expect(mocks.post.mock.calls[0][0]).toBe('/commerce/import-help');
  expect(mocks.post.mock.calls[0][1]).toEqual({ requestId: REQUEST_ID });
  expect(mocks.post.mock.calls[0][2]).toMatchObject({ timeout: 120000, signal: expect.any(AbortSignal) });
  expect(screen.getByText('가능한 원인')).toBeTruthy();
  expect(screen.getByText('복구 상태: 확인되지 않음 (unverified)')).toBeTruthy();
});

it('renders the explanation as plain text without executing markup or URLs', async () => {
  mocks.post.mockResolvedValueOnce(helpOk('<b>row 42</b> & <a href="https://evil.test">링크</a>'));
  const onReselect = vi.fn();
  render(<ImportHelp diagnostic={diagnostic} onReselectFiles={onReselect} />);
  fireEvent.click(screen.getByRole('button', { name: 'AI로 오류 설명 보기' }));
  const node = await screen.findByText(/<b>row 42<\/b>/);
  expect(node.tagName).toBe('P');
  expect(document.querySelector('b')).toBeNull();
  expect(document.querySelector('a')).toBeNull();
  expect(onReselect).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '파일 다시 선택' }));
  expect(onReselect).toHaveBeenCalledTimes(1);
});

it('rejects a payload with an unknown action or health and keeps the opt-in available', async () => {
  mocks.post.mockResolvedValueOnce(helpOk('설명', ['open-url']));
  render(<ImportHelp diagnostic={diagnostic} onReselectFiles={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'AI로 오류 설명 보기' }));
  await screen.findByText(/AI 오류 설명을 가져오지 못했습니다/);
  expect(screen.queryByText('설명')).toBeNull();
  expect(screen.getByRole('button', { name: 'AI로 오류 설명 보기' })).toBeTruthy();
});

it('blocks duplicate clicks while pending and reuses the cached explanation', async () => {
  let resolveHelp: (value: unknown) => void = () => undefined;
  mocks.post.mockImplementationOnce(
    () =>
      new Promise(r => {
        resolveHelp = r;
      }),
  );
  render(<ImportHelp diagnostic={diagnostic} onReselectFiles={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /^(AI로 오류 설명 보기|오류 설명 준비 중…)$/ }));
  fireEvent.click(screen.getByRole('button', { name: /^(AI로 오류 설명 보기|오류 설명 준비 중…)$/ }));
  fireEvent.click(screen.getByRole('button', { name: /^(AI로 오류 설명 보기|오류 설명 준비 중…)$/ }));
  expect(mocks.post).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolveHelp(helpOk('한 번만 요청합니다.'));
  });
  await screen.findByText('한 번만 요청합니다.');
  fireEvent.click(screen.getByRole('button', { name: 'AI로 오류 설명 보기' }));
  await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
});

it('aborts pending help on unmount and ignores the late response', async () => {
  let resolveHelp: (value: unknown) => void = () => undefined;
  mocks.post.mockImplementationOnce(
    () =>
      new Promise(r => {
        resolveHelp = r;
      }),
  );
  const view = render(<ImportHelp diagnostic={diagnostic} onReselectFiles={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /^(AI로 오류 설명 보기|오류 설명 준비 중…)$/ }));
  const signal = mocks.post.mock.calls[0][2].signal as AbortSignal;
  view.unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => {
    resolveHelp(helpOk('도착하면 안 됩니다.'));
  });
  expect(screen.queryByText('도착하면 안 됩니다.')).toBeNull();
});

it.each([
  { code: 'ECONNABORTED', message: 'private timeout detail' },
  { response: { status: 503, data: { message: 'private unsupported model detail' } } },
])('keeps opt-in and manual recovery available after transport/provider failure %#', async error => {
  mocks.post.mockRejectedValueOnce(error).mockResolvedValueOnce(helpOk('두 번째 시도 성공'));
  render(<ImportHelp diagnostic={diagnostic} onReselectFiles={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'AI로 오류 설명 보기' }));
  await screen.findByText(/AI 오류 설명을 가져오지 못했습니다/);
  expect(screen.queryByText(/private.*detail/)).toBeNull();
  expect(screen.getByRole('button', { name: '파일 다시 선택' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'AI로 오류 설명 보기' }));
  await screen.findByText('두 번째 시도 성공');
  expect(mocks.post).toHaveBeenCalledTimes(2);
});

it('cancels help, returns focus and keeps an immediate retry pending when the old response arrives', async () => {
  let resolveOld: (value: unknown) => void = () => undefined;
  let resolveNew: (value: unknown) => void = () => undefined;

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
  render(<ImportHelp diagnostic={diagnostic} onReselectFiles={vi.fn()} />);

  fireEvent.click(await screen.findByRole('button', { name: 'AI로 오류 설명 보기' }));
  const signal = mocks.post.mock.calls[0][2].signal as AbortSignal;
  fireEvent.click(screen.getByRole('button', { name: '오류 설명 취소' }));
  expect(signal.aborted).toBe(true);
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'AI로 오류 설명 보기' }));
  expect(screen.getByText(/AI 오류 설명 요청을 취소했습니다/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'AI로 오류 설명 보기' }));
  await act(async () => {
    resolveOld(helpOk('오래된 설명'));
  });
  expect(screen.queryByText('오래된 설명')).toBeNull();
  expect(screen.getByRole('button', { name: '오류 설명 준비 중…' }).getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: '오류 설명 준비 중…' }));
  expect(mocks.post).toHaveBeenCalledTimes(2);
  await act(async () => {
    resolveNew(helpOk('새 설명'));
  });
  await screen.findByText('새 설명');
  expect(screen.queryByRole('button', { name: '오류 설명 취소' })).toBeNull();
});
