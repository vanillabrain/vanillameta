import { CloudWatchMetricsService } from './cloudwatch-metrics.service';

jest.mock('aws-sdk', () => ({ CloudWatch: jest.fn() }));

describe('CloudWatchMetricsService enabled parsing', () => {
  afterEach(() => jest.restoreAllMocks());
  it.each([false, 'false', ' FALSE ', '0', ''])(
    'does not schedule or buffer metrics for %s',
    async value => {
      const interval = jest.spyOn(global, 'setInterval').mockImplementation(() => ({} as any));
      const service = new CloudWatchMetricsService({
        get: (key: string, fallback: any) =>
          key === 'CLOUDWATCH_METRICS_ENABLED' ? value : fallback,
      } as any);
      await service.putMetric('Test', 'Metric', 1);
      expect(interval).not.toHaveBeenCalled();
      expect((service as any).metricsBuffer).toEqual([]);
    },
  );
  it.each([true, 'true', ' TRUE '])('retains enabled collection for %s', value => {
    const interval = jest.spyOn(global, 'setInterval').mockImplementation(() => ({} as any));
    new CloudWatchMetricsService({
      get: (key: string, fallback: any) =>
        key === 'CLOUDWATCH_METRICS_ENABLED' ? value : fallback,
    } as any);
    expect(interval).toHaveBeenCalledTimes(1);
  });
});
