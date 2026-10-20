/** DuckDB workers may stop responding when the WASM download fails. */
export async function initializeDuckDbWorker(
  worker: Pick<Worker, 'addEventListener' | 'removeEventListener'>,
  initialize: () => Promise<void>,
  timeoutMs = 15000,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout>;
  let fail: EventListener;
  const failed = new Promise<never>((_resolve, reject) => {
    fail = () => reject(new Error('browser analysis worker initialization failed'));
    worker.addEventListener('error', fail);
    worker.addEventListener('messageerror', fail);
    timer = setTimeout(() => reject(new Error('browser analysis initialization timed out')), timeoutMs);
  });
  try {
    await Promise.race([Promise.resolve().then(initialize), failed]);
  } finally {
    clearTimeout(timer);
    worker.removeEventListener('error', fail);
    worker.removeEventListener('messageerror', fail);
  }
}
