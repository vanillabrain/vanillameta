jest.mock('./ai.service', () => ({ AiService: class {} }));
import { EventEmitter } from 'events';
import { AiController } from './ai.controller';

it.each(['dashboardAssistant', 'dashboardDraft'])(
  'cancels %s on an unfinished response disconnect and removes listeners',
  async method => {
    const req: any = Object.assign(new EventEmitter(), {
      user: { accessKeyData: { id: 7 } },
      aborted: false,
    });
    const res: any = Object.assign(new EventEmitter(), { writableFinished: false });
    let finish: (value: any) => void;
    let signal: AbortSignal;
    const run = jest.fn((_body, _user, input) => {
      signal = input;
      return new Promise(resolve => {
        finish = resolve;
      });
    });
    const controller = new AiController({} as any, { assistant: run, generate: run } as any);
    const pending = controller[method]({ prompt: 'question' }, req, res);
    req.emit('close'); // A consumed request body is not a disconnected response.
    expect(signal.aborted).toBe(false);
    res.emit('close');
    expect(signal.aborted).toBe(true);
    finish({ status: 'ERROR' });
    await pending;
    expect(req.listenerCount('aborted')).toBe(0);
    expect(res.listenerCount('close')).toBe(0);
  },
);
it('does not cancel a successfully finished response', async () => {
  const req: any = Object.assign(new EventEmitter(), { user: { accessKeyData: { id: 7 } } });
  const res: any = Object.assign(new EventEmitter(), { writableFinished: true });
  let signal: AbortSignal;
  const controller = new AiController(
    {} as any,
    {
      assistant: async (_body, _user, input) => {
        signal = input;
        res.emit('close');
        return { status: 'SUCCESS' };
      },
    } as any,
  );
  expect(await controller.dashboardAssistant({}, req, res)).toEqual({ status: 'SUCCESS' });
  expect(signal.aborted).toBe(false);
  expect(res.listenerCount('close')).toBe(0);
});
