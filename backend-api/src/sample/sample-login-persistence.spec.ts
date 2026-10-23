import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SampleService } from './sample.service';
import { LoginService } from '../login/login.service';
import { AccessService } from '../access/access.service';
import { AuthService } from '../auth/auth.service';
import { RefreshToken } from '../auth/entites/refresh_token.entity';
import { User } from '../user/entities/user.entity';
import { Database } from '../database/entities/database.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { Widget } from '../widget/entities/widget.entity';
import { Component } from '../component/entities/component.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardShare } from '../dashboard/entities/dashboard_share.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { LoginHistory } from '../middleware/entities/login-history.entity';
import { loginLoggerMiddleware } from '../middleware/middleware-log/middleware.login-logger';
import { userLoggerMiddleware } from '../middleware/middleware-log/middleware.user-logger';
import { shareUrlLoggerMiddleware } from '../middleware/middleware-log/middleware.share-url-logger';
import { EnterpriseService } from '../enterprise/enterprise.service';
import { EnterpriseOrganization } from '../enterprise/entities/enterprise-organization.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from '../enterprise/entities/enterprise-audit-event.entity';
import { EnterpriseEnrollment } from '../enterprise/entities/enterprise-enrollment.entity';
import { ExportJob } from '../bi/entities/export-job.entity';
import { metadataTransaction } from '../common/metadata-work';

const gate = () => {
  let resolve: () => void;
  const promise = new Promise<void>(r => (resolve = r));
  return { promise, resolve: () => resolve() };
};
const entities = [
  User,
  RefreshToken,
  LoginHistory,
  Database,
  Dataset,
  Widget,
  Component,
  Dashboard,
  DashboardShare,
  DashboardWidget,
  UserMapping,
  EnterpriseOrganization,
  EnterpriseMembership,
  EnterpriseAuditEvent,
  EnterpriseEnrollment,
  ExportJob,
];

