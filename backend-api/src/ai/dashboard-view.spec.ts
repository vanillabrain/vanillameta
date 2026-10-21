jest.mock('../bi/source-classifications', () => ({
  ...jest.requireActual('../bi/source-classifications'),
  catalogActorContext: jest.fn().mockResolvedValue({}),
  assertCatalogActor: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('./ai.service', () => ({ AiService: class {} }));
import { AiDashboardService } from './ai-dashboard.service';
const revision = 'a'.repeat(64);
const fixture = () => {
  const service: any = Object.create(AiDashboardService.prototype);
  service.dashboards = { manager: {} };
  const draft = { databaseId: 2, title: 'Saved', explanation: '', widgets: [], revision };
  service.analysis = jest.fn().mockResolvedValue({ status: 'SUCCESS', data: draft });
  service.preview = jest.fn().mockResolvedValue({ status: 'SUCCESS', data: { widgets: [] } });
  return {
    service,
    draft,
    body: { dashboardId: 1, expectedRevision: revision, includeTrends: true },
  };
};
it('reads only the server definition with read permission and the admitted epoch', async () => {
  const { service, draft, body } = fixture();
  await service.viewSaved(body, 9, 4);
  expect(service.analysis).toHaveBeenCalledWith(1, 9, true, 'read');
  expect(service.preview).toHaveBeenCalledWith(
    { dashboardId: 1, draft, includeTrends: true },
    9,
    'read',
    4,
  );
});
it.each(['draft', 'sql', 'databaseId', 'widgets'])(
  'rejects client %s without a read or computation',
  async key => {
    const { service, body } = fixture();
    await expect(service.viewSaved({ ...body, [key]: 'untrusted' }, 9, 4)).rejects.toThrow();
    expect(service.analysis).not.toHaveBeenCalled();
    expect(service.preview).not.toHaveBeenCalled();
  },
);
it('requires a revision and rejects stale input before computing', async () => {
  const { service, body } = fixture();
  await expect(service.viewSaved({ dashboardId: 1 }, 9, 4)).rejects.toThrow();
  await expect(
    service.viewSaved({ ...body, expectedRevision: 'b'.repeat(64) }, 9, 4),
  ).rejects.toThrow();
  expect(service.preview).not.toHaveBeenCalled();
});
it('does not return results when the saved definition changes during calculation', async () => {
  const { service, draft, body } = fixture();
  (service.analysis as jest.Mock)
    .mockResolvedValueOnce({ status: 'SUCCESS', data: draft })
    .mockResolvedValueOnce({ status: 'SUCCESS', data: { ...draft, revision: 'b'.repeat(64) } });
  await expect(service.viewSaved(body, 9, 4)).rejects.toThrow();
});
it('does not compute after current read is revoked', async () => {
  const { service, body } = fixture();
  (service.analysis as jest.Mock).mockRejectedValue(new Error('read denied'));
  await expect(service.viewSaved(body, 9, 4)).rejects.toThrow('read denied');
  expect(service.preview).not.toHaveBeenCalled();
});

it('rejects an epoch change before returning a computed result', async () => {
  const { assertCatalogActor } = await import('../bi/source-classifications');
  (assertCatalogActor as jest.Mock).mockRejectedValueOnce(new Error('session revoked'));
  const { service, body } = fixture();
  await expect(service.viewSaved(body, 9, 4)).rejects.toThrow('session revoked');
});
