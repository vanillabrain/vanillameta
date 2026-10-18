import {
  EnterpriseGroup,
  EnterpriseGroupMember,
  EnterpriseGroupGrant,
} from './entities/enterprise-group.entity';
import { EnterpriseDashboardDelivery } from './entities/enterprise-dashboard-delivery.entity';
jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StudioService } from '../dashboard-studio/studio.service';
import { SourceAccessService } from '../ownership/source-access.service';
import { User } from '../user/entities/user.entity';
import { Database } from '../database/entities/database.entity';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { EnterpriseResourceGrant } from './entities/enterprise-resource-grant.entity';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';
import { EnterpriseResourcePolicyService } from './resource-policy.service';
import { SourceLifecycleService } from './source-lifecycle.service';
const gate = () => {
  let resolve: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve: () => resolve() };
};

describe('NFR005 reads committed authentication and availability', () => {
  let db: DataSource;
  const previous = process.env.ACCESS_SECRET;
  beforeEach(async () => {
    process.env.ACCESS_SECRET = 'sqlite-committed-auth-synthetic';
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [
        User,
        Database,
        EnterpriseMembership,
        EnterpriseResourceGrant,
        EnterpriseGroup,
        EnterpriseGroupMember,
        EnterpriseGroupGrant,
        EnterpriseDashboardDelivery,
        EnterpriseAuditEvent,
      ],
    }).initialize();
    await db.getRepository(User).save([
      { id: 1, userId: 'owner', email: 'owner@example.invalid', password: 'hash', active: true },
      { id: 2, userId: 'reader', email: 'reader@example.invalid', password: 'hash', active: true },
    ]);
    await db.getRepository(EnterpriseMembership).save([
      { userId: 1, organizationId: 1, role: 'admin', team: '' },
      { userId: 2, organizationId: 1, role: 'member', team: '' },
    ]);
    await db.getRepository(Database).save({
      id: 1,
      ownerId: 1,
      name: 'Source',
      engine: 'duckdb',
      type: 'FILE',
      connectionConfig: '{}',
      catalogActive: false,
    });
    await db.getRepository(EnterpriseResourceGrant).save({
      resourceKind: 'source',
      resourceId: 1,
      recipientId: 2,
      organizationId: 1,
      ownerId: 1,
      version: 1,
      read: true,
      edit: false,
      publish: false,
      export: false,
    });
  });
  afterEach(async () => {
    await db.destroy();
    if (previous === undefined) delete process.env.ACCESS_SECRET;
    else process.env.ACCESS_SECRET = previous;
  });
  it('does not expose uncommitted activation or reject a token for an activation change that rolls back', async () => {
    const policy = new EnterpriseResourcePolicyService(db),
      access = new SourceAccessService(db, policy),
      lifecycle = new SourceLifecycleService(db, policy);
    const studio = new StudioService(db, {} as any, {} as any, access),
      entered = gate(),
      release = gate(),
      jwt = new JwtService();
    const token = jwt.sign(
      { accessKeyData: { id: 1, userId: 'owner', authVersion: 0 } },
      { secret: process.env.ACCESS_SECRET },
    );
    const guard = new JwtAuthGuard(jwt, db);
    const write = studio
      .serializeWrite(() =>
        db.transaction(async manager => {
          await manager.update(Database, 1, { catalogActive: true });
          await manager.update(User, 1, { active: false });
          entered.resolve();
          await release.promise;
          throw new Error('expected rollback');
        }),
      )
      .catch(error => error);
    await entered.promise;
    let completed = 0;
    const allowed = access
      .assert('database', 1, 2, 'read')
      .then(
        () => 200,
        error => error.status,
      )
      .then(value => {
        completed++;
        return value;
      });
    const auth = guard
      .validate(token, true)
      .then(
        value => value.accessKeyData.id,
        error => error.status,
      )
      .then(value => {
        completed++;
        return value;
      });
    const state = lifecycle
      .read(1, 1)
      .then(
        value => value.active,
        error => error.status,
      )
      .then(value => {
        completed++;
        return value;
      });
    let early: number;
    try {
      await Promise.race([
        Promise.all([allowed, auth, state]),
        new Promise(resolve => setTimeout(resolve, 150)),
      ]);
      early = completed;
    } finally {
      release.resolve();
      await write;
    }
    expect(early).toBe(0);
    expect(await Promise.all([allowed, auth, state])).toEqual([403, 1, false]);
  });
});
