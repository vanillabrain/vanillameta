import { GUARDS_METADATA } from '@nestjs/common/constants';
import { LegacyOperationsGuard } from '../auth/guards/legacy-operations.guard';
import { AnalyticsDashboardController } from './analytics-dashboard.controller';
import { AnalyticsController } from './analytics.controller';
import { EventsController } from '../events/events.controller';

const guardedAnalytics = [
  'getEventStats',
  'getPopularFeatures',
  'getErrorRate',
  'getPerformanceMetrics',
  'getUserJourney',
];
const guardedEvents = [
  'getAnalyticsSummary',
  'getEvents',
  'getMetrics',
  'getFunnelAnalysis',
  'getRetentionAnalysis',
  'getUserFlow',
];

describe('legacy telemetry authorization routes', () => {
  it.each(guardedAnalytics)('requires an explicit operator on global analytics %s', method => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, AnalyticsDashboardController.prototype[method]),
    ).toContain(LegacyOperationsGuard);
  });
  it.each(guardedEvents)('requires an explicit operator on events aggregate %s', method => {
    expect(Reflect.getMetadata(GUARDS_METADATA, EventsController.prototype[method])).toContain(
      LegacyOperationsGuard,
    );
  });
  it('keeps own analytics scoped to the actual JWT actor', async () => {
    const getUserEvents = jest.fn();
    const controller = new AnalyticsDashboardController({ getUserEvents } as any);
    await controller.getUserEvents({
      userId: 'victim',
      accessKeyData: { id: 7, userId: 'alice', authVersion: 3 },
    });
    expect(getUserEvents).toHaveBeenCalledWith('alice', undefined, undefined);
    expect(Reflect.getMetadata(GUARDS_METADATA, controller.getUserEvents) ?? []).not.toContain(
      LegacyOperationsGuard,
    );
  });
  it('keeps public collection available and normalizes optional verified identity', async () => {
    const collectEvents = jest.fn();
    const controller = new AnalyticsController({ collectEvents } as any);
    await controller.collectEvents({ events: [] }, '', '', '', { ip: '127.0.0.1' });
    expect(collectEvents).toHaveBeenLastCalledWith([], expect.objectContaining({ userId: null }));
    await controller.collectEvents({ events: [] }, '', '', '', {
      user: { accessKeyData: { id: 7, userId: 'alice' } },
    });
    expect(collectEvents).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ userId: 'alice' }),
    );
  });
});
