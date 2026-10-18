import {
  EnterpriseGroup,
  EnterpriseGroupMember,
  EnterpriseGroupGrant,
} from '../enterprise/entities/enterprise-group.entity';
jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';
import { DataSource } from 'typeorm';
import { Database } from '../database/entities/database.entity';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseResourceGrant } from '../enterprise/entities/enterprise-resource-grant.entity';
import { EnterpriseResourcePolicyService } from '../enterprise/resource-policy.service';
import { SourceAccessService } from '../ownership/source-access.service';
import { SourceCatalogEntry } from './entities/source-catalog-entry.entity';
import { SourceCatalogService } from './source-catalog.service';
import { BiService } from './bi.service';

/** Full real SQLite→policy→catalog→DuckDB aggregate path, with independent calendar fixtures. */
describe('UC050 strict full-data date declarations', () => {
  let db: DataSource, instance: DuckDBInstance, duck: DuckDBConnection;
  let catalog: SourceCatalogService, bi: BiService, query: jest.Mock;
  const quotedName = 'date"; DROP TABLE uploaded_data; --';
  const quote = (s: string) => '"' + s.replace(/"/g, '""') + '"';
  beforeEach(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [
        Database,
        User,
        EnterpriseMembership,
        EnterpriseResourceGrant,
        EnterpriseGroup,
        EnterpriseGroupMember,
        EnterpriseGroupGrant,
        SourceCatalogEntry,
      ],
    }).initialize();
    await db.getRepository(User).save({
      id: 7,
      userId: 'owner',
      email: 'owner@example.invalid',
      password: 'hash',
      active: true,
    });
    await db.getRepository(User).save({
      id: 8,
      userId: 'reader',
      email: 'reader@example.invalid',
      password: 'hash',
      active: true,
    });
    await db.getRepository(EnterpriseMembership).save([
      { userId: 7, organizationId: 1, role: 'admin', team: '' },
      { userId: 8, organizationId: 1, role: 'member', team: '' },
    ]);
    await db.getRepository(Database).save({
      id: 1,
      name: 'Calendar',
      ownerId: 7,
      engine: 'duckdb',
      type: 'FILE',
      connectionConfig: '{}',
    });
    instance = await DuckDBInstance.create(':memory:');
    duck = await instance.connect();
    // Six valid rows precede a seventh invalid non-leap date, outside the five-row preview.
    await duck.run(`CREATE TABLE uploaded_data AS SELECT i AS amount,
      CASE WHEN i=7 THEN '2023-02-29' WHEN i=6 THEN NULL ELSE '2024-02-29' END AS ${quote(
        quotedName,
      )}
      FROM range(1,8) t(i)`);
    const access = new SourceAccessService(db, new EnterpriseResourcePolicyService(db));
    query = jest.fn(async (_id, sql) => ({
      datas: (await duck.runAndReadAll(sql)).getRowObjectsJson(),
    }));
    bi = new BiService(
      db,
      access,
      {
        queryDuckDB: query,
        withDuckDBSnapshot: (_id, run) => run(),
        duckDBVersion: async () => 'immutable-fixture',
      } as any,
      {} as any,
    );
    catalog = new SourceCatalogService(db, access, bi);
  });
  afterEach(async () => {
    duck?.closeSync();
    instance?.closeSync();
    await db?.destroy();
  });
  const draft = async (actor = 7) => {
    const r = await catalog.read({ sourceId: 1 }, actor);
    const result: any = {
      ...r,
      columns: r.columns.map(c => {
        const next: any = { ...c };
        delete next.type;
        return next;
      }),
    };
    delete result.schemaChanged;
    return result;
  };
  const dateDraft = async (actor = 7) => {
    const r = await draft(actor);
    return {
      ...r,
      columns: r.columns.map(c =>
        c.column === quotedName
          ? { ...c, businessType: 'date', dateFormat: 'YYYY-MM-DD', classification: '달력' }
          : c,
      ),
    };
  };
  it('rejects a hidden seventh invalid date with zero writes and no raw values in the error', async () => {
    const d = await dateDraft();
    expect((await bi.profile(1, 7)).preview.every(r => r[quotedName] === '2024-02-29')).toBe(true);
    let failure: any;
    try {
      await catalog.preview(d, 7);
    } catch (e) {
      failure = e;
    }
    expect(failure).toMatchObject({ status: 400 });
    expect(JSON.stringify(failure)).not.toContain('2023-02-29');
    await expect(catalog.save(d, 7)).rejects.toMatchObject({ status: 400 });
    expect(await db.getRepository(SourceCatalogEntry).count()).toBe(0);
    expect(
      (await duck.runAndReadAll('SELECT count(*) AS n FROM uploaded_data')).getRowObjectsJson()[0]
        .n,
    ).toBe('7');
  });
  it.each([
    ['YYYY-MM-DD', '2024-02-29'],
    ['YYYY/MM/DD', '2024/02/29'],
    ['YYYYMMDD', '20240229'],
  ])(
    'accepts exact %s dates plus null through preview save reload and legacy save',
    async (format, valid) => {
      await duck.run(
        `UPDATE uploaded_data SET ${quote(
          quotedName,
        )}=CASE WHEN amount=6 THEN NULL ELSE '${valid}' END`,
      );
      const d = await dateDraft();
      d.columns[1].dateFormat = format;
      const preview = await catalog.preview(d, 7);
      expect(await db.getRepository(SourceCatalogEntry).count()).toBe(0);
      query.mockClear();
      await catalog.save(preview.draft, 7);
      expect(query.mock.calls.filter(call => call[1].includes('AS invalid_0'))).toHaveLength(1);
      const r = await draft();
      expect(r.columns[1]).toMatchObject({
        businessType: 'date',
        dateFormat: format,
        classification: '달력',
      });
      const legacy = {
        ...r,
        label: '새 이름',
        columns: r.columns.map(c => {
          const next = { ...c };
          delete next.businessType;
          delete next.dateFormat;
          delete next.classification;
          return next;
        }),
      };
      await catalog.save(legacy, 7);
      const reloaded = await new SourceCatalogService(db, (bi as any).access, bi).read(
        { sourceId: 1 },
        7,
      );
      expect(reloaded).toMatchObject({ version: 2, label: '새 이름' });
      expect(reloaded.columns[1]).toMatchObject({ businessType: 'date', dateFormat: format });
    },
  );
  it.each(['2024-2-29', '2024-02-30', '', '2024-02-29 ', '2024-02-29 00:00:00'])(
    'rejects non-exact or impossible input %j',
    async raw => {
      await duck.run(`UPDATE uploaded_data SET ${quote(quotedName)}='${raw}'`);
      const failure: any = await catalog.preview(await dateDraft(), 7).catch(error => error);
      expect(failure).toMatchObject({ status: 400 });
      expect(failure.getResponse()).toMatchObject({
        code: 'INVALID_BUSINESS_DATES',
        details: [{ column: quotedName, invalidCount: '7', blankCount: raw === '' ? '7' : '0' }],
      });
      expect(await db.getRepository(SourceCatalogEntry).count()).toBe(0);
    },
  );
  it('denies read-only and revoked edit before validating another user data', async () => {
    await db.getRepository(EnterpriseResourceGrant).save({
      resourceKind: 'source',
      resourceId: 1,
      recipientId: 8,
      ownerId: 7,
      organizationId: 1,
      version: 1,
      read: true,
      edit: false,
      publish: false,
      export: false,
    });
    const d = await dateDraft(8);
    query.mockClear();
    await expect(catalog.preview(d, 8)).rejects.toMatchObject({ status: 403 });
    expect(query).not.toHaveBeenCalled();
    await db
      .getRepository(EnterpriseResourceGrant)
      .update({ resourceKind: 'source', resourceId: 1, recipientId: 8 }, { edit: true });
    await duck.run(`UPDATE uploaded_data SET ${quote(quotedName)}='2024-02-29'`);
    const preview = await catalog.preview(d, 8);
    await db
      .getRepository(EnterpriseResourceGrant)
      .update({ resourceKind: 'source', resourceId: 1, recipientId: 8 }, { edit: false });
    query.mockClear();
    await expect(catalog.save(preview.draft, 8)).rejects.toMatchObject({ status: 403 });
    expect(query).not.toHaveBeenCalled();
    expect(await db.getRepository(SourceCatalogEntry).count()).toBe(0);
  });
  it('reports a concurrent source revision change before returning stale invalid-date counts', async () => {
    const d = await dateDraft();
    const original = query.getMockImplementation();
    query.mockImplementation(async (id, sql) => {
      const result = await original(id, sql);
      if (sql.includes('AS invalid_0'))
        await db.getRepository(Database).update(1, { updatedAt: new Date('2030-01-01T00:00:00Z') });
      return result;
    });
    await expect(catalog.preview(d, 7)).rejects.toMatchObject({ status: 409 });
    expect(await db.getRepository(SourceCatalogEntry).count()).toBe(0);
  });
});
