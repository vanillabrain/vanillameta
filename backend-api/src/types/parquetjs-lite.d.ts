declare module 'parquetjs-lite' {
  interface ParquetCursor {
    next(): Promise<Record<string, unknown> | null>;
  }
  interface ParquetReader {
    getCursor(): ParquetCursor;
    close(): Promise<void>;
  }
  interface ParquetWriter {
    appendRow(row: Record<string, unknown>): Promise<void>;
    close(): Promise<void>;
  }
  export const ParquetReader: {
    openBuffer(buffer: Buffer): Promise<ParquetReader>;
  };
  export const ParquetWriter: {
    openFile(schema: ParquetSchema, path: string): Promise<ParquetWriter>;
  };
  export class ParquetSchema {
    constructor(fields: Record<string, { type: string }>);
  }
}
