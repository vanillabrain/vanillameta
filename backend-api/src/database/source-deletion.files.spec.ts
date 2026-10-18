import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as os from 'os';
import { DuckDBService } from '../analysis/duckdb.service';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from '../enterprise/entities/enterprise-audit-event.entity';
import { EnterpriseResourceGrant } from '../enterprise/entities/enterprise-resource-grant.entity';
import { EnterpriseGroupGrant } from '../enterprise/entities/enterprise-group.entity';
import { Metric } from '../metric/entities/metric.entity';
import { Database } from './entities/database.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { TableQuery } from '../widget/tabel-query/entity/table-query.entity';
import { Widget } from '../widget/entities/widget.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { StudioState } from '../dashboard-studio/entities/studio-state.entity';
import { StudioExecution } from '../dashboard-studio/entities/studio-execution.entity';
import { PersonalView } from '../dashboard/entities/personal-view.entity';
import { ExploreView } from '../bi/entities/explore-view.entity';
import { DashboardPublication } from '../dashboard/entities/dashboard-publication.entity';
import { StudioPublication } from '../dashboard-studio/entities/studio-publication.entity';
import { ExportJob } from '../bi/entities/export-job.entity';
import { CommerceSource } from '../commerce/entities/commerce-source.entity';
import { SourceCatalogEntry } from '../bi/entities/source-catalog-entry.entity';
import { SourceConditionEntry } from '../bi/entities/source-condition-entry.entity';
import { SourceDeleteReceipt } from './entities/source-delete-receipt.entity';
import { SourceDeletionService } from './source-deletion.service';
import { encryptConnectionConfig, decryptConnectionConfig } from '../utils/crypto.util';

