import { DataSource } from 'typeorm';
import { AccessService } from './access.service';
import { InviteCode } from './entities/invite-code.entity';
import { WaitlistEntry } from './entities/waitlist-entry.entity';

const USAGE = `usage:
  access-cli invite create [--label TEXT] [--max-uses N] [--days N]
  access-cli invite list
  access-cli invite revoke <id>
  access-cli waitlist list [--status pending|approved|rejected]
  access-cli waitlist approve <id> [--days N]
  access-cli waitlist reject <id>`;

function flags(args: string[]): { positional: string[]; values: Record<string, string> } {
  const positional: string[] = [];
  const values: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 1) {
    if (args[i].startsWith('--')) {
      const value = args[i + 1];
      if (value === undefined || value.startsWith('--'))
        throw new Error(`${args[i]} needs a value`);
      values[args[i].slice(2)] = value;
      i += 1;
    } else positional.push(args[i]);
  }
  return { positional, values };
}

function positiveInteger(raw: string | undefined, name: string): number | undefined {
  if (raw === undefined) return undefined;
  if (!/^[1-9]\d*$/.test(raw)) throw new Error(`${name} must be a positive integer`);
  return Number(raw);
}

/** Operator commands. Codes are printed once, when they are created; only their hash is stored. */
export async function runAccessCommand(
  db: DataSource,
  argv: string[],
  write: (value: unknown) => void,
): Promise<void> {
  const [area, action, ...rest] = argv;
  const { positional, values } = flags(rest);
  const access = new AccessService();
  const invites = db.getRepository(InviteCode);
  const waitlist = db.getRepository(WaitlistEntry);

  if (area === 'invite' && action === 'create') {
    const created = await access.createInvite(db.manager, {
      label: values.label,
      maxUses: positiveInteger(values['max-uses'], 'max-uses'),
      days: positiveInteger(values.days, 'days'),
    });
    return write({ id: created.id, code: created.code, expiresAt: created.expiresAt });
  }
  if (area === 'invite' && action === 'list') {
    for (const invite of await invites.find({ order: { id: 'ASC' } }))
      write({
        id: invite.id,
        label: invite.label,
        used: `${invite.usedCount}/${invite.maxUses}`,
        expiresAt: invite.expiresAt,
        revokedAt: invite.revokedAt,
      });
    return;
  }
  if (area === 'invite' && action === 'revoke') {
    const id = positiveInteger(positional[0], 'id');
    if (!id) throw new Error('invite revoke needs an id');
    const result = await invites
      .createQueryBuilder()
      .update()
      .set({ revokedAt: new Date() })
      .where('id = :id AND revokedAt IS NULL', { id })
      .execute();
    return write({ id, revoked: result.affected === 1 });
  }
  if (area === 'waitlist' && action === 'list') {
    const status = values.status;
    if (status && !['pending', 'approved', 'rejected'].includes(status))
      throw new Error('status must be pending, approved or rejected');
    for (const entry of await waitlist.find({
      where: status ? { status: status as never } : {},
      order: { id: 'ASC' },
    }))
      write(entry);
    return;
  }
  if (area === 'waitlist' && (action === 'approve' || action === 'reject')) {
    const id = positiveInteger(positional[0], 'id');
    if (!id) throw new Error(`waitlist ${action} needs an id`);
    return db.transaction(async manager => {
      const entry = await manager.getRepository(WaitlistEntry).findOne({ where: { id } });
      if (!entry) throw new Error(`no waitlist entry ${id}`);
      if (entry.status !== 'pending') throw new Error(`entry ${id} is already ${entry.status}`);
      if (action === 'reject') {
        await manager
          .getRepository(WaitlistEntry)
          .update(id, { status: 'rejected', decidedAt: new Date() });
        return write({ id, status: 'rejected' });
      }
      const invite = await access.createInvite(manager, {
        label: entry.email,
        maxUses: 1,
        days: positiveInteger(values.days, 'days') ?? 14,
      });
      await manager
        .getRepository(WaitlistEntry)
        .update(id, { status: 'approved', inviteCodeId: invite.id, decidedAt: new Date() });
      write({
        id,
        email: entry.email,
        status: 'approved',
        code: invite.code,
        expiresAt: invite.expiresAt,
      });
    });
  }
  throw new Error(USAGE);
}

async function main(): Promise<void> {
  // Imported lazily so that tests of runAccessCommand do not open a connection.
  const { default: dataSource } = await import('../data-source');
  await dataSource.initialize();
  try {
    await runAccessCommand(dataSource, process.argv.slice(2), value =>
      console.log(JSON.stringify(value)),
    );
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy().catch(() => undefined);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
