import {
  BadRequestException,
  Injectable,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Worker } from 'worker_threads';
import { createHash, randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import { createReadStream, existsSync } from 'fs';
import * as path from 'path';
import { CommerceImportInput, CommerceImportResult } from './commerce-import';

export type AnalysisUpload = {
  originalname: string;
  path?: string;
  buffer?: Buffer;
  size?: number;
};
export type AnalysisImport = { filename: string; sourcePath: string; rows: number };
export type AnalysisCommerceImport = {
  filename: string;
  rows: Record<string, number>;
  summary?: CommerceImportResult['summary'];
  validation: {
    valid: boolean;
    errors: CommerceImportResult['errors'];
    errorCount: number;
    helpErrorCode?: CommerceImportResult['helpErrorCode'];
  };
  sampleType: CommerceImportResult['sampleType'];
};
const positive = (value: string, fallback: number) => {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
};

/** One lazily started worker owns all DuckDB work; no Redis or separate daemon required. */
@Injectable()
export class DuckDBService implements OnModuleDestroy {
  private worker: Worker;
  private queue: any[] = [];
  private active: any;
  private closing = false;
  private restarting = false;

  private root() {
    return path.resolve(process.env.FILE_UPLOAD_DIR || 'uploads');
  }

  private managed(filename: string) {
    const relative = path.relative(this.root(), path.resolve(filename));
    if (!/^[0-9a-f-]{36}[\\/]data\.duckdb$/.test(relative)) {
      throw new BadRequestException('invalid managed analysis file');
    }
    return path.resolve(filename);
  }

  private async manifest(directory: string, state: Record<string, unknown>) {
    const temporary = path.join(directory, 'import.json.tmp');
    await fs.writeFile(
      temporary,
      JSON.stringify({ ...state, updatedAt: new Date().toISOString() }),
      { mode: 0o600 },
    );
    await fs.rename(temporary, path.join(directory, 'import.json'));
  }

  private async directoryBytes(directory: string): Promise<number> {
    let bytes = 0;
    try {
      for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        const filename = path.join(directory, entry.name);
        if (entry.isDirectory()) bytes += await this.directoryBytes(filename);
        else if (entry.isFile()) {
          try {
            bytes += (await fs.stat(filename)).size;
          } catch (error) {
            if (error.code !== 'ENOENT') throw error;
          }
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    return bytes;
  }

  private async checkImportStorage(job: any) {
    if ((await this.directoryBytes(path.dirname(job.filename))) > job.maxStorageBytes) {
      throw new Error(`analysis import storage exceeds ${job.maxStorageBytes} bytes`);
    }
  }

  async importFile(file: AnalysisUpload): Promise<AnalysisImport> {
    const extension = path.extname(file?.originalname || '').toLowerCase();
    if (!['.csv', '.json', '.parquet'].includes(extension)) {
      if (file?.path) await fs.rm(file.path, { force: true });
      throw new BadRequestException('unsupported file extension');
    }
    const size = file.path ? (await fs.stat(file.path)).size : file.buffer?.length;
    if (!size) {
      if (file.path) await fs.rm(file.path, { force: true });
      throw new BadRequestException('file is required');
    }
    if (size > positive(process.env.FILE_UPLOAD_MAX_BYTES, 512 * 1024 * 1024)) {
      if (file.path) await fs.rm(file.path, { force: true });
      throw new BadRequestException('file size limit exceeded');
    }
    const directory = path.join(this.root(), randomUUID());
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const sourcePath = path.join(directory, `source${extension}`);
    const filename = path.join(directory, 'data.duckdb');
    try {
      if (file.path) await fs.rename(file.path, sourcePath);
      else await fs.writeFile(sourcePath, file.buffer, { mode: 0o600 });
      await fs.chmod(sourcePath, 0o600);
      await this.manifest(directory, { status: 'importing', originalname: file.originalname });
      const task = {
        kind: 'import',
        filename,
        sourcePath,
        extension,
        maxStorageBytes: positive(process.env.ANALYSIS_MAX_STORAGE_BYTES, 2 * 1024 * 1024 * 1024),
      };
      await this.checkImportStorage(task);
      const result = await this.submit(task, positive(process.env.FILE_IMPORT_TIMEOUT_MS, 300000));
      await fs.chmod(filename, 0o600);
      await this.manifest(directory, {
        status: 'ready',
        originalname: file.originalname,
        rows: result.rows,
      });
      return { filename, sourcePath, rows: result.rows };
    } catch (error) {
      await fs.rm(directory, { force: true, recursive: true });
      if (file.path) await fs.rm(file.path, { force: true });
      throw new BadRequestException(error.message || 'file import failed');
    }
  }

  /** Import the normalized commerce CSV bundle into a managed DuckDB file. */
  async importCommerce(input: CommerceImportInput): Promise<AnalysisCommerceImport> {
    const files = input?.files;
    if (!files?.orders || !files?.payments || !files?.refunds) {
      throw new BadRequestException('orders, payments and refunds CSV files are required');
    }
    const sources = [
      { name: 'orders.csv', path: files.orders },
      { name: 'payments.csv', path: files.payments },
      { name: 'refunds.csv', path: files.refunds },
      ...(files.customers ? [{ name: 'customers.csv', path: files.customers }] : []),
    ];
    const storageRoot = await fs.realpath(this.root());
    const uploadMaxBytes = positive(process.env.FILE_UPLOAD_MAX_BYTES, 512 * 1024 * 1024);
    const maxStorageBytes = positive(
      process.env.ANALYSIS_MAX_STORAGE_BYTES,
      2 * 1024 * 1024 * 1024,
    );
    let bundleBytes = 0;
    for (const source of sources) {
      const resolved = path.resolve(source.path);
      const realFilename = await fs.realpath(resolved).catch(() => undefined);
      if (!realFilename) throw new BadRequestException('commerce source file is missing or empty');
      const relative = path.relative(storageRoot, realFilename);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new BadRequestException(
          'commerce source files must be inside managed upload storage',
        );
      }
      const stat = await fs.stat(realFilename).catch(() => undefined);
      if (!stat?.isFile() || stat.size === 0) {
        throw new BadRequestException('commerce source file is missing or empty');
      }
      if (stat.size > uploadMaxBytes) {
        throw new BadRequestException(`${source.name} exceeds the per-file upload limit`);
      }
      source.path = realFilename;
      bundleBytes += stat.size;
    }
    if (bundleBytes > maxStorageBytes) {
      throw new BadRequestException('commerce source bundle exceeds the analysis storage limit');
    }
    const directory = path.join(this.root(), randomUUID());
    try {
      await fs.mkdir(directory, { recursive: true, mode: 0o700 });
      for (const source of sources) {
        const managedCopy = path.join(directory, source.name);
        await fs.copyFile(source.path, managedCopy);
        await fs.chmod(managedCopy, 0o600);
        source.path = managedCopy;
      }
      const filename = path.join(directory, 'data.duckdb');
      const task = {
        kind: 'commerce-import',
        filename,
        sourcePaths: [
          sources[0].path,
          sources[1].path,
          sources[2].path,
          files.customers ? sources[3].path : undefined,
        ],
        sampleType: input.sampleType,
        maxStorageBytes,
      };
      await this.manifest(directory, { status: 'validating', kind: 'commerce' });
      await this.checkImportStorage(task);
      const result = await this.submit(task, positive(process.env.FILE_IMPORT_TIMEOUT_MS, 300000));
      await fs.chmod(filename, 0o600);
      await this.manifest(directory, {
        status: result.valid ? 'ready' : 'validation_failed',
        kind: 'commerce',
        ...result,
      });
      return {
        filename,
        rows: result.counts,
        summary: result.summary,
        validation: {
          valid: result.valid,
          errors: result.errors,
          errorCount: result.errorCount,
          ...(result.helpErrorCode ? { helpErrorCode: result.helpErrorCode } : {}),
        },
        sampleType: result.sampleType,
      };
    } catch (error) {
      await fs.rm(directory, { force: true, recursive: true });
      throw new BadRequestException(error.message || 'commerce import failed');
    }
  }

  private async digestPath(filename: string) {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(filename)) hash.update(chunk);
    return hash.digest('hex');
  }

  async uploadDigest(file: AnalysisUpload) {
    if (
      !['.csv', '.json', '.parquet'].includes(path.extname(file?.originalname || '').toLowerCase())
    )
      throw new BadRequestException('unsupported file extension');
    const size = file.path ? (await fs.stat(file.path)).size : file.buffer?.length;
    if (!size) throw new BadRequestException('file is required');
    if (size > positive(process.env.FILE_UPLOAD_MAX_BYTES, 512 * 1024 * 1024))
      throw new BadRequestException('file size limit exceeded');
    return file.path
      ? this.digestPath(file.path)
      : createHash('sha256').update(file.buffer).digest('hex');
  }

  async sourceDigest(filename: string) {
    const directory = path.dirname(this.managed(filename));
    const source = ['.csv', '.json', '.parquet']
      .map(ext => path.join(directory, 'source' + ext))
      .find(candidate => existsSync(candidate));
    if (!source) throw new BadRequestException('보관된 원본 파일을 찾을 수 없습니다.');
    return this.digestPath(source);
  }

  async registerImport(filename: string, databaseId: number) {
    const directory = path.dirname(this.managed(filename));
    const existing = JSON.parse(await fs.readFile(path.join(directory, 'import.json'), 'utf8'));
    await this.manifest(directory, { ...existing, databaseId });
  }

  async removeImport(filename: string) {
    await this.submit(
      { kind: 'remove', filename: this.managed(filename) },
      positive(process.env.FILE_IMPORT_TIMEOUT_MS, 300000),
    );
  }

  /** Only for a settled import never registered in metadata; no query can reference it. */
  async discardImport(filename: string) {
    await fs.rm(path.dirname(this.managed(filename)), { recursive: true, force: true });
  }

  async query(filename: string, sql: string, bindings: any[] = []) {
    // This guard is independent of QUERY_ALLOW_WRITE. DuckDB files are never user-writable.
    const cleaned = String(sql || '')
      .trim()
      .replace(/;+\s*$/, '');
    if (!/^(SELECT|WITH|SHOW|DESCRIBE|DESC|EXPLAIN)\b/i.test(cleaned) || cleaned.includes(';')) {
      throw new BadRequestException('only read-only queries are allowed');
    }
    filename = this.managed(filename);
    await fs.access(filename); // Opening a missing file must not create an empty database.
    return this.submit(
      {
        kind: 'query',
        filename,
        sql: cleaned,
        bindings,
        maxRows: positive(process.env.ANALYSIS_MAX_RESULT_ROWS, 10000),
      },
      positive(process.env.QUERY_TIMEOUT_MS, 60000),
    );
  }

  private submit(task: any, timeout: number): Promise<any> {
    if (this.closing || this.queue.length >= positive(process.env.ANALYSIS_MAX_QUEUE, 16)) {
      return Promise.reject(new ServiceUnavailableException('analysis worker busy; retry later'));
    }
    return new Promise((resolve, reject) => {
      const job = { ...task, id: randomUUID(), resolve, reject, timer: null };
      // Includes time spent waiting: requests cannot wait forever behind imports.
      job.timer = setTimeout(() => {
        if (this.active === job) this.failWorker(new Error('analysis task timeout'));
        else {
          this.queue = this.queue.filter(item => item !== job);
          reject(new Error('analysis queue timeout'));
        }
      }, timeout);
      this.queue.push(job);
      this.pump();
    });
  }

  private pump() {
    if (this.closing || this.restarting || this.active || !this.queue.length) return;
    if (!this.worker) {
      const compiled = path.join(__dirname, 'duckdb.worker.js');
      const worker = existsSync(compiled)
        ? new Worker(compiled)
        : new Worker(path.join(__dirname, 'duckdb.worker.ts'), {
            execArgv: ['-r', require.resolve('ts-node/register/transpile-only')],
          });
      this.worker = worker;
      worker.on('message', async message => {
        if (this.worker !== worker || this.active?.id !== message.id) return;
        const job = this.active;
        clearInterval(job.storageTimer);
        if (['import', 'commerce-import'].includes(job.kind) && !message.error) {
          try {
            await this.checkImportStorage(job);
          } catch (error) {
            if (this.active === job) this.failWorker(error);
            return;
          }
          if (this.worker !== worker || this.active !== job) return;
        }
        this.active = undefined;
        clearTimeout(job.timer);
        if (message.error) job.reject(new Error(message.error));
        else job.resolve(message.result);
        this.pump();
      });
      worker.on('error', error => {
        if (this.worker === worker) this.failWorker(error);
      });
      worker.on('exit', () => {
        if (this.worker === worker) this.failWorker(new Error('analysis worker exited'));
      });
    }
    this.active = this.queue.shift();
    const job = this.active;
    if (['import', 'commerce-import'].includes(job.kind)) {
      let checking = false;
      job.storageTimer = setInterval(async () => {
        if (checking || this.active !== job) return;
        checking = true;
        try {
          await this.checkImportStorage(job);
        } catch (error) {
          if (this.active === job) this.failWorker(error);
        } finally {
          checking = false;
        }
      }, 250);
    }
    const task = { ...job };
    delete task.resolve;
    delete task.reject;
    delete task.timer;
    delete task.storageTimer;
    this.worker.postMessage({
      ...task,
      maxResultBytes: positive(process.env.ANALYSIS_MAX_RESULT_BYTES, 8 * 1024 * 1024),
      memoryLimit: process.env.ANALYSIS_MEMORY_LIMIT || '512MB',
      tempLimit: process.env.ANALYSIS_TEMP_LIMIT || '2GB',
      threads: positive(process.env.ANALYSIS_THREADS, 2),
      tempDirectory: path.join(path.dirname(task.filename), 'spill'),
    });
  }

  private failWorker(error: Error) {
    const worker = this.worker;
    const job = this.active;
    this.worker = undefined;
    this.active = undefined;
    this.restarting = true;
    if (job) {
      clearTimeout(job.timer);
      clearInterval(job.storageTimer);
    }
    // Wait for termination before letting callers remove files or accepting new DB work.
    worker?.postMessage({ kind: 'cancel' });
    const termination = worker
      ? new Promise(resolve => setTimeout(resolve, 25)).then(() => worker.terminate())
      : Promise.resolve();
    termination.finally(() => {
      this.restarting = false;
      if (job) {
        clearTimeout(job.timer);
        job.reject(error);
      }
      this.pump();
    });
  }

  async onModuleDestroy() {
    this.closing = true;
    for (const job of this.queue.splice(0)) {
      clearTimeout(job.timer);
      job.reject(new Error('analysis worker shutting down'));
    }
    const worker = this.worker;
    this.worker = undefined;
    if (this.active) {
      clearTimeout(this.active.timer);
      clearInterval(this.active.storageTimer);
    }
    if (worker) {
      worker.postMessage({ kind: 'cancel' });
      await new Promise(resolve => setTimeout(resolve, 25));
      await worker.terminate();
    }
    if (this.active) {
      clearTimeout(this.active.timer);
      this.active.reject(new Error('analysis worker shutting down'));
      this.active = undefined;
    }
  }
}
