jest.mock('./ai.service', () => ({ AiService: class {} }));
import { AiDashboardService } from './ai-dashboard.service';

describe('UC-013 strict intent boundary', () => {
  const setup = (raw: string) => {
    const service = Object.create(AiDashboardService.prototype) as AiDashboardService;
    const callLlm = jest.fn().mockResolvedValue(raw);
    Object.assign(service, { ai: { callLlm } });
    return { service, callLlm };
  };
  it.each(['content', 'layout', 'clarify'])(
    'accepts only strict %s without source data',
    async intent => {
      const { service, callLlm } = setup(JSON.stringify({ intent }));
      await expect(service.classifyBlockIntent('소수 1자리')).resolves.toBe(intent);
      expect(JSON.parse(callLlm.mock.calls[0][1])).toEqual({ prompt: '소수 1자리' });
      expect(callLlm.mock.calls[0][2]).toBe(true);
    },
  );
  it.each(['null', '[]', '{}', '{"intent":"save"}', '{"intent":"layout","sql":"SELECT 1"}'])(
    'rejects %s',
    async raw => {
      await expect(setup(raw).service.classifyBlockIntent('아래로')).rejects.toThrow();
    },
  );
  it('stops before and after provider cancellation', async () => {
    const { service, callLlm } = setup('{"intent":"content"}');
    const before = new AbortController();
    before.abort();
    await expect(service.classifyBlockIntent('질문', before.signal)).rejects.toThrow(
      'LLM_REQUEST_ABORTED',
    );
    expect(callLlm).not.toHaveBeenCalled();
    const during = new AbortController();
    callLlm.mockImplementationOnce(async () => {
      during.abort();
      return '{"intent":"content"}';
    });
    await expect(service.classifyBlockIntent('질문', during.signal)).rejects.toThrow(
      'LLM_REQUEST_ABORTED',
    );
  });
});
