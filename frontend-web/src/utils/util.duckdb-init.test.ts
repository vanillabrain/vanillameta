import { afterEach, describe, expect, it, vi } from 'vitest';
import { initializeDuckDbWorker } from './util.duckdb-init';

afterEach(() => vi.useRealTimers());

describe('DuckDB worker initialization failure boundary', () => {
  const worker = () => {
    const value = new EventTarget();
    vi.spyOn(value, 'removeEventListener');
    return value;
  };

  it('finishes successful initialization and releases the timeout and listeners', async () => {
    vi.useFakeTimers();
    const value = worker();
    await initializeDuckDbWorker(value, async () => undefined);
    expect(vi.getTimerCount()).toBe(0);
    expect(value.removeEventListener).toHaveBeenCalledTimes(2);
  });

  it('propagates a rejected instantiate call and removes failure listeners', async () => {
    const value = worker();
    await expect(
      initializeDuckDbWorker(value, async () => {
        throw new Error('download failed');
      }),
    ).rejects.toThrow('download failed');
    expect(value.removeEventListener).toHaveBeenCalledTimes(2);
  });

  it('rejects a worker error even when instantiate never responds', async () => {
    const value = worker();
    const result = initializeDuckDbWorker(value, () => new Promise(() => undefined));
    const assertion = expect(result).rejects.toThrow('worker initialization failed');
    value.dispatchEvent(new Event('error'));
    await assertion;
    expect(value.removeEventListener).toHaveBeenCalledTimes(2);
  });

  it('bounds a silent download failure and allows a subsequent fresh attempt', async () => {
    vi.useFakeTimers();
    const value = worker();
    const result = initializeDuckDbWorker(value, () => new Promise(() => undefined), 100);
    const assertion = expect(result).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
    await expect(initializeDuckDbWorker(worker(), async () => undefined)).resolves.toBeUndefined();
  });
});
