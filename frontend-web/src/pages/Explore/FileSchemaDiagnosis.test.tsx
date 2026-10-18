import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import FileSchemaDiagnosis from './FileSchemaDiagnosis';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
const rev = 'a'.repeat(64),
  next = 'b'.repeat(64),
  job = '11111111-1111-4111-8111-111111111111';
const wrap = (data: unknown) => ({ data: { status: 'SUCCESS', data } });
const answer = {
  sourceId: 1,
  requestId: job,
  targetSourceId: 2,
  sourceRevision: rev,
  dependencyRevision: 'c'.repeat(64),
  targetRevision: next,
  explanation: '원가 열이 바뀌었습니다. 기존 성공본을 보존합니다.',
  mappings: [{ from: 'cost', to: 'actual_cost' }],
  missingColumns: [],
  repaired: false,
  observedChanges: [{ kind: 'removed', column: 'cost', previousType: 'DOUBLE' }],
};
const ready = async () => {
  render(<FileSchemaDiagnosis sourceId={1} requestId={job} sourceRevision={rev} dependencyRevision={'c'.repeat(64)} />);
  expect(api.get).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '대체 소스 목록 확인' }));
  await screen.findByText('새 원가 파일');
  fireEvent.change(screen.getByLabelText('진단할 대체 데이터'), { target: { value: '2' } });
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '원인과 열 연결 제안' }) as HTMLButtonElement).disabled).toBe(false),
  );
};
beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation(url =>
    Promise.resolve(
      wrap(
        url === '/bi/sources'
          ? [{ id: 2, name: '새 원가 파일', engine: 'duckdb' }]
          : { sourceId: 2, dataVersion: next, supported: true },
      ),
    ),
  );
  api.post.mockResolvedValue(wrap(answer));
});
afterEach(cleanup);
it('requires explicit reads and sends only question/source revisions to the diagnostic endpoint', async () => {
  await ready();
  fireEvent.click(screen.getByRole('button', { name: '원인과 열 연결 제안' }));
  await screen.findByText(answer.explanation);
  expect(api.post.mock.calls[0][0]).toBe(`/bi/sources/1/file-refreshes/${job}/impact/diagnosis`);
  expect(Object.keys(api.post.mock.calls[0][1]).sort()).toEqual(
    ['question', 'targetSourceId', 'expectedSourceRevision', 'expectedTargetRevision', 'expectedDependencyRevision'].sort(),
  );
  expect(screen.getByText(/아직 복구·저장하지 않았습니다/)).not.toBeNull();
  expect(api.post).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText('오류에 관해 질문하기'), { target: { value: '다른 질문' } });
  expect(screen.queryByText(answer.explanation)).toBeNull();
});
it('preserves input after model failure and rejects a mismatched target result', async () => {
  await ready();
  api.post
    .mockRejectedValueOnce({ response: { status: 503 } })
    .mockResolvedValueOnce(wrap({ ...answer, targetSourceId: 3 }));
  const input = (screen.getByLabelText('오류에 관해 질문하기') as HTMLTextAreaElement).value;
  fireEvent.click(screen.getByRole('button', { name: '원인과 열 연결 제안' }));
  await screen.findByRole('alert');
  expect((screen.getByLabelText('오류에 관해 질문하기') as HTMLTextAreaElement).value).toBe(input);
  fireEvent.click(screen.getByRole('button', { name: '원인과 열 연결 제안' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  expect(screen.queryByText(answer.explanation)).toBeNull();
});
it('cancels the diagnostic and ignores its late response', async () => {
  await ready();
  let resolve: (v: unknown) => void;
  api.post.mockReturnValueOnce(
    new Promise(r => {
      resolve = r;
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: '원인과 열 연결 제안' }));
  fireEvent.click(screen.getByRole('button', { name: '진단 취소' }));
  await act(async () => resolve(wrap(answer)));
  expect(api.post.mock.calls[0][2].signal.aborted).toBe(true);
  expect(screen.queryByText(answer.explanation)).toBeNull();
});
