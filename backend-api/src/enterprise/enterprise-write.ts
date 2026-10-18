import { DataSource } from 'typeorm';
import { serializeMetadataWork } from '../common/metadata-work';
/** Organization/grant/state work participates in the shared SQLite metadata boundary. */
export function serializeEnterpriseWrite<T>(db: DataSource, run: () => Promise<T>): Promise<T> {
  return serializeMetadataWork(db, run);
}