describe('Signup sample and request history preserve committed metadata across real file reopen', () => {
  jest.setTimeout(30000);
  let db: DataSource, directory: string;
  const originalUpload = process.env.FILE_UPLOAD_DIR,
    originalConfig = process.env.CONFIG_SECRET_KEY,
    originalRefresh = process.env.REFRESH_SECRET;
  beforeEach(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-login-sample-reopen-'));
    process.env.FILE_UPLOAD_DIR = path.join(directory, 'uploads');
    process.env.CONFIG_SECRET_KEY = 'synthetic-sample-reopen';
    process.env.REFRESH_SECRET = 'synthetic-refresh-reopen';
    db = await new DataSource({
      type: 'sqlite',
      database: path.join(directory, 'metadata.db'),
      entities,
      synchronize: true,
    }).initialize();
    await db.manager.insert(Component, [
      { title: 'Number', type: 'BOARD_NUMERIC', option: '{}' },
      { title: 'Bar', type: 'CHART_BAR', option: '{}' },
    ]);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    if (db?.isInitialized) await db.destroy();
    fs.rmSync(directory, { recursive: true, force: true });
    for (const [key, value] of [
      ['FILE_UPLOAD_DIR', originalUpload],
      ['CONFIG_SECRET_KEY', originalConfig],
      ['REFRESH_SECRET', originalRefresh],
    ]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  it.each([loginLoggerMiddleware, userLoggerMiddleware, shareUrlLoggerMiddleware])(
    '%s cannot overlap its automatic COMMIT with detached sample metadata',
    async Middleware => {
      const sample = new SampleService(
        db.getRepository(Database),
        db.getRepository(Dataset),
        db.getRepository(Widget),
        db.getRepository(Component),
        db.getRepository(Dashboard),
        db.getRepository(DashboardShare),
        db.getRepository(DashboardWidget),
        db.getRepository(UserMapping),
      );
      const auth = new AuthService(
        new JwtService(),
        db.getRepository(User),
        db.getRepository(RefreshToken),
      );
      const login = new LoginService(
        auth,
        db.getRepository(User),
        db.getRepository(RefreshToken),
        sample,
        new AccessService(),
      );
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const fileEntered = gate(),
        fileRelease = gate(),
        commitEntered = gate(),
        commitRelease = gate(),
        historyDone = gate(),
        sampleQueued = gate(),
        nestedEntered = gate();
      let provisioning: Promise<void>,
        fileReady = false;
      const provision = sample.provisionForUser.bind(sample),
        writeFile = (sample as any).writeSampleSqlite.bind(sample),
        queued = (sample as any).queued.bind(sample);
      jest
        .spyOn(sample, 'provisionForUser')
        .mockImplementation(id => (provisioning = provision(id)));
      jest.spyOn(sample as any, 'writeSampleSqlite').mockImplementation(async () => {
        fileEntered.resolve();
        await fileRelease.promise;
        const file = await writeFile();
        fileReady = true;
        return file;
      });
      jest.spyOn(sample as any, 'queued').mockImplementation((operation: any) => {
        if (fileReady) sampleQueued.resolve();
        return queued(operation);
      });
      await login.signup({
        userId: 'sample-reopen',
        email: 'sample-reopen@example.invalid',
        password: 'synthetic-password',
      });
      await fileEntered.promise;
      const runner = db.createQueryRunner(),
        query = runner.query.bind(runner);
      let firstCommit = true,
        holding = false,
        interleaved = false;
      // Real TypeORM/SQLite interleaving: a raw history COMMIT is pending when sample asks to start
      // its next transaction. Before the fix the sample joins history, then sends a stale SAVEPOINT
      // after COMMIT and leaves the driver depth/active flags inconsistent with the physical file.
      jest
        .spyOn(runner, 'query')
        .mockImplementation(async (sql: any, parameters?: any[], structured?: boolean) => {
          if (sql === 'COMMIT' && firstCommit) {
            firstCommit = false;
            holding = true;
            commitEntered.resolve();
            await commitRelease.promise;
          }
          if (sql === 'SAVEPOINT typeorm_1' && holding && !interleaved) {
            interleaved = true;
            nestedEntered.resolve();
            commitRelease.resolve();
            await historyDone.promise;
          }
          return query(sql, parameters, structured);
        });
      const middleware = new Middleware(db.getRepository(LoginHistory));
      const logging = middleware
        .use(
          {
            url: '/signin',
            path: '/signin',
            body: { userId: 'sample-reopen' },
            headers: { 'user-agent': 'synthetic' },
          } as any,
          {} as any,
          () => undefined,
        )
        .finally(() => {
          holding = false;
          historyDone.resolve();
        });
      try {
        await commitEntered.promise;
        fileRelease.resolve();
        await sampleQueued.promise;
        await Promise.race([nestedEntered.promise, new Promise<void>(r => setTimeout(r, 250))]);
        commitRelease.resolve();
        await logging;
        await provisioning;
        const actor = await login.signin({
          userId: 'sample-reopen',
          password: 'synthetic-password',
        });
        await auth.setRefreshKey(await auth.generateRefreshToken(actor), actor.jwtId, actor.id);
        await new EnterpriseService(db).create(actor.id, {
          name: 'Synthetic persisted organization',
        });
        // Representative endpoint metadata uses the production queue/transaction helper. No export
        // worker, source SQL or filesystem work is needed to prove the shared connection commits.
        await metadataTransaction(db, async manager => {
          await manager.insert(Database, {
            id: 90,
            ownerId: actor.id,
            name: 'Persisted source',
            engine: 'duckdb',
            type: 'duckdb',
            connectionConfig: '{}',
          });
          await manager.insert(ExportJob, {
            ownerId: actor.id,
            sourceOwnerId: actor.id,
            sourceId: 90,
            organizationId: 1,
            requestId: '586886d4-44aa-4a13-bf98-f3e577bd6e12',
            digest: 'a'.repeat(64),
            requestJson: '{}',
            basisJson: '{}',
            status: 'queued',
            version: 1,
            expiresAt: new Date(Date.now() + 900000),
          });
        });
        const state = {
          active: runner.isTransactionActive,
          depth: (runner as any).transactionDepth,
        };
        // Close the actual disk connection and reconstruct a new DataSource without synchronize.
        await db.destroy();
        db = await new DataSource({
          type: 'sqlite',
          database: path.join(directory, 'metadata.db'),
          entities,
        }).initialize();
        const persisted = {
          memberships: await db.manager.count(EnterpriseMembership),
          organizations: await db.manager.count(EnterpriseOrganization),
          source: await db.manager.countBy(Database, { id: 90 }),
          exports: await db.manager.count(ExportJob),
          sessions: await db.manager.count(RefreshToken),
          datasets: await db.manager.count(Dataset),
          dashboards: await db.manager.count(Dashboard),
          history: await db.manager.count(LoginHistory),
        };
        expect(persisted).toEqual({
          memberships: 1,
          organizations: 1,
          source: 1,
          exports: 1,
          sessions: 1,
          datasets: 1,
          dashboards: 1,
          history: 1,
        });
        expect(interleaved).toBe(false);
        expect(state).toEqual({ active: false, depth: 0 });
        expect(warn).not.toHaveBeenCalled();
      } finally {
        fileRelease.resolve();
        commitRelease.resolve();
        historyDone.resolve();
        await logging;
        await provisioning;
      }
    },
  );
});
