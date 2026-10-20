jest.mock('./bi.service', () => ({ BiService: class {} }));
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { metadataTransaction, serializeMetadataWork } from '../common/metadata-work';
import { Database } from '../database/entities/database.entity';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseClassification } from '../enterprise/entities/enterprise-classification.entity';
import { EnterpriseResourceGrant } from '../enterprise/entities/enterprise-resource-grant.entity';
import {
  EnterpriseGroup,
  EnterpriseGroupGrant,
  EnterpriseGroupMember,
} from '../enterprise/entities/enterprise-group.entity';
import { EnterpriseResourcePolicyService } from '../enterprise/resource-policy.service';
import { SourceAccessService } from '../ownership/source-access.service';
import { SourceCatalogService } from './source-catalog.service';
import { SourceCatalogEntry } from './entities/source-catalog-entry.entity';
import { assertCatalogBindings, catalogActorContext } from './source-classifications';

describe('UC050 catalog classification binding', () => {
  let db: DataSource, catalog: SourceCatalogService, bi: any;
  const ref = { organizationId: 1, id: 10, version: 1 };
  const key = (name: string) =>
    createHash('sha256').update(name.toLowerCase(), 'utf8').digest('hex');
  const profile = (sourceId: number) => ({
    sourceId,
    name: 'Synthetic',
    supported: true,
    dataVersion: 'file-metadata-v1',
    columns: [
      { name: 'amount', type: 'DOUBLE' },
      { name: 'day', type: 'VARCHAR' },
    ],
  });
  const draft = async (sourceId = 3, actor = 7) => {
    const state = await catalog.read({ sourceId }, actor);
    const result = {
      ...state,
      columns: state.columns.map(column => {
        const value = { ...column };
        delete value.type;
        return value;
      }),
    };
    delete result.schemaChanged;
    return result;
  };
  const linked = async (sourceId = 3) => {
    const body = await draft(sourceId);
    body.columns[0] = {
      ...body.columns[0],
      classification: 'untrusted client label',
      classificationRef: ref,
    };
    return body;
  };
  beforeEach(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [
        Database,
        User,
        EnterpriseMembership,
        EnterpriseClassification,
        SourceCatalogEntry,
        EnterpriseResourceGrant,
        EnterpriseGroup,
        EnterpriseGroupGrant,
        EnterpriseGroupMember,
      ],
    }).initialize();
    await db.manager.save(
      User,
      [7, 8, 9].map(id => ({
        id,
        userId: `fixture-${id}`,
        email: `fixture-${id}@example.invalid`,
        password: 'fixture',
        active: true,
        authVersion: 0,
      })),
    );
    await db.manager.save(EnterpriseMembership, [
      { userId: 7, organizationId: 1, role: 'member', team: '' },
      { userId: 8, organizationId: 1, role: 'admin', team: '' },
      { userId: 9, organizationId: 1, role: 'member', team: '' },
    ]);
    await db.manager.save(
      Database,
      [3, 4].map(id => ({
        id,
        ownerId: 7,
        name: 'Synthetic',
        engine: 'duckdb',
        type: 'FILE',
        connectionConfig: '{}',
      })),
    );
    await db.manager.save(EnterpriseClassification, [
      {
        id: 10,
        organizationId: 1,
        name: 'Shared',
        nameKey: key('Shared'),
        active: true,
        version: 1,
      },
      { id: 11, organizationId: 1, name: 'Other', nameKey: key('Other'), active: true, version: 1 },
      {
        id: 20,
        organizationId: 2,
        name: 'Shared',
        nameKey: key('Shared'),
        active: true,
        version: 1,
      },
    ]);
    const access = new SourceAccessService(db, new EnterpriseResourcePolicyService(db));
    bi = {
      profile: jest.fn(async id => profile(id)),
      validateBusinessDates: jest.fn(async () => undefined),
    };
    catalog = new SourceCatalogService(db, access, bi);
  });
  afterEach(async () => db?.destroy());

  it('binds two sources to canonical names while preserving exact historical names across rename/inactivation/movement', async () => {
    for (const sourceId of [3, 4]) {
      const preview = await catalog.preview(await linked(sourceId), 7, 0);
      expect(preview.draft.columns[0]).toMatchObject({
        classification: 'Shared',
        classificationRef: ref,
      });
      await catalog.save(preview.draft, 7, 0);
    }
    await db.manager.update(EnterpriseClassification, 10, {
      name: 'Renamed',
      nameKey: key('Renamed'),
      version: 2,
      active: false,
    });
    await db.manager.update(EnterpriseMembership, 7, { organizationId: 2 });
    const spy = jest.spyOn(db.manager, 'findOne');
    for (const sourceId of [3, 4]) {
      const old = await draft(sourceId);
      expect(old.columns[0]).toMatchObject({ classification: 'Shared', classificationRef: ref });
      delete old.columns[0].classificationRef;
      delete old.columns[0].classification;
      await catalog.save({ ...old, description: 'unrelated edit' }, 7, 0);
      expect((await draft(sourceId)).columns[0]).toMatchObject({
        classification: 'Shared',
        classificationRef: ref,
      });
    }
    expect(spy.mock.calls.some(([entity]) => entity === EnterpriseClassification)).toBe(false);
    spy.mockRestore();
  });
  it('requires explicit latest selection for a rename and records ref-only changes as human strings', async () => {
    await catalog.save(await linked(), 7);
    await db.manager.update(EnterpriseClassification, 10, {
      name: 'Renamed',
      nameKey: key('Renamed'),
      version: 2,
    });
    const body = await draft();
    body.columns[0].classificationRef = { ...ref, version: 2 };
    const preview = await catalog.preview(body, 7);
    expect(preview.draft.columns[0].classification).toBe('Renamed');
    expect(preview.changes).toContainEqual({
      column: 'amount',
      field: 'classificationRef',
      before: JSON.stringify(ref),
      after: JSON.stringify({ ...ref, version: 2 }),
    });
    expect(
      preview.changes.every(change => change.before === null || typeof change.before === 'string'),
    ).toBe(true);
    await catalog.save(preview.draft, 7);
    expect(
      (await catalog.compare({ sourceId: 3, fromVersion: 1, toVersion: 2 }, 7)).changes,
    ).toEqual(preview.changes);
  });
  it('fills only newly selected columns without reinterpreting another column with the same historical ref', async () => {
    await catalog.save(await linked(), 7);
    const entry = await db.manager.findOneBy(SourceCatalogEntry, { sourceId: 3, version: 1 });
    const metadata = JSON.parse(entry.metadata);
    metadata.columns[0].classification = 'Historical label';
    await db.manager.update(
      SourceCatalogEntry,
      { sourceId: 3, version: 1 },
      { metadata: JSON.stringify(metadata) },
    );
    const body = await draft();
    body.columns[1].classificationRef = ref;
    const preview = await catalog.preview(body, 7);
    expect(preview.draft.columns[0].classification).toBe('Historical label');
    expect(preview.draft.columns[1].classification).toBe('Shared');
    await catalog.save(preview.draft, 7);
    expect((await draft()).columns[0].classification).toBe('Historical label');
  });
  it('keeps legacy free text editable, rejects bound text-only edits, and persists explicit null before later free edits', async () => {
    let body = await draft();
    body.columns[0].classification = 'Shared';
    await catalog.save(body, 7);
    body = await linked();
    const preview = await catalog.preview(body, 7);
    expect(preview.changes.map(change => change.field)).toEqual(['classificationRef']);
    await catalog.save(preview.draft, 7);
    body = await draft();
    delete body.columns[0].classificationRef;
    body.columns[0].classification = 'text-only edit';
    await expect(catalog.save(body, 7)).rejects.toMatchObject({ status: 400 });
    body = await draft();
    body.columns[0].classificationRef = null;
    const detached = await catalog.preview(body, 7);
    expect(detached.draft.columns[0]).toMatchObject({
      classification: 'Shared',
      classificationRef: null,
    });
    expect(detached.changes).toContainEqual({
      column: 'amount',
      field: 'classificationRef',
      before: JSON.stringify(ref),
      after: null,
    });
    await catalog.save(detached.draft, 7);
    body = await draft();
    body.columns[0].classification = 'Now free';
    await catalog.save(body, 7);
    expect((await draft()).columns[0]).toMatchObject({
      classification: 'Now free',
      classificationRef: null,
    });
  });
  it.each([
    'foreign',
    'inactive',
    'old version',
    'missing',
    'corrupt name',
    'corrupt hash',
    'C1 control',
  ])('fails closed for a new binding: %s', async variant => {
    const body = await linked();
    if (variant === 'foreign')
      body.columns[0].classificationRef = { ...ref, organizationId: 2, id: 20 };
    if (variant === 'inactive')
      await db.manager.update(EnterpriseClassification, 10, { active: false });
    if (variant === 'old version')
      await db.manager.update(EnterpriseClassification, 10, { version: 2 });
    if (variant === 'missing') body.columns[0].classificationRef = { ...ref, id: 999 };
    if (variant === 'corrupt name')
      await db.manager.update(EnterpriseClassification, 10, { name: ' Noncanonical ' });
    if (variant === 'corrupt hash')
      await db.manager.update(EnterpriseClassification, 10, { nameKey: 'x'.repeat(64) });
    if (variant === 'C1 control') {
      const name = 'Bad\u0085';
      await db.manager.update(EnterpriseClassification, 10, { name, nameKey: key(name) });
    }
    await expect(catalog.save(body, 7, 0)).rejects.toMatchObject({
      status: variant === 'foreign' ? 403 : 409,
    });
    expect(await db.manager.count(SourceCatalogEntry)).toBe(0);
  });
  it('does not grant source edit to a registry admin or a reader, but permits an explicitly granted editor', async () => {
    const body = await linked();
    await expect(catalog.preview(body, 8, 0)).rejects.toMatchObject({ status: 403 });
    await db.manager.save(EnterpriseResourceGrant, {
      resourceKind: 'source',
      resourceId: 3,
      recipientId: 9,
      ownerId: 7,
      organizationId: 1,
      version: 1,
      read: true,
      edit: false,
      publish: false,
      export: false,
    });
    await expect(catalog.preview(body, 9, 0)).rejects.toMatchObject({ status: 403 });
    await db.manager.update(
      EnterpriseResourceGrant,
      { resourceKind: 'source', resourceId: 3, recipientId: 9 },
      { edit: true },
    );
    await catalog.save(body, 9, 0);
    expect(
      (await db.manager.findOneBy(SourceCatalogEntry, { sourceId: 3, version: 1 })).actorId,
    ).toBe(9);
  });
  it.each(['classification', 'organization', 'epoch', 'inactive', 'source'])(
    'rechecks %s changes after schema/date SQL without writing',
    async change => {
      const body = await linked();
      body.columns[1] = { ...body.columns[1], businessType: 'date', dateFormat: 'YYYY-MM-DD' };
      bi.validateBusinessDates.mockImplementationOnce(async () => {
        if (change === 'classification')
          await db.manager.update(EnterpriseClassification, 10, { version: 2 });
        if (change === 'organization')
          await db.manager.update(EnterpriseMembership, 7, { organizationId: 2 });
        if (change === 'epoch') await db.manager.update(User, 7, { authVersion: 1 });
        if (change === 'inactive') await db.manager.update(User, 7, { active: false });
        if (change === 'source')
          await db.manager.update(Database, 3, { connectionConfig: '{"changed":true}' });
      });
      await expect(catalog.preview(body, 7, 0)).rejects.toMatchObject({
        status: change === 'epoch' ? 401 : change === 'inactive' ? 403 : 409,
      });
      expect(await db.manager.count(SourceCatalogEntry)).toBe(0);
    },
  );
  it('rejects spoofed epoch/body context before SQL and does not fallback on corrupt stored refs', async () => {
    const body = await linked();
    bi.profile.mockClear();
    await expect(catalog.save(body, 7, 1)).rejects.toMatchObject({ status: 401 });
    await expect(catalog.save({ ...body, authVersion: 0 }, 7, 0)).rejects.toMatchObject({
      status: 400,
    });
    expect(bi.profile).not.toHaveBeenCalled();
    await catalog.save(body, 7);
    const row = await db.manager.findOneBy(SourceCatalogEntry, { sourceId: 3, version: 1 });
    const metadata = JSON.parse(row.metadata);
    metadata.columns[0].classificationRef = { ...ref, version: '1' };
    await db.manager.update(
      SourceCatalogEntry,
      { sourceId: 3, version: 1 },
      { metadata: JSON.stringify(metadata) },
    );
    await expect(catalog.read({ sourceId: 3 }, 7)).rejects.toMatchObject({ status: 409 });
    await expect(catalog.save({ ...body, version: 1 }, 7)).rejects.toMatchObject({ status: 409 });
    expect(await db.manager.count(SourceCatalogEntry)).toBe(1);
  });
  it.each(['classification', 'organization', 'epoch', 'inactive'])(
    'rechecks %s after preparation at the final transaction, before append',
    async change => {
      const body = await linked();
      const prepare = (catalog as any).prepare.bind(catalog);
      jest.spyOn(catalog as any, 'prepare').mockImplementationOnce(async (...args: any[]) => {
        const prepared = await prepare(...args);
        if (change === 'classification')
          await db.manager.update(EnterpriseClassification, 10, { active: false });
        if (change === 'organization')
          await db.manager.update(EnterpriseMembership, 7, { organizationId: 2 });
        if (change === 'epoch') await db.manager.update(User, 7, { authVersion: 1 });
        if (change === 'inactive') await db.manager.update(User, 7, { active: false });
        return prepared;
      });
      await expect(catalog.save(body, 7, 0)).rejects.toMatchObject({
        status: change === 'epoch' ? 401 : change === 'inactive' ? 403 : 409,
      });
      expect(await db.manager.count(SourceCatalogEntry)).toBe(0);
    },
  );
  it('fences User and membership before Source, then sorts all new classification IDs', async () => {
    const body = await linked();
    body.columns[0].classificationRef = { ...ref, id: 11 };
    body.columns[1].classificationRef = ref;
    const transaction = db.transaction.bind(db);
    const reads: Array<{ entity: unknown; id: number }> = [];
    const spy = jest.spyOn(db, 'transaction').mockImplementation(((run: any) =>
      transaction(async manager => {
        const find = manager.findOne.bind(manager);
        const observe = jest.spyOn(manager, 'findOne').mockImplementation(((entity, options) => {
          reads.push({ entity, id: options?.where?.id });
          return find(entity, options);
        }) as any);
        try {
          return await run(manager);
        } finally {
          observe.mockRestore();
        }
      })) as any);
    try {
      await catalog.save(body, 7, 0);
    } finally {
      spy.mockRestore();
    }
    const first = (entity: unknown) => reads.findIndex(read => read.entity === entity);
    expect(first(User)).toBeLessThan(first(EnterpriseMembership));
    expect(first(EnterpriseMembership)).toBeLessThan(first(Database));
    expect(first(Database)).toBeLessThan(first(EnterpriseClassification));
    expect(
      reads.filter(read => read.entity === EnterpriseClassification).map(read => read.id),
    ).toEqual([10, 11]);
  });
  it('rolls back a failed append without changing the registry or older source history', async () => {
    await catalog.save(await linked(), 7);
    const previous = await db.manager.find(SourceCatalogEntry);
    await db.query(
      "CREATE TRIGGER reject_catalog BEFORE INSERT ON source_catalog_entry BEGIN SELECT RAISE(ABORT, 'fixture failure'); END",
    );
    const body = await draft();
    body.description = 'new';
    await expect(catalog.save(body, 7)).rejects.toThrow('fixture failure');
    expect(await db.manager.find(SourceCatalogEntry)).toEqual(previous);
    expect((await db.manager.findOneBy(EnterpriseClassification, { id: 10 })).version).toBe(1);
  });
  it('never observes rolled-back registry changes from an independent SQLite lease', async () => {
    const context = await catalogActorContext(db.manager, 7, 0);
    let release: () => void, started: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const ready = new Promise<void>(resolve => {
      started = resolve;
    });
    const writer = metadataTransaction(db, async manager => {
      await manager.update(EnterpriseClassification, 10, { active: false });
      started();
      await gate;
      throw new Error('rollback fixture');
    }).catch(error => error);
    await ready;
    let readDone = false;
    const reader = assertCatalogBindings(db.manager, context, [{ ref, name: 'Shared' }]).then(
      () => {
        readDone = true;
      },
    );
    await Promise.resolve();
    expect(readDone).toBe(false);
    release();
    await writer;
    await reader;
    expect(readDone).toBe(true);
    await serializeMetadataWork(db, async () =>
      expect((await db.manager.findOneBy(EnterpriseClassification, { id: 10 })).active).toBe(true),
    );
  });
  describe.each(['read', 'history', 'compare'] as const)('%s current read fence', method => {
    const request = () =>
      method === 'compare' ? { sourceId: 3, fromVersion: 1, toVersion: 2 } : { sourceId: 3 };
    it.each(['epoch', 'inactive', 'organization', 'permission'])(
      'rejects late %s changes after reading without returning historical refs',
      async change => {
        await catalog.save(await linked(), 7, 0);
        await catalog.save({ ...(await draft()), description: 'second' }, 7, 0);
        await db.manager.save(EnterpriseResourceGrant, {
          resourceKind: 'source',
          resourceId: 3,
          recipientId: 9,
          ownerId: 7,
          organizationId: 1,
          version: 1,
          read: true,
          edit: false,
          publish: false,
          export: false,
        });
        const guard = (catalog as any).readGuard.bind(catalog);
        const hook = jest
          .spyOn(catalog as any, 'readGuard')
          .mockImplementationOnce(async (...args: any[]) => {
            if (change === 'epoch') await db.manager.update(User, 9, { authVersion: 1 });
            if (change === 'inactive') await db.manager.update(User, 9, { active: false });
            if (change === 'organization')
              await db.manager.update(EnterpriseMembership, 9, { organizationId: 2 });
            if (change === 'permission')
              await db.manager.update(
                EnterpriseResourceGrant,
                { resourceKind: 'source', resourceId: 3, recipientId: 9 },
                { read: false },
              );
            return guard(...args);
          });
        const registry = jest.spyOn(db.manager, 'findOne');
        bi.profile.mockClear();
        try {
          await expect(catalog[method](request(), 9, 0)).rejects.toMatchObject({
            status: change === 'epoch' ? 401 : change === 'organization' ? 409 : 403,
          });
        } finally {
          hook.mockRestore();
        }
        expect(registry.mock.calls.some(([entity]) => entity === EnterpriseClassification)).toBe(
          false,
        );
        registry.mockRestore();
        if (method !== 'read') expect(bi.profile).not.toHaveBeenCalled();
        expect(await db.manager.count(SourceCatalogEntry)).toBe(2);
      },
    );
    it('rejects an already stale JWT epoch before any Source/profile SQL', async () => {
      bi.profile.mockClear();
      await expect(catalog[method](request(), 7, 1)).rejects.toMatchObject({ status: 401 });
      expect(bi.profile).not.toHaveBeenCalled();
      expect(await db.manager.count(SourceCatalogEntry)).toBe(0);
    });
  });
});
