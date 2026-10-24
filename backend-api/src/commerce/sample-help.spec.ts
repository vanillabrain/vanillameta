import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { CommerceService } from './commerce.service';
jest.mock('../ai/ai.service', () => ({ AiService: class {} }));

describe('opt-in sample error help', () => {
  let service: CommerceService;
  let ai: any;
  let install: jest.SpyInstance;
  const oldProvider = process.env.AI_PROVIDER;
  beforeEach(() => {
    process.env.AI_PROVIDER = 'codex';
    ai = {
      callLlm: jest
        .fn()
        .mockResolvedValue(
          JSON.stringify({ explanation: '原因は未確認です。再試行してください。' }),
        ),
    };
    service = new CommerceService({} as any, {} as any, {} as any, ai);
    install = jest
      .spyOn(service as any, 'installSample')
      .mockRejectedValue(new Error('password=secret /private/customer/orders.csv token=hidden'));
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (oldProvider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = oldProvider;
  });
  const fail = async (owner = 7) => {
    try {
      await service.openSample(owner);
      throw new Error('expected failure');
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      return (error as ServiceUnavailableException).getResponse() as any;
    }
  };

  it('records only safe server context, without an automatic model call or raw exception', async () => {
    const response = await fail();
    expect(JSON.stringify(response)).not.toMatch(/password|private|token|customer/);
    expect(response.diagnostic).toMatchObject({
      errorCode: 'SAMPLE_UNAVAILABLE',
      stage: 'sample-install',
      version: 1,
      target: 'commerce-sample',
      dataHealth: 'unverified',
    });
    expect(ai.callLlm).not.toHaveBeenCalled();
  });

  it('sends static facts only and caches help without claiming or applying recovery', async () => {
    const { diagnostic } = await fail();
    const body = { requestId: diagnostic.requestId };
    const signal = new AbortController().signal;
    const answer = await service.sampleHelp(7, body, signal, 0);
    expect(answer.data).toMatchObject({
      requestId: body.requestId,
      dataHealth: 'unverified',
      actions: ['retry-sample', 'open-files'],
    });
    expect(ai.callLlm.mock.calls[0][2]).toBe(true);
    expect(ai.callLlm.mock.calls[0][3]).toBe(signal);
    expect(ai.callLlm.mock.calls[0][1]).not.toMatch(
      /requestId|ownerId|password|private|token|customer/,
    );
    expect(install).toHaveBeenCalledTimes(1);
    expect(await service.sampleHelp(7, body, undefined, 0)).toEqual(answer);
    expect(ai.callLlm).toHaveBeenCalledTimes(1);
  });

  it('rejects foreign, expired and injected context before invoking AI', async () => {
    const { diagnostic } = await fail();
    const body = { requestId: diagnostic.requestId };
    await expect(service.sampleHelp(8, body, undefined, 0)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(
      service.sampleHelp(7, { ...body, error: 'secret', target: 123 }, undefined, 0),
    ).rejects.toThrow('오류 도움 요청');
    await expect(
      service.sampleHelp(7, { requestId: '/private/path' }, undefined, 0),
    ).rejects.toThrow('오류 도움 요청');
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now + 600001);
    await expect(service.sampleHelp(7, body, undefined, 0)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(ai.callLlm).not.toHaveBeenCalled();
  });

  it('keeps manual retry usable when AI is unavailable and never uses the API fallback', async () => {
    const { diagnostic } = await fail();
    delete process.env.AI_PROVIDER;
    delete process.env.AI_API_KEY;
    await expect(
      service.sampleHelp(7, { requestId: diagnostic.requestId }, undefined, 0),
    ).rejects.toThrow('AI 도움을 사용할 수 없습니다.');
    expect(ai.callLlm).not.toHaveBeenCalled();
    install.mockResolvedValueOnce({ status: 'SUCCESS', data: { projectId: 42 } });
    expect((await service.openSample(7)).data.projectId).toBe(42);
    await expect(
      service.sampleHelp(7, { requestId: diagnostic.requestId }, undefined, 0),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks duplicate help and discards an old answer after a new sample attempt', async () => {
    const { diagnostic } = await fail();
    let resolve: (value: string) => void;
    ai.callLlm.mockImplementationOnce(
      () =>
        new Promise(r => {
          resolve = r;
        }),
    );
    const help = service.sampleHelp(7, { requestId: diagnostic.requestId }, undefined, 0);
    await expect(
      service.sampleHelp(7, { requestId: diagnostic.requestId }, undefined, 0),
    ).rejects.toThrow('준비하고 있습니다');
    const next = await fail();
    expect(next.diagnostic.requestId).not.toBe(diagnostic.requestId);
    resolve!(JSON.stringify({ explanation: 'obsolete answer' }));
    await expect(help).rejects.toBeInstanceOf(ConflictException);
    expect(ai.callLlm).toHaveBeenCalledTimes(1);
  });

  it.each([
    'not json',
    '{"explanation":""}',
    JSON.stringify({ explanation: 'x'.repeat(1001) }),
    '{"explanation":"ok","command":"delete"}',
  ])('fails safely for invalid output %s', async raw => {
    const { diagnostic } = await fail();
    ai.callLlm.mockResolvedValueOnce(raw);
    await expect(
      service.sampleHelp(7, { requestId: diagnostic.requestId }, undefined, 0),
    ).rejects.toThrow('AI 설명을 준비하지 못했습니다.');
    expect(install).toHaveBeenCalledTimes(1);
  });

  it('sanitizes provider failures and honours cancellation without caching an answer', async () => {
    const { diagnostic } = await fail();
    const body = { requestId: diagnostic.requestId };
    ai.callLlm.mockRejectedValueOnce(new Error('token=secret provider log /private/path'));
    await expect(service.sampleHelp(7, body, undefined, 0)).rejects.toThrow(
      'AI 설명을 준비하지 못했습니다.',
    );
    const controller = new AbortController();
    controller.abort();
    await expect(service.sampleHelp(7, body, controller.signal, 0)).rejects.toThrow(
      '중단됐습니다.',
    );
    expect(ai.callLlm).toHaveBeenCalledTimes(1);
    expect((await service.sampleHelp(7, body, undefined, 0)).data.explanation).toBeTruthy();
  });
});
