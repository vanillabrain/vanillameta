jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { EventEmitter } from 'events';
import { StudioExecutionController } from './studio-execution.controller';
describe('T7 execution POST disconnect boundary', () => {
  it.each(['aborted', 'close'])('forwards %s as AbortSignal and removes listeners', async event => {
    const req = Object.assign(new EventEmitter(), {
      user: { accessKeyData: { id: 7 } },
      aborted: false,
    });
    const res = Object.assign(new EventEmitter(), { writableFinished: false });
    let signal: AbortSignal;
    const service = {
      create: jest.fn(async (_body, _actor, s: AbortSignal) => {
        signal = s;
        return new Promise(resolve =>
          s.addEventListener('abort', () => resolve({ status: 'cancelled' }), { once: true }),
        );
      }),
    };
    const controller = new StudioExecutionController(service as any);
    const pending = controller.create({}, req, res);
    expect(signal.aborted).toBe(false);
    (event === 'close' ? res : req).emit(event);
    expect(await pending).toEqual({ status: 'cancelled' });
    expect(signal.aborted).toBe(true);
    expect(req.listenerCount('aborted')).toBe(0);
    expect(res.listenerCount('close')).toBe(0);
  });
  it('links retry disconnect but does not cancel a normally finished response', async () => {
    const req = Object.assign(new EventEmitter(), {
      user: { accessKeyData: { id: 7 } },
      aborted: false,
    });
    const res = Object.assign(new EventEmitter(), { writableFinished: true });
    const service = {
      retry: jest.fn(async (_id, _body, _actor, signal) => {
        res.emit('close');
        expect(signal.aborted).toBe(false);
        return { status: 'succeeded' };
      }),
    };
    const controller = new StudioExecutionController(service as any);
    expect(await controller.retry('id', {}, req, res)).toEqual({ status: 'succeeded' });
    expect(service.retry).toHaveBeenCalledWith('id', {}, 7, expect.any(AbortSignal));
  });
  it.each([9, 4])(
    'forwards the exact request epoch %s for explicit remix confirmation',
    async epoch => {
      const remix = jest.fn().mockResolvedValue({ status: 'succeeded' });
      const controller = new StudioExecutionController({ remix } as any);
      const body = { requestId: 'confirm' };
      await controller.remix('run-id', body, {
        user: { accessKeyData: { id: 7, authVersion: epoch } },
      });
      expect(remix).toHaveBeenCalledWith('run-id', body, 7, epoch);
    },
  );
});