describe('UC055 metadata deletion with real managed files', () => {
  jest.setTimeout(30000);
  const entities = [
    User,
    EnterpriseMembership,
    EnterpriseAuditEvent,
    EnterpriseResourceGrant,
    EnterpriseGroupGrant,
    Metric,
    Database,
    Dataset,
    TableQuery,
    Widget,
    Dashboard,
    DashboardWidget,
    StudioState,
    StudioExecution,
    PersonalView,
    ExploreView,
    DashboardPublication,
    StudioPublication,
    ExportJob,
    CommerceSource,
    SourceCatalogEntry,
    SourceConditionEntry,
    SourceDeleteReceipt,
  ];

  let db: DataSource, duck: DuckDBService, service: SourceDeletionService;
  let fixture: string, root: string;
  const beforeRoot = process.env.FILE_UPLOAD_DIR;
  const beforeKey = process.env.CONFIG_SECRET_KEY;
  const connection = { removeKnex: jest.fn() };
  const open = () =>
    new DataSource({
      type: 'sqlite',
      database: path.join(fixture, 'metadata.db'),
      entities,
      synchronize: true,
    }).initialize();
  beforeEach(async () => {
    fixture = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'source-delete-flow-')));
    root = path.join(fixture, 'uploads');
    await fs.mkdir(root);
    process.env.FILE_UPLOAD_DIR = root;
    process.env.CONFIG_SECRET_KEY = 'synthetic-source-delete-integration-key';
    db = await open();
    duck = new DuckDBService();
    connection.removeKnex.mockReset().mockResolvedValue(undefined);
    service = new SourceDeletionService(db, duck, connection as any);
    await db.manager.insert(User, {
      id: 1,
      userId: 'synthetic',
      email: 'synthetic@example.invalid',
      password: 'unused',
      active: true,
      authVersion: 0,
    });
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await duck?.onModuleDestroy();
    if (db?.isInitialized) await db.destroy();
    await fs.rm(fixture, { recursive: true, force: true });
    if (beforeRoot === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = beforeRoot;
    if (beforeKey === undefined) delete process.env.CONFIG_SECRET_KEY;
    else process.env.CONFIG_SECRET_KEY = beforeKey;
  });
  const imported = async (id = 1) => {
    const result = await duck.importFile({
      originalname: 'synthetic.csv',
      buffer: Buffer.from('n\n1\n2\n'),
    });
    await duck.registerImport(result.filename, id);
    return result.filename;
  };
  const source = async (id: number, filename: string, versions: string[] = []) =>
    db.manager.insert(Database, {
      id,
      ownerId: 1,
      name: 'Synthetic files',
      engine: 'duckdb',
      type: 'file',
      connectionConfig: encryptConnectionConfig(
        JSON.stringify({
          client: 'duckdb',
          connection: { filename },
          ...(versions.length ? { fileVersions: versions.map(filename => ({ filename })) } : {}),
        }),
      ),
    });
  const remove = async () => {
    const i = (await service.impact(1, 1)).data;
    const input = {
      requestId: randomUUID(),
      expectedRevision: i.revision,
      expectedActorId: 1,
      expectedOrganizationId: null,
    };
    return { input, receipt: (await service.remove(1, 1, input)).data };
  };
  it('persists partial file progress across metadata/worker restart and retries without touching another source', async () => {
    const first = await imported(),
      second = await imported(),
      independent = await imported(2);
    await source(1, first, [first, second]);
    await source(2, independent);
    const { input, receipt } = await remove();
    expect(receipt.cleanup).toEqual({ status: 'pending', managedFiles: 2 });
    await fs.access(first);
    await fs.access(second);
    const actual = duck.removeOwnedImport.bind(duck);
    jest.spyOn(duck, 'removeOwnedImport').mockImplementation(async (filename, id, proof) => {
      if (filename === second) throw new Error('synthetic removal fault');
      return actual(filename, id, proof);
    });
    const partial = await service.cleanup(receipt.receiptId, 1, { requestId: input.requestId });
    expect(partial.data.cleanup.status).toBe('retry_required');
    await expect(fs.access(first)).rejects.toMatchObject({ code: 'ENOENT' });
    await fs.access(second);
    await fs.access(independent);
    const stored = await db.manager.findOneByOrFail(SourceDeleteReceipt, { id: receipt.receiptId });
    expect(stored.filePlan).not.toContain(root);
    expect(JSON.parse(decryptConnectionConfig(stored.filePlan)).files.map(f => f.done)).toEqual([
      true,
      false,
    ]);
    jest.restoreAllMocks();
    await duck.onModuleDestroy();
    await db.destroy();
    db = await open();
    duck = new DuckDBService();
    service = new SourceDeletionService(db, duck, connection as any);
    const replay = await service.remove(1, 1, input);
    expect(replay.data.replayed).toBe(true);
    await fs.access(second);
    const complete = await service.cleanup(receipt.receiptId, 1, { requestId: input.requestId });
    expect(complete.data.cleanup.status).toBe('complete');
    await expect(fs.access(second)).rejects.toMatchObject({ code: 'ENOENT' });
    expect((await duck.query(independent, 'SELECT sum(n) AS n FROM uploaded_data')).datas).toEqual([
      { n: 3 },
    ]);
    expect(await db.manager.count(Database)).toBe(1);
    expect(await db.manager.count(SourceDeleteReceipt)).toBe(1);
    expect(
      (await service.cleanup(receipt.receiptId, 1, { requestId: input.requestId })).data.cleanup
        .status,
    ).toBe('complete');
  });
  it('blocks a nested shared file during impact/delete and after metadata commit during cleanup', async () => {
    const filename = await imported();
    await source(1, filename);
    const impact = (await service.impact(1, 1)).data;
    const nested = path.join(path.dirname(filename), 'nested', 'shared.duckdb');
    await fs.mkdir(path.dirname(nested));
    await fs.writeFile(nested, 'preserve');
    await source(2, nested);
    expect(
      (await service.impact(1, 1)).data.dependencies.find(d => d.kind === 'sharedFiles').count,
    ).toBe(1);
    await expect(
      service.remove(1, 1, {
        requestId: randomUUID(),
        expectedRevision: impact.revision,
        expectedActorId: 1,
        expectedOrganizationId: null,
      }),
    ).rejects.toMatchObject({ status: 409 });
    await db.manager.delete(Database, 2);
    const { input, receipt } = await remove();
    await source(2, nested);
    await expect(
      service.cleanup(receipt.receiptId, 1, { requestId: input.requestId }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await fs.readFile(nested, 'utf8')).toBe('preserve');
    await fs.access(filename);
  });
  it('rejects malformed other-source historical filenames before metadata or file deletion', async () => {
    const filename = await imported();
    await source(1, filename);
    const i = (await service.impact(1, 1)).data;
    await db.manager.insert(Database, {
      id: 2,
      ownerId: 1,
      name: 'Corrupt synthetic config',
      engine: 'duckdb',
      type: 'file',
      connectionConfig: JSON.stringify({
        connection: { filename: path.join(root, randomUUID(), 'data.duckdb') },
        fileVersions: { old: filename },
      }),
    });
    await expect(service.impact(1, 1)).rejects.toMatchObject({ status: 409 });
    await expect(
      service.remove(1, 1, {
        requestId: randomUUID(),
        expectedRevision: i.revision,
        expectedActorId: 1,
        expectedOrganizationId: null,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await db.manager.count(Database)).toBe(2);
    expect(await db.manager.count(SourceDeleteReceipt)).toBe(0);
    await fs.access(filename);
  });
  it('records an initially missing managed directory and never removes a replacement directory', async () => {
    const filename = path.join(root, randomUUID(), 'data.duckdb');
    await source(1, filename);
    const { input, receipt } = await remove();
    await fs.mkdir(path.dirname(filename));
    await fs.writeFile(filename, 'preserve replacement');
    const result = await service.cleanup(receipt.receiptId, 1, { requestId: input.requestId });
    expect(result.data.cleanup.status).toBe('retry_required');
    expect(await fs.readFile(filename, 'utf8')).toBe('preserve replacement');
  });
});
