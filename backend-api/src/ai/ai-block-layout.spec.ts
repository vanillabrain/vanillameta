jest.mock('./ai.service', () => ({ AiService: class {} }));
import { AiDashboardService } from './ai-dashboard.service';

describe('UC-011 layout-only LLM contract', () => {
  const context = {
    selectedKey: 'a',
    mode: 'desktop' as const,
    blocks: [{ key: 'a', title: 'untrusted title', rect: { x: 0, y: 0, w: 6, h: 3 } }],
    prompt: '오른쪽 한 칸',
  };
  const setup = (raw: string) => {
    const service = Object.create(AiDashboardService.prototype) as AiDashboardService;
    const callLlm = jest.fn().mockResolvedValue(raw);
    Object.assign(service, { ai: { callLlm } });
    return { service, callLlm };
  };
  it('passes geometry only to real provider and returns strict coordinates', async () => {
    const { service, callLlm } = setup('{"x":1,"y":0,"w":6,"h":3}');
    await expect(service.proposeBlockLayout(context)).resolves.toEqual({ x: 1, y: 0, w: 6, h: 3 });
    const input = JSON.parse(callLlm.mock.calls[0][1]);
    expect(input).toEqual({ ...context, columns: 12 });
    expect(callLlm.mock.calls[0][2]).toBe(true);
  });
  it.each([
    'null',
    '[]',
    '{}',
    '{"unsupported":true}',
    '{"x":1,"y":0,"w":6,"h":3,"sql":"SELECT 1"}',
    '{"x":9,"y":0,"w":6,"h":3}',
    '{"x":0.5,"y":0,"w":6,"h":3}',
  ])('rejects unsafe or unsupported proposal %s', async raw => {
    await expect(setup(raw).service.proposeBlockLayout(context)).rejects.toThrow();
  });
  it('does not call provider after cancellation and rejects cancellation during response', async () => {
    const { service, callLlm } = setup('{"x":1,"y":0,"w":6,"h":3}');
    const abort = new AbortController();
    abort.abort();
    await expect(service.proposeBlockLayout(context, abort.signal)).rejects.toThrow(
      'LLM_REQUEST_ABORTED',
    );
    expect(callLlm).not.toHaveBeenCalled();
    const next = new AbortController();
    callLlm.mockImplementationOnce(async () => {
      next.abort();
      return '{}';
    });
    await expect(service.proposeBlockLayout(context, next.signal)).rejects.toThrow(
      'LLM_REQUEST_ABORTED',
    );
  });
});
