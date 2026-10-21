import { User } from '../../src/user/entities/user.entity';
import { EnterpriseMembership } from '../../src/enterprise/entities/enterprise-membership.entity';

/** Explicit current, organization-less account for legacy repository-only analytical fixtures. */
export function installCatalogActorFixture(db: any, actorId: number, authVersion = 0) {
  const prior = db.manager;
  const priorFind = prior?.findOne?.bind(prior);
  db.options ??= { type: 'sqlite' };
  db.manager = {
    ...prior,
    connection: db,
    getRepository: (entity: any) => db.getRepository(entity),
    findOne: async (entity: any, options: any) => {
      if (entity === User)
        return options.where.id === actorId ? { id: actorId, active: true, authVersion } : null;
      if (entity === EnterpriseMembership) return null;
      if (priorFind) return priorFind(entity, options);
      return db.getRepository(entity).findOne(options);
    },
  };
  return db;
}
