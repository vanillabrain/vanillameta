import { CacheAlertService, AlertRule } from './cache-alert.service';
import { CacheMonitoringEvent } from './cache-monitoring.service';

jest.mock('@nestjs/event-emitter', () => ({ OnEvent: () => () => undefined }), { virtual: true });
jest.mock('./cache-monitoring.service', () => ({}));

describe('CacheAlertService structured log arguments', () => {
  it.each(['critical', 'error', 'warning', 'info'] as const)(
    'preserves %s metadata and context',
    async severity => {
      const logger = { error: jest.fn(), warn: jest.fn(), log: jest.fn() };
      const service = new CacheAlertService(logger as any, {} as any);
      const rule = { id: 'test', name: 'Test' } as AlertRule;
      const event = { severity, engine: 'dashboard', message: 'threshold' } as CacheMonitoringEvent;
      await (service as any).sendLogAlert(rule, event);
      const metadata = expect.objectContaining({ rule: 'test', engine: 'dashboard', severity });
      if (severity === 'critical' || severity === 'error') {
        expect(logger.error).toHaveBeenCalledWith(
          '[CACHE ALERT] Test',
          undefined,
          'CacheAlertService',
          metadata,
        );
      } else {
        expect(logger[severity === 'warning' ? 'warn' : 'log']).toHaveBeenCalledWith(
          '[CACHE ALERT] Test',
          'CacheAlertService',
          metadata,
        );
      }
    },
  );
});
