import { createHash } from 'crypto';
import { Dashboard } from './entities/dashboard.entity';

/** Shared definition identity for edits and personal views; data refresh does not change it. */
export function dashboardRevision(dashboard: Dashboard): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        dashboard.id,
        dashboard.title,
        dashboard.layout ?? null,
        dashboard.analysisDefinition ?? null,
        dashboard.structuredDefinition ?? null,
        dashboard.delYn,
      ]),
    )
    .digest('hex');
}
