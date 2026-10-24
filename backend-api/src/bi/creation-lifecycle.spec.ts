jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
jest.mock('../ai/ai-dashboard.service', () => ({ AiDashboardService: class {} }));
jest.mock('../connection/connection.service', () => ({ ConnectionService: class {} }));
jest.mock('./bi.service', () => ({ BiService: class {} }));
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { SemanticProposalService } from './semantic-proposal.service';
import { compileSemanticProposal } from './semantic-proposal';
import { DataSource } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { SourceCatalogEntry } from './entities/source-catalog-entry.entity';
import { Metric } from '../metric/entities/metric.entity';
import { Database } from '../database/entities/database.entity';

const profile = {
  sourceId: 7,
  supported: true,
  dataVersion: 'v1',
  columns: [{ name: 'amount', numeric: true, temporal: false, type: 'DOUBLE' }],
};
const proposal = {
  schemaVersion: 1,
  sourceId: 7,
  sourceRevision: 'v1',
  title: '분석',
  measures: [
    {
      key: 'total',
      definition: {
        label: '합계',
        aggregation: 'SUM',
        column: 'amount',
        unit: '',
        decimalPlaces: 0,
        numberNotation: 'compact',
      },
    },
  ],
  dimensions: [],
  blocks: [{ key: 'total', measureKey: 'total', chart: 'number', title: '합계' }],
};
describe('UC023 creation lifecycle without writes', () => {
  let service: SemanticProposalService, bi: any, ai: any, dashboards: any;
  let db: DataSource;
  const body = () => ({
    proposal,
    previewDigest: compileSemanticProposal(proposal, profile, []).previewDigest,
    prompt: '현재 초안을 저장하고 게시 준비해 줘',
  });
  beforeEach(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [User, EnterpriseMembership, SourceCatalogEntry, Metric, Database],
    }).initialize();
    await db.manager.save(User, {
      id: 10,
      active: true,
      authVersion: 0,
      userId: 'lifecycle-fixture',
      email: 'lifecycle-fixture@example.invalid',
      password: 'fixture',
    });
    await db.manager.save(Database, {
      id: 7,
      ownerId: 10,
      name: 'Fixture',
      type: 'FILE',
      engine: 'duckdb',
      connectionConfig: '{}',
    });
    bi = {
      profile: jest.fn().mockResolvedValue(profile),
      assertSourceAction: jest.fn(async () => undefined),
    };
    ai = { callLlm: jest.fn().mockResolvedValue(JSON.stringify(proposal)) };
    dashboards = {
      assertAiCalls: jest.fn().mockResolvedValue(undefined),
      classifyBlockIntent: jest.fn().mockResolvedValue({
        intent: 'save',
        saveRequested: true,
        editPrompt: null,
        publicationRequested: true,
      }),
    };
    service = new SemanticProposalService(bi, db, ai, dashboards, {} as any);
  });
  afterEach(async () => {
    await db.destroy();
  });
  it('extracts explicit initial save/publication intent before the strict proposal compiler', async () => {
    ai.callLlm.mockResolvedValueOnce(
      JSON.stringify({ ...proposal, saveRequested: true, publicationRequested: true }),
    );
    const result = await service.propose(
      {
        sourceId: 7,
        prompt: '합계를 만들고 저장하고 게시 미리보기로 이어 줘. 링크 공개는 아직 하지 마.',
      },
      10,
      undefined,
      0,
    );
    expect(result).toMatchObject({ saveRequested: true, publicationRequested: true, proposal });
    expect(result).toHaveProperty('draft.widgets.0.sql', expect.stringContaining('SUM("amount")'));
  });
  it.each([
    { saveRequested: false },
    { saveRequested: 'true' },
    { publicationRequested: true },
    { saveRequested: true, publicationRequested: false },
    { saveRequested: true, publicationRequested: null },
  ])('rejects invalid optional execution flags %#', async flags => {
    ai.callLlm.mockResolvedValueOnce(JSON.stringify({ ...proposal, ...flags }));
    await expect(
      service.propose({ sourceId: 7, prompt: '질문' }, 10, undefined, 0),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('returns a bounded clarification rather than a fabricated source error or a save', async () => {
    ai.callLlm.mockResolvedValueOnce(
      JSON.stringify({ clarification: '전환율의 분자와 분모는 어떤 열인가요?' }),
    );
    await expect(
      service.propose({ sourceId: 7, prompt: '전환율을 보여줘' }, 10, undefined, 0),
    ).resolves.toEqual({
      clarification: '전환율의 분자와 분모는 어떤 열인가요?',
    });
  });
  it('continues save-only with the existing compiled proposal/digest and no generation call', async () => {
    const result = await (service as any).question(body(), 10, undefined, 0);
    expect(result).toMatchObject({
      proposal,
      previewDigest: body().previewDigest,
      saveRequested: true,
      publicationRequested: true,
    });
    expect(dashboards.classifyBlockIntent).toHaveBeenCalledWith(body().prompt, undefined, {
      userId: 10,
      epoch: 0,
      feature: 'semantic-question',
    });
    expect(ai.callLlm).not.toHaveBeenCalled();
  });
  it('denies a foreign source before intent classification', async () => {
    bi.profile.mockRejectedValueOnce(new ForbiddenException());
    await expect((service as any).question(body(), 99, undefined, 0)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(dashboards.classifyBlockIntent).not.toHaveBeenCalled();
  });
  it('blocks an old digest before any provider call', async () => {
    await expect(
      (service as any).question({ ...body(), previewDigest: 'f'.repeat(64) }, 10, undefined, 0),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(dashboards.classifyBlockIntent).not.toHaveBeenCalled();
  });
  it('revalidates the source after classification and never regenerates a changed snapshot', async () => {
    dashboards.classifyBlockIntent.mockImplementationOnce(async () => {
      bi.profile.mockResolvedValue({ ...profile, dataVersion: 'v2' });
      return { intent: 'save', saveRequested: true, editPrompt: null };
    });
    await expect((service as any).question(body(), 10, undefined, 0)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(ai.callLlm).not.toHaveBeenCalled();
  });
  it('asks instead of saving unsupported edit+save or ambiguous/negative requests', async () => {
    for (const plan of [
      { intent: 'content', saveRequested: true, editPrompt: '제목 변경' },
      { intent: 'clarify', saveRequested: false, editPrompt: null },
    ]) {
      dashboards.classifyBlockIntent.mockResolvedValueOnce(plan);
      const result = await (service as any).question(body(), 10, undefined, 0);
      expect(result.clarification).toEqual(expect.any(String));
      expect(result.saveRequested).toBeUndefined();
    }
    expect(ai.callLlm).not.toHaveBeenCalled();
  });
  it('keeps ordinary new-preview questions on the existing proposal route without saving', async () => {
    dashboards.classifyBlockIntent.mockResolvedValueOnce({
      intent: 'content',
      saveRequested: false,
      editPrompt: '합계',
    });
    expect(
      await (service as any).question(
        { ...body(), prompt: '합계만 다시 보여줘' },
        10,
        undefined,
        0,
      ),
    ).toMatchObject({ proposal });
    expect(ai.callLlm).toHaveBeenCalledTimes(1);
  });
  it('honors cancellation before classification and after a late classification result', async () => {
    const abort = new AbortController();
    abort.abort();
    await expect((service as any).question(body(), 10, abort.signal, 0)).rejects.toThrow(
      'LLM_REQUEST_ABORTED',
    );
    expect(dashboards.classifyBlockIntent).not.toHaveBeenCalled();
    const during = new AbortController();
    dashboards.classifyBlockIntent.mockImplementationOnce(async () => {
      during.abort();
      return { intent: 'save', saveRequested: true, editPrompt: null };
    });
    await expect((service as any).question(body(), 10, during.signal, 0)).rejects.toThrow(
      'LLM_REQUEST_ABORTED',
    );
    expect(ai.callLlm).not.toHaveBeenCalled();
  });
});
