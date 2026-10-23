import { HEADERS_METADATA } from '@nestjs/common/constants';
import { DatabaseController } from '../database/database.controller';
import { DatasetController } from '../dataset/dataset.controller';

/**
 * A handler that sets `Transfer-Encoding: chunked` itself and then answers an error with
 * res.json() sends Content-Length and Transfer-Encoding together. nginx rejects that upstream
 * response and the client sees a 502 instead of the 500 body. Node chunks a piped stream on its own.
 */
describe('NDJSON streaming handlers', () => {
  const handlers: Array<[string, object]> = [
    [
      'DatabaseController.executeStreamingQuery',
      DatabaseController.prototype.executeStreamingQuery,
    ],
    ['DatasetController.streamQuery', DatasetController.prototype.streamQuery],
  ];

  it.each(handlers)('%s declares NDJSON and does not set Transfer-Encoding', (_name, handler) => {
    const headers: Array<{ name: string; value: string }> =
      Reflect.getMetadata(HEADERS_METADATA, handler) ?? [];
    expect(headers.find(header => header.name === 'Content-Type')?.value).toBe(
      'application/x-ndjson',
    );
    expect(headers.map(header => header.name.toLowerCase())).not.toContain('transfer-encoding');
  });
});
