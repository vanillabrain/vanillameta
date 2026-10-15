jest.mock('../connection/connection.service', () => ({ ConnectionService: class {} }));
jest.mock('../ai/ai-dashboard.service', () => ({ AiDashboardService: class {} }));
jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
jest.mock('./bi.service', () => ({ BiService: class {} }));
import { ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { SemanticProposalService } from './semantic-proposal.service';
const profile = {
  sourceId: 7,
  supported: true,
  dataVersion: 'v1',
  preview: [{ secret: 'RAW' }],
  path: '/private/source',
  columns: [{ name: 'amount', type: 'DOUBLE', numeric: true, temporal: false }],
};
const proposal = () => ({
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
});
describe('semantic proposal service read boundaries', () => {
  let service: SemanticProposalService,
    bi: any,
    ai: any,
    repo: any,
    dashboards: any,
    connection: any;
  beforeEach(() => {
    bi = { profile: jest.fn().mockResolvedValue(profile) };
    ai = { callLlm: jest.fn().mockResolvedValue(JSON.stringify(proposal())) };
    repo = { find: jest.fn().mockResolvedValue([]), save: jest.fn(), delete: jest.fn() };
    dashboards = {
      preview: jest.fn().mockResolvedValue({ data: { results: ['preview'] } }),
      save: jest.fn(),
    };
    connection = { withDuckDBSnapshot: jest.fn((_id, fn) => fn()) };
    service = new SemanticProposalService(
      bi,
      { getRepository: () => repo } as any,
      ai,
      dashboards,
      connection,
    );
  });
  afterEach(() => {
    expect(repo.save).not.toHaveBeenCalled();
    expect(repo.delete).not.toHaveBeenCalled();
    expect(dashboards.save).not.toHaveBeenCalled();
  });
  it('only exposes schema and valid catalog to the provider, then revalidates', async () => {
    const result = await service.propose({ sourceId: 7, prompt: '합계 보여줘' }, 10);
    const context = JSON.parse(ai.callLlm.mock.calls[0][1]);
    expect(context).toEqual({
      sourceId: 7,
      sourceRevision: 'v1',
      columns: profile.columns,
      catalog: [],
      request: '합계 보여줘',
    });
    expect(JSON.stringify(context)).not.toMatch(/RAW|private/);
    expect(bi.profile).toHaveBeenCalledTimes(2);
    expect(result).toHaveProperty('plan.measures.0.action', 'create');
  });
  it('authorizes before provider calls', async () => {
    bi.profile.mockRejectedValue(new ForbiddenException());
    await expect(service.propose({ sourceId: 7, prompt: '합계' }, 10)).rejects.toThrow(
      ForbiddenException,
    );
    expect(ai.callLlm).not.toHaveBeenCalled();
  });
  it('rejects source changed while model was running', async () => {
    bi.profile
      .mockResolvedValueOnce(profile)
      .mockResolvedValueOnce({ ...profile, dataVersion: 'v2' });
    await expect(service.propose({ sourceId: 7, prompt: '합계' }, 10)).rejects.toThrow(
      ConflictException,
    );
  });
  it('rejects model switching to another owned source', async () => {
    ai.callLlm.mockResolvedValue(JSON.stringify({ ...proposal(), sourceId: 8 }));
    await expect(service.propose({ sourceId: 7, prompt: '합계' }, 10)).rejects.toThrow(
      BadRequestException,
    );
  });
  it('honors abort before and after the provider', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      service.propose({ sourceId: 7, prompt: '합계' }, 10, controller.signal),
    ).rejects.toThrow('LLM_REQUEST_ABORTED');
    expect(ai.callLlm).not.toHaveBeenCalled();
    const second = new AbortController();
    ai.callLlm.mockImplementation(async () => {
      second.abort();
      return JSON.stringify(proposal());
    });
    await expect(
      service.propose({ sourceId: 7, prompt: '합계' }, 10, second.signal),
    ).rejects.toThrow('LLM_REQUEST_ABORTED');
  });
  it('previews server SQL within source snapshot and includes numeric trends', async () => {
    const result = await service.preview({ proposal: proposal() }, 10);
    expect(connection.withDuckDBSnapshot).toHaveBeenCalledWith(7, expect.any(Function));
    expect(dashboards.preview).toHaveBeenCalledWith(
      { draft: result.draft, includeTrends: true },
      10,
    );
    expect(result.preview.results).toEqual(['preview']);
    expect(ai.callLlm).not.toHaveBeenCalled();
  });
  it('rejects foreign source preview before snapshot resolution', async () => {
    bi.profile.mockRejectedValue(new ForbiddenException());
    await expect(service.preview({ proposal: proposal() }, 10)).rejects.toThrow(ForbiddenException);
    expect(connection.withDuckDBSnapshot).not.toHaveBeenCalled();
  });
});
