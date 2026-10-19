import * as fs from 'fs/promises';
import * as path from 'path';
import { constants, Dir } from 'fs';
import { EntityManager } from 'typeorm';
import { Database } from '../database/entities/database.entity';
import { Metric } from '../metric/entities/metric.entity';
import { SourceCatalogEntry } from '../bi/entities/source-catalog-entry.entity';
import { SourceConditionEntry } from '../bi/entities/source-condition-entry.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { TableQuery } from '../widget/tabel-query/entity/table-query.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { StudioState } from '../dashboard-studio/entities/studio-state.entity';
import { StudioExecution } from '../dashboard-studio/entities/studio-execution.entity';
import { PersonalView } from '../dashboard/entities/personal-view.entity';
import { ExploreView } from '../bi/entities/explore-view.entity';
import { DashboardPublication } from '../dashboard/entities/dashboard-publication.entity';
import { StudioPublication } from '../dashboard-studio/entities/studio-publication.entity';
import { ExportJob } from '../bi/entities/export-job.entity';
import { FileRefresh } from '../database/entities/file-refresh.entity';
import { SourceDeleteReceipt } from '../database/entities/source-delete-receipt.entity';
import { EnterpriseResourceGrant } from './entities/enterprise-resource-grant.entity';
import { EnterpriseGroupGrant } from './entities/enterprise-group.entity';
import { custodyMetadata, custodyRefresh, inspectHandoverCustody } from './handover-custody';
import { transferHash } from './handover-transfer-basis';
import { resolveDeletionFilename } from '../analysis/source-file-deletion';
import { parseConnectionConfig } from '../utils/crypto.util';
const positive = (v: any) => Number.isSafeInteger(v) && v > 0 && v < 2147483647;
const object = (v: any) => v && typeof v === 'object' && !Array.isArray(v);
const root = () => path.resolve(process.env.FILE_UPLOAD_DIR || 'uploads');

/** Bounded read-only admission inspection. No cleanup, arbitrary traversal, or input reads. */
async function admissions(owner: number) {
  const result = [];
  const stamp = (stat: any) =>
    [stat.dev, stat.ino, stat.mode, stat.size, stat.mtimeNs, stat.ctimeNs].map(String).join(':');
  const checkedDirectory = async (filename: string) => {
    const stat = await fs.lstat(filename, { bigint: true });
    if (!stat.isDirectory() || stat.isSymbolicLink() || (await fs.realpath(filename)) !== filename)
      throw new Error();
    return stamp(stat);
  };
  let directory: Dir;
  let directoryPath: string, rootPath: string, initialRoot: string, initialDirectory: string;
  try {
    // Reuse the managed-root ancestor/OS-alias rules; the synthetic anchor is never opened.
    const canonical = await resolveDeletionFilename(
      root(),
      path.join(root(), '00000000-0000-0000-0000-000000000000', 'data.duckdb'),
      'duckdb',
    );
    rootPath = canonical.root;
    initialRoot = await checkedDirectory(rootPath);
    directoryPath = path.join(rootPath, 'refresh-input');
    initialDirectory = await checkedDirectory(directoryPath);
    directory = await fs.opendir(directoryPath);
    if ((await checkedDirectory(directoryPath)) !== initialDirectory) {
      await directory.close();
      return ['unresolved'];
    }
  } catch (e) {
    if (e.code === 'ENOENT' && rootPath && initialRoot && !initialDirectory) {
      try {
        if ((await checkedDirectory(rootPath)) === initialRoot) return [];
      } catch {
        /* changed root */
      }
    }
    return ['unresolved'];
  }
  try {
    let count = 0;
    for await (const entry of directory) {
      if (++count > 2000 || !entry.isDirectory() || !/^[a-f0-9-]{36}$/.test(entry.name))
        return ['unresolved'];
      const child = path.join(directoryPath, entry.name);
      const childIdentity = await checkedDirectory(child);
      const markerPath = path.join(child, 'admission.json');
      let handle: fs.FileHandle;
      try {
        const before = await fs.lstat(markerPath, { bigint: true });
        if (!before.isFile() || before.isSymbolicLink() || before.size > BigInt(512))
          return ['unresolved'];
        handle = await fs.open(markerPath, constants.O_RDONLY | constants.O_NOFOLLOW);
        if (stamp(await handle.stat({ bigint: true })) !== stamp(before)) return ['unresolved'];
        const buffer = Buffer.alloc(513);
        let length = 0;
        while (length < buffer.length) {
          const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length);
          if (!bytesRead) break;
          length += bytesRead;
        }
        if (length > 512 || stamp(await handle.stat({ bigint: true })) !== stamp(before))
          return ['unresolved'];
        const marker = JSON.parse(buffer.subarray(0, length).toString('utf8'));
        if (!positive(marker.actorId)) return ['unresolved'];
        if (marker.actorId === owner) result.push({ id: entry.name, marker });
        if (
          (await checkedDirectory(child)) !== childIdentity ||
          stamp(await fs.lstat(markerPath, { bigint: true })) !== stamp(before)
        )
          return ['unresolved'];
      } catch {
        return ['unresolved'];
      } finally {
        await handle?.close();
      }
    }
    if (
      (await checkedDirectory(rootPath)) !== initialRoot ||
      (await checkedDirectory(directoryPath)) !== initialDirectory
    )
      return ['unresolved'];
  } catch {
    return ['unresolved'];
  }
  return result;
}

