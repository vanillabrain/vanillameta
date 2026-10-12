import {
  BadRequestException,
  Injectable,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Worker } from 'worker_threads';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';

export type AnalysisUpload = {
  originalname: string;
  path?: string;
  buffer?: Buffer;
  size?: number;
};
export type AnalysisImport = { filename: string; sourcePath: string; rows: number };
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
        if (job.kind === 'import' && !message.error) {
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
    if (job.kind === 'import') {
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
    const { resolve, reject, timer, storageTimer, ...task } = job;
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
