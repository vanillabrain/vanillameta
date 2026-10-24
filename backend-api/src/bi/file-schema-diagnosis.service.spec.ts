jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { FileSchemaDiagnosisService } from './file-schema-diagnosis.service';

const rev = 'a'.repeat(64),
  next = 'b'.repeat(64);
const original: any = {
  supported: true,
  dataVersion: rev,
  columns: [
    { name: 'day', type: 'TIMESTAMP' },
    { name: 'cost', type: 'DOUBLE' },
  ],
};
const target: any = {
  supported: true,
  dataVersion: next,
  columns: [
    { name: 'day', type: 'TIMESTAMP' },
    { name: 'actual_cost', type: 'DOUBLE' },
  ],
};
const impact = {
  sourceRevision: rev,
  dependencyRevision: 'c'.repeat(64),
  observedChanges: [{ kind: 'removed', column: 'cost', previousType: 'DOUBLE' }],
  truncated: false,
  unreadable: 0,
  metrics: [{ columns: ['day', 'cost'], affectedColumns: ['cost'], status: 'affected' }],
  dashboards: [],
};
const body = {
  targetSourceId: 2,
  expectedDependencyRevision: 'c'.repeat(64),
  expectedSourceRevision: rev,
  expectedTargetRevision: next,
  question: '원가 열 오류를 설명하고 연결을 제안해 줘',
};
const answer = () => ({
  explanation:
    '원가 열 이름이 달라 거절했습니다. 기존 성공본은 보존하며 의미·단위를 확인하고 전체 미리보기 뒤 복사본을 저장하세요.',
  mappings: [
    { from: 'day', to: 'day' },
    { from: 'cost', to: 'actual_cost' },
  ],
  missingColumns: [],
});
function setup(response = answer()) {
  const impacts = { inspect: jest.fn().mockResolvedValue(impact) };
  const bi = {
    profile: jest.fn().mockImplementation(id => Promise.resolve(id === 1 ? original : target)),
  };
  const ai = { callLlm: jest.fn().mockResolvedValue(JSON.stringify(response)) };
  return {
    service: new FileSchemaDiagnosisService(impacts as any, bi as any, ai as any),
    impacts,
    bi,
    ai,
  };
}
const before = process.env.AI_PROVIDER;
beforeEach(() => {
  process.env.AI_PROVIDER = 'codex';
});
afterAll(() => {
  if (before === undefined) delete process.env.AI_PROVIDER;
  else process.env.AI_PROVIDER = before;
});
it('projects only column metadata and returns advice without writing or claiming repair', async () => {
  const { service, ai } = setup();
  const result = await service.diagnose(1, 'job', body, 7, undefined, 0);
  expect(result).toMatchObject({
    sourceId: 1,
    targetSourceId: 2,
    repaired: false,
    mappings: answer().mappings,
  });
  const context = JSON.parse(ai.callLlm.mock.calls[0][1]);
  expect(Object.keys(context).sort()).toEqual(
    [
      'affectedColumns',
      'error',
      'observedChanges',
      'originalColumns',
      'question',
      'requiredColumns',
      'targetColumns',
    ].sort(),
  );
  expect(JSON.stringify(context)).not.toMatch(/preview|filename|connectionConfig|sourceId|sql/);
});
it.each([
  { ...answer(), mappings: [{ from: 'day', to: 'day' }] },
  { ...answer(), mappings: [...answer().mappings, { from: 'cost', to: 'actual_cost' }] },
  {
    ...answer(),
    mappings: [
      { from: 'day', to: 'day' },
      { from: 'cost', to: 'invented' },
    ],
  },
  { ...answer(), sql: 'SELECT 1' },
  { ...answer(), missingColumns: ['cost'] },
])('rejects missing coverage/duplicate/invented/executable proposal %#', async response => {
  const { service } = setup(response);
  await expect(service.diagnose(1, 'job', body, 7, undefined, 0)).rejects.toMatchObject({
    status: 400,
  });
});
it('keeps unresolved columns explicit instead of dropping their blocks', async () => {
  const { service } = setup({
    ...answer(),
    mappings: [{ from: 'day', to: 'day' }],
    missingColumns: ['cost'],
  });
  expect((await service.diagnose(1, 'job', body, 7, undefined, 0)).missingColumns).toEqual([
    'cost',
  ]);
});
it('rejects stale input before model and a target revision change after model', async () => {
  const a = setup();
  await expect(
    a.service.diagnose(1, 'job', { ...body, expectedTargetRevision: rev }, 7, undefined, 0),
  ).rejects.toMatchObject({ status: 409 });
  expect(a.ai.callLlm).not.toHaveBeenCalled();
  const b = setup();
  b.bi.profile
    .mockResolvedValueOnce(original)
    .mockResolvedValueOnce(target)
    .mockResolvedValueOnce({ ...target, dataVersion: rev });
  await expect(b.service.diagnose(1, 'job', body, 7, undefined, 0)).rejects.toMatchObject({
    status: 409,
  });
});
it('rejects inaccessible sources and incomplete dependencies without calling model', async () => {
  const a = setup();
  a.bi.profile.mockRejectedValueOnce({ status: 403 });
  await expect(a.service.diagnose(1, 'job', body, 7, undefined, 0)).rejects.toMatchObject({
    status: 403,
  });
  expect(a.ai.callLlm).not.toHaveBeenCalled();
  const b = setup();
  b.impacts.inspect.mockResolvedValueOnce({ ...impact, truncated: true });
  await expect(b.service.diagnose(1, 'job', body, 7, undefined, 0)).rejects.toMatchObject({
    status: 400,
  });
  expect(b.ai.callLlm).not.toHaveBeenCalled();
});
it('does not accept different types or protected lookup amounts', async () => {
  for (const column of [
    { name: 'actual_cost', type: 'VARCHAR' },
    { name: 'actual_cost', type: 'DOUBLE', nonAdditive: true },
  ]) {
    const a = setup();
    a.bi.profile.mockImplementation(id =>
      Promise.resolve(id === 1 ? original : { ...target, columns: [target.columns[0], column] }),
    );
    await expect(a.service.diagnose(1, 'job', body, 7, undefined, 0)).rejects.toMatchObject({
      status: 400,
    });
  }
});
it('returns a static provider failure and never falls back to another model', async () => {
  const a = setup();
  a.ai.callLlm.mockRejectedValueOnce(new Error('/private/secret'));
  await expect(a.service.diagnose(1, 'job', body, 7, undefined, 0)).rejects.toMatchObject({
    status: 503,
  });
  expect(a.ai.callLlm).toHaveBeenCalledTimes(1);
  process.env.AI_PROVIDER = 'api';
  const b = setup();
  await expect(b.service.diagnose(1, 'job', body, 7, undefined, 0)).rejects.toMatchObject({
    status: 503,
  });
  expect(b.ai.callLlm).not.toHaveBeenCalled();
});

it('rejects changed dependency membership at the same file revisions before and after model', async () => {
  const a = setup();
  a.impacts.inspect.mockResolvedValueOnce({ ...impact, dependencyRevision: 'd'.repeat(64) });
  await expect(a.service.diagnose(1, 'job', body, 7, undefined, 0)).rejects.toMatchObject({
    status: 409,
  });
  expect(a.ai.callLlm).not.toHaveBeenCalled();
  const b = setup();
  b.impacts.inspect.mockResolvedValueOnce(impact).mockResolvedValueOnce({
    ...impact,
    dependencyRevision: 'd'.repeat(64),
    metrics: [...impact.metrics, { columns: ['revenue'], affectedColumns: [], status: 'review' }],
  });
  await expect(b.service.diagnose(1, 'job', body, 7, undefined, 0)).rejects.toMatchObject({
    status: 409,
  });
});