/** Explicit references only; finite scans fail closed without returning unselected identities. */
export async function inspectSourceHandover(
  manager: EntityManager,
  manifest: any[],
  locked: boolean,
) {
  const blockers = new Set<string>();
  if (manifest.some(a => a.kind !== 'source')) blockers.add('mixed_assets');
  const selected = manifest.filter(a => a.kind === 'source').sort((a, b) => a.id - b.id);
  const ids = new Set(selected.map(a => a.id));
  const read = async (entity: any, options: any = {}) => {
    const rows: any[] = await manager.find(entity, { ...options, take: 2001 });
    if (rows.length > 2000) blockers.add('source_in_use');
    return rows.slice(0, 2000);
  };
  const related = (value: any) => {
    if (!positive(value)) {
      blockers.add('source_in_use');
      return false;
    }
    return ids.has(value);
  };
  const parse = (text: string, run: (v: any) => void) => {
    try {
      run(JSON.parse(text));
    } catch {
      blockers.add('source_in_use');
    }
  };
  const boards = await read(Dashboard, { order: { id: 'ASC' } });
  for (const board of boards) {
    for (const [text, key] of [
      [board.analysisDefinition, 'databaseId'],
      [board.structuredDefinition, 'sourceId'],
    ])
      if (text)
        parse(text, v => {
          if (related(v?.[key])) blockers.add('source_in_use');
        });
    if (board.pivotDefinitions)
      parse(board.pivotDefinitions, v => {
        if (!Array.isArray(v)) throw new Error();
        for (const p of v) if (related(p?.sourceId)) blockers.add('source_in_use');
      });
  }
  const studio = await read(StudioState, { order: { dashboardId: 'ASC' } });
  for (const state of studio)
    parse(state.document, v => {
      if (related(v?.document?.sourceId)) blockers.add('source_in_use');
    });
  const executions = await read(StudioExecution, { order: { runId: 'ASC' } });
  for (const execution of executions)
    if (!['succeeded', 'unsupported', 'cancelled'].includes(execution.status))
      parse(execution.state, v => {
        if (!positive(v?.request?.document?.sourceId) || ids.has(v.request.document.sourceId))
          blockers.add('running_work');
      });
  const rows: Database[] = [],
    sources = [],
    details = [],
    proofs = [];
  const consumerMetadata = await custodyMetadata(manager);
  for (const asset of selected) {
    const source = await manager.findOneBy(Database, { id: asset.id });
    rows.push(source);
    let config: any;
    try {
      config = parseConnectionConfig(source.connectionConfig);
    } catch {
      blockers.add('unsupported_source');
    }
    if (
      source.engine !== 'duckdb' ||
      source.type !== 'duckdb' ||
      !object(config) ||
      config.fileModel
    )
      blockers.add('unsupported_source');
    if (
      !Number.isSafeInteger(source.catalogVersion) ||
      source.catalogVersion < 0 ||
      source.catalogVersion >= 2147483647
    )
      blockers.add('asset_version_limit');
    const metrics = await read(Metric, {
      where: { databaseId: source.id },
      order: { id: 'ASC' },
      ...(locked && manager.connection.options.type === 'mysql'
        ? { lock: { mode: 'pessimistic_write' } }
        : {}),
    });
    const visit = (definition: any, depth = 0) => {
      if (
        !object(definition) ||
        definition.schemaVersion !== 1 ||
        definition.sourceId !== source.id ||
        !positive(definition.definitionVersion) ||
        depth > 1
      )
        throw new Error();
      if (definition.aggregation === 'FORMULA') {
        if (!Array.isArray(definition.formula?.operands) || definition.formula.operands.length > 6)
          throw new Error();
        for (const operand of definition.formula.operands) {
          const child = metrics.find(m => m.id === operand.id);
          if (
            !child ||
            transferHash(JSON.parse(child.definition)) !== transferHash(operand.definition) ||
            operand.definitionVersion !== operand.definition.definitionVersion
          )
            throw new Error();
          visit(operand.definition, depth + 1);
        }
      }
    };
    for (const metric of metrics)
      try {
        if (metric.definition) visit(JSON.parse(metric.definition));
        else if (
          metric.tableName !== 'uploaded_data' ||
          !['SUM', 'AVG', 'COUNT', 'MIN', 'MAX', 'COUNT_DISTINCT'].includes(metric.aggregation) ||
          !/^(\*|[A-Za-z_][A-Za-z0-9_]*)$/.test(metric.expression) ||
          metric.filters ||
          metric.groupBy
        )
          throw new Error();
      } catch {
        blockers.add('unsupported_source');
      }
    const catalogs = await read(SourceCatalogEntry, {
      where: { sourceId: source.id },
      order: { version: 'ASC' },
    });
    const conditions = await read(SourceConditionEntry, {
      where: { sourceId: source.id },
      order: { version: 'ASC' },
    });
    for (const row of [...catalogs, ...conditions])
      try {
        if (!object(JSON.parse(row.metadata ?? row.definition))) throw new Error();
      } catch {
        blockers.add('unsupported_source');
      }
    const grants = await read(EnterpriseResourceGrant, {
      where: { resourceKind: 'source', resourceId: source.id },
      order: { recipientId: 'ASC' },
    });
    const groupGrants = await read(EnterpriseGroupGrant, {
      where: { resourceKind: 'source', resourceId: source.id },
      order: { groupId: 'ASC' },
    });
    if ([...grants, ...groupGrants].some(g => g.read || g.edit || g.publish || g.export))
      blockers.add('active_permissions');
    const uses = [];
    for (const [entity, field] of [
      [Dataset, 'databaseId'],
      [TableQuery, 'databaseId'],
      [PersonalView, 'sourceId'],
      [ExploreView, 'sourceId'],
    ] as const) {
      const count = await manager.count(entity as any, { where: { [field]: source.id } });
      uses.push(count);
      if (count) blockers.add('source_in_use');
    }
    const legacy = await read(DashboardPublication, {
      where: { sourceId: source.id },
      order: { dashboardId: 'ASC' },
    });
    const published = await read(StudioPublication, {
      where: { sourceId: source.id },
      order: { token: 'ASC' },
    });
    if (legacy.some(p => p.active) || published.some(p => !p.revokedAt))
      blockers.add('source_in_use');
    const exports = await read(ExportJob, { where: { sourceId: source.id }, order: { id: 'ASC' } });
    if (
      exports.some(
        e =>
          e.attemptToken !== null ||
          e.leaseUntil !== null ||
          ['queued', 'running'].includes(e.status) ||
          (e.status === 'ready' && e.expiresAt.getTime() > Date.now()) ||
          !['queued', 'running', 'ready', 'failed', 'cancelled'].includes(e.status),
      )
    )
      blockers.add('running_work');
    const refresh = await read(FileRefresh, {
      where: { sourceId: source.id },
      order: { id: 'ASC' },
    });
    if (
      refresh.some(
        r =>
          r.inputRetained ||
          r.leaseToken !== null ||
          r.leaseUntil !== null ||
          !['succeeded', 'failed', 'interrupted', 'cancelled'].includes(r.status),
      )
    )
      blockers.add('running_work');
    const cleanup = await read(SourceDeleteReceipt, {
      where: { sourceId: source.id },
      order: { id: 'ASC' },
    });
    if (
      cleanup.some(
        c =>
          c.cleanupStatus !== 'complete' ||
          c.cleanupAttempt !== null ||
          c.cleanupLeaseUntil !== null,
      )
    )
      blockers.add('running_work');
    const staged = await admissions(source.ownerId);
    if (
      staged.some(
        (a: any) =>
          typeof a === 'string' || !positive(a.marker.sourceId) || a.marker.sourceId === source.id,
      )
    )
      blockers.add('running_work');
    const custody: any = await inspectHandoverCustody(
      source,
      consumerMetadata,
      await custodyRefresh(manager, source.id),
      true,
    );
    if (
      custody.storage !== 'managed_file' ||
      custody.identity !== 'observed' ||
      custody.consumers === 'unresolved' ||
      !custody.custodySignature
    )
      blockers.add('file_unresolved');
    if (custody.consumers === 'present') blockers.add('file_shared');
    if (custody.refresh !== 'none_observed') blockers.add('running_work');
    sources.push({
      id: source.id,
      title: asset.title,
      filesChecked: custody.filesChecked,
      metricCount: metrics.length,
    });
    proofs.push(custody.custodySignature ?? null);
    details.push({
      source,
      metrics,
      catalogs,
      conditions,
      grants,
      groupGrants,
      uses,
      legacy,
      published,
      exports,
      refresh,
      cleanup,
      staged,
      custody,
    });
  }
  return {
    blockers: [...blockers].sort(),
    sources,
    rows,
    custodyHash: transferHash(proofs),
    hash: transferHash({ details, boards, studio, executions, consumerMetadata }),
  };
}
