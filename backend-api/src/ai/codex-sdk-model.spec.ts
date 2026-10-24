import { callCodingAgent } from './coding-agent';
import { codexSdkModel } from './codex-sdk-model';

jest.mock('./coding-agent', () => ({ CODEX_MODEL: 'gpt-6-luna', callCodingAgent: jest.fn() }));

describe('the Codex adapter behind the AI SDK', () => {
  const agent = callCodingAgent as jest.Mock;
  const prompt = [
    { role: 'system', content: 'schema' },
    { role: 'user', content: [{ type: 'text', text: 'question' }] },
  ] as any;
  beforeEach(() => agent.mockReset());

  it('hands the system and user text to the agent with the JSON mode and the abort signal', async () => {
    const controller = new AbortController();
    agent.mockResolvedValue('{"ok":true}');
    const result: any = await codexSdkModel(true).doGenerate({
      prompt,
      abortSignal: controller.signal,
    } as any);
    expect(agent).toHaveBeenCalledWith('schema', 'question', true, controller.signal);
    expect(result.content).toEqual([{ type: 'text', text: '{"ok":true}' }]);
    expect(result.finishReason.unified).toBe('stop');
    // The CLI reports no usage: the gateway estimates it.
    expect(result.usage.inputTokens.total).toBeUndefined();
    expect(result.usage.outputTokens.total).toBeUndefined();
  });

  it('passes the text mode through', async () => {
    agent.mockResolvedValue('SELECT 1');
    await codexSdkModel(false).doGenerate({ prompt } as any);
    expect(agent).toHaveBeenCalledWith('schema', 'question', false, undefined);
  });

  it('stops without a CLI call for a request that was already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      codexSdkModel().doGenerate({ prompt, abortSignal: controller.signal } as any),
    ).rejects.toThrow('LLM_REQUEST_ABORTED');
    expect(agent).not.toHaveBeenCalled();
  });

  it('discards an answer that arrives after the request was aborted', async () => {
    const controller = new AbortController();
    agent.mockImplementation(async () => {
      controller.abort();
      return 'late';
    });
    await expect(
      codexSdkModel().doGenerate({ prompt, abortSignal: controller.signal } as any),
    ).rejects.toThrow('LLM_REQUEST_ABORTED');
  });

  it('refuses tools, non-text content and streaming instead of guessing', async () => {
    await expect(
      codexSdkModel().doGenerate({ prompt, tools: [{ type: 'function' }] } as any),
    ).rejects.toThrow('LLM_CODEX_TOOLS_UNSUPPORTED');
    await expect(
      codexSdkModel().doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'file', data: 'x' }] }],
      } as any),
    ).rejects.toThrow('LLM_CODEX_CONTENT_UNSUPPORTED');
    await expect(codexSdkModel().doStream({} as any)).rejects.toThrow(
      'LLM_CODEX_STREAMING_UNSUPPORTED',
    );
    expect(agent).not.toHaveBeenCalled();
  });
});
