import { Repository } from 'typeorm';
import { serializeMetadataWork } from '../common/metadata-work';
/** Source/dashboard views share the same connection boundary as Studio and enterprise work. */
export function serializedViewWrite<T>(
  repository: Repository<any>,
  operation: () => Promise<T>,
): Promise<T> {
  return serializeMetadataWork(repository.manager.connection, operation);
}
