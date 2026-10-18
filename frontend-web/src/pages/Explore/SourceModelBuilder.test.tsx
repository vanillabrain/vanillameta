import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SourceModelBuilder from './SourceModelBuilder';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
vi.mock('@/helpers/authHelper', () => ({ getToken: () => 'task-token' }));
vi.mock('@/helpers/editorDraftStorage', () => ({ editorDraftKey: async () => 'owner:fact' }));
const wrap = (data: any) => ({ data: { status: 'SUCCESS', data } });
const column = (name: string, type = 'VARCHAR') => ({ name, type, numeric: type === 'DOUBLE' });
const fact = {
  sourceId: 1,
  dataVersion: 'a'.repeat(64),
  name: '지출',
  supported: true,
  columns: [column('provider_id'), column('amount', 'DOUBLE'), column('beneficiaries', 'DOUBLE')],
};
const lookup = {
  sourceId: 2,
  dataVersion: 'b'.repeat(64),
  name: '사전',
  supported: true,
  columns: [column('provider_id'), column('name')],
};
const quality = {
  factRows: 4,
  lookupRows: 3,
  duplicateLookupKeys: 0,
  invalidLookupKeys: 0,
  unmatchedFactRows: 1,
  unusedLookupRows: 1,
  outputRows: 4,
  ready: true,
};
const spec = {
  factSourceId: 1,
  lookupSourceId: 2,
  factRevision: fact.dataVersion,
  lookupRevision: lookup.dataVersion,
  definition: {
    factKey: 'provider_id',
    lookupKey: 'provider_id',
    attributes: [{ column: 'name', alias: 'lookup_name' }],
    nonAdditiveColumns: [],
  },
};
const preview = {
  spec,
  quality,
  preview: [
    { provider_id: 'P1', amount: 100, lookup_name: '서울' },
    { provider_id: 'P9', amount: 50, lookup_name: null },
  ],
  previewDigest: 'c'.repeat(64),
};
const mount = () =>
  render(
    <MemoryRouter>
      <SourceModelBuilder
        profile={fact}
        sources={[
          { id: 2, name: '사전', engine: 'duckdb' },
          { id: 4, name: '다른 사전', engine: 'duckdb' },
        ]}
      />
    </MemoryRouter>,
  );
const prepare = async () => {
  fireEvent.click(screen.getByText('자료 연결 · 키와 품질 확인'));
  await waitFor(() => expect((screen.getByLabelText('현재 데이터 연결 키') as HTMLSelectElement).disabled).toBe(false));
  fireEvent.change(screen.getByLabelText('현재 데이터 연결 키'), { target: { value: 'provider_id' } });
  fireEvent.change(screen.getByLabelText('연결할 사전 데이터'), { target: { value: '2' } });
  await screen.findByLabelText('사전의 유일 키');
  fireEvent.change(screen.getByLabelText('사전의 유일 키'), { target: { value: 'provider_id' } });
  fireEvent.click(screen.getByRole('checkbox', { name: '추가 속성: name' }));
  fireEvent.click(screen.getByRole('button', { name: '연결 품질 미리보기' }));
  await screen.findByRole('region', { name: '연결 품질 결과' });
};
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  api.get.mockResolvedValue(wrap(lookup));
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.restoreAllMocks();
});
it('shows unmatched quality before explicit consent, freezes one save, then offers the created source only', async () => {
  api.post.mockResolvedValueOnce(wrap(preview)).mockResolvedValueOnce(wrap({ id: 3, name: '지출 · 연결' }));
  mount();
  await prepare();
  expect(api.post.mock.calls[0]).toEqual(['/bi/source-models/preview', spec]);
  expect((screen.getByRole('button', { name: '비공개 연결 소스 저장' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox', { name: '미매칭 행을 유지하는 데 동의' }));
  fireEvent.click(screen.getByRole('button', { name: '비공개 연결 소스 저장' }));
  await screen.findByText(/비공개 연결 소스 #3 저장 완료/);
  expect(api.post.mock.calls[1][1]).toMatchObject({ spec, keepUnmatched: true, previewDigest: preview.previewDigest });
  expect(screen.queryByRole('button', { name: '비공개 연결 소스 저장' })).toBeNull();
  expect(screen.getByRole('link', { name: 'AI로 대시보드 만들기' }).getAttribute('href')).toBe('/studio/new?sourceId=3');
  expect(sessionStorage.getItem('owner:fact:source-model')).toBeNull();
});
it('keeps a duplicate-key failure read-only instead of offering a save', async () => {
  api.post.mockResolvedValueOnce(
    wrap({ ...preview, quality: { ...quality, ready: false, duplicateLookupKeys: 1, outputRows: null }, preview: [] }),
  );
  mount();
  await prepare();
  await screen.findByText('사전 키를 먼저 수정해 주세요');
  expect(screen.queryByRole('button', { name: '비공개 연결 소스 저장' })).toBeNull();
  expect(api.post).toHaveBeenCalledTimes(1);
});
it('restores an uncertain save after reload and sends exactly the frozen request only on explicit confirmation', async () => {
  api.post.mockResolvedValueOnce(wrap(preview)).mockRejectedValueOnce({ response: { status: 503 } });
  const view = mount();
  await prepare();
  fireEvent.click(screen.getByRole('checkbox', { name: '미매칭 행을 유지하는 데 동의' }));
  fireEvent.click(screen.getByRole('button', { name: '비공개 연결 소스 저장' }));
  await screen.findByRole('button', { name: '같은 연결 저장 요청 확인' });
  const frozen = api.post.mock.calls[1][1];
  view.unmount();
  mount();
  await screen.findByRole('button', { name: '같은 연결 저장 요청 확인' });
  expect(api.post).toHaveBeenCalledTimes(2);
  api.post.mockResolvedValueOnce(wrap({ id: 3, name: '지출 · 연결', replayed: true }));
  fireEvent.click(screen.getByRole('button', { name: '같은 연결 저장 요청 확인' }));
  await screen.findByText(/비공개 연결 소스 #3 저장 완료/);
  expect(api.post.mock.calls[2][1]).toEqual(frozen);
});
it('does not send a save when its exact confirmation request cannot be preserved', async () => {
  api.post.mockResolvedValueOnce(wrap(preview));
  mount();
  await prepare();
  fireEvent.click(screen.getByRole('checkbox', { name: '미매칭 행을 유지하는 데 동의' }));
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota');
  });
  fireEvent.click(screen.getByRole('button', { name: '비공개 연결 소스 저장' }));
  await screen.findByText(/보관하지 못해 전송하지 않았습니다/);
  expect(api.post).toHaveBeenCalledTimes(1);
});
it('invalidates confirmed quality on input changes and explicitly carries nonadditive fields', async () => {
  api.post.mockResolvedValueOnce(wrap(preview));
  mount();
  await prepare();
  fireEvent.click(screen.getByText('집계된 고유값 안내 · 선택 사항'));
  fireEvent.click(screen.getByRole('checkbox', { name: '비가산: beneficiaries' }));
  expect(screen.queryByRole('region', { name: '연결 품질 결과' })).toBeNull();
  api.post.mockResolvedValueOnce(wrap(preview));
  fireEvent.click(screen.getByRole('button', { name: '연결 품질 미리보기' }));
  await screen.findByRole('region', { name: '연결 품질 결과' });
  expect(api.post.mock.calls[1][1].definition.nonAdditiveColumns).toEqual(['beneficiaries']);
});
