jest.mock('./ai.service', () => ({ AiService: class {} }));
import { BadRequestException } from '@nestjs/common';
import { AiDashboardService } from './ai-dashboard.service';

describe('UC-014 strict intent and save boundary', () => {
  const setup = (raw: string) => {
    const service = Object.create(AiDashboardService.prototype) as AiDashboardService;
    const callLlm = jest.fn().mockResolvedValue(raw);
    Object.assign(service, { ai: { callLlm } });
    return { service, callLlm };
  };
  const plan = (intent: string, saveRequested: boolean, editPrompt: string | null) =>
    JSON.stringify({ intent, saveRequested, editPrompt });

  it.each([
    [
      'content without save',
      plan('content', false, '소수 1자리로 바꿔 줘'),
      { intent: 'content', saveRequested: false, editPrompt: '소수 1자리로 바꿔 줘' },
    ],
    [
      'layout without save',
      plan('layout', false, '아래로 한 칸 옮겨 줘'),
      { intent: 'layout', saveRequested: false, editPrompt: '아래로 한 칸 옮겨 줘' },
    ],
    [
      'content with an explicit save',
      plan('content', true, '제목을 바꿔 줘'),
      { intent: 'content', saveRequested: true, editPrompt: '제목을 바꿔 줘' },
    ],
    [
      'layout with an explicit save',
      plan('layout', true, '아래로 한 칸 옮겨 줘'),
      { intent: 'layout', saveRequested: true, editPrompt: '아래로 한 칸 옮겨 줘' },
    ],
    [
      'save only',
      plan('save', true, null),
      { intent: 'save', saveRequested: true, editPrompt: null },
    ],
    [
      'clarify',
      plan('clarify', false, null),
      { intent: 'clarify', saveRequested: false, editPrompt: null },
    ],
    [
      'a maximum length editPrompt',
      plan('content', false, 'a'.repeat(2000)),
      { intent: 'content', saveRequested: false, editPrompt: 'a'.repeat(2000) },
    ],
  ])(
    'accepts strict %s with the exact 3 keys and a prompt-only input',
    async (_name, raw, expected) => {
      const { service, callLlm } = setup(raw);
      await expect(service.classifyBlockIntent('소수 1자리')).resolves.toEqual(expected);
      expect(JSON.parse(callLlm.mock.calls[0][1])).toEqual({ prompt: '소수 1자리' });
      expect(callLlm).toHaveBeenCalledTimes(1);
      expect(callLlm.mock.calls[0][2]).toBe(true);
      const system = callLlm.mock.calls[0][0] as string;
      expect(system).toContain('saveRequested');
      expect(system).toContain('editPrompt');
      expect(system).toMatch(/저장하지 마/);
    },
  );

  it.each([
    ['null', 'null'],
    ['an empty array', '[]'],
    ['an empty object', '{}'],
    ['the previous single-key shape', '{"intent":"content"}'],
    ['an unknown intent', plan('publish', true, null)],
    [
      'an extra key',
      '{"intent":"layout","saveRequested":false,"editPrompt":"아래로","sql":"SELECT 1"}',
    ],
    ['a missing key', '{"intent":"save","saveRequested":true}'],
    [
      'a non-boolean saveRequested',
      '{"intent":"content","saveRequested":"true","editPrompt":"제목 변경"}',
    ],
    ['an empty editPrompt', plan('content', false, '')],
    ['a blank editPrompt', plan('layout', false, '   ')],
    ['an oversized editPrompt', plan('content', false, 'a'.repeat(2001))],
    ['a null editPrompt for content', plan('content', false, null)],
    ['a null editPrompt for layout', plan('layout', true, null)],
    ['save without saveRequested', plan('save', false, null)],
    ['save carrying an editPrompt', plan('save', true, '저장해 줘')],
    ['clarify requesting a save', plan('clarify', true, null)],
    ['clarify carrying an editPrompt', plan('clarify', false, '내용 변경')],
  ])('rejects %s without falling back to another model', async (_name, raw) => {
    const { service, callLlm } = setup(raw);
    await expect(service.classifyBlockIntent('아래로')).rejects.toBeInstanceOf(BadRequestException);
    expect(callLlm).toHaveBeenCalledTimes(1);
  });

  it('stops before and after provider cancellation', async () => {
    const { service, callLlm } = setup(plan('content', false, '제목 변경'));
    const before = new AbortController();
    before.abort();
    await expect(service.classifyBlockIntent('질문', before.signal)).rejects.toThrow(
      'LLM_REQUEST_ABORTED',
    );
    expect(callLlm).not.toHaveBeenCalled();
    const during = new AbortController();
    callLlm.mockImplementationOnce(async () => {
      during.abort();
      return plan('content', false, '제목 변경');
    });
    await expect(service.classifyBlockIntent('질문', during.signal)).rejects.toThrow(
      'LLM_REQUEST_ABORTED',
    );
  });
});
