import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ForbiddenException } from '@nestjs/common';
import { DuckDBService } from '../analysis/duckdb.service';
import { CommerceService } from './commerce.service';

// This contract uses the real DuckDB worker and an injected AI stub. Avoid loading
// the unrelated ESM-only SDK through Nest's runtime constructor metadata.
jest.mock('../ai/ai.service', () => ({ AiService: class AiService {} }));

describe('CommerceService report contract', () => {
  let root: string;
  let worker: DuckDBService;
  let source: any;
  let service: CommerceService;
  let ai: { callLlm: jest.Mock };

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'commerce-api-'));
    process.env.FILE_UPLOAD_DIR = root;
    const paths = {
      orders: path.join(root, 'orders.csv'),
      payments: path.join(root, 'payments.csv'),
      refunds: path.join(root, 'refunds.csv'),
    };
    fs.writeFileSync(
      paths.orders,
      'order_id,customer_id,ordered_at,order_status,currency,subtotal,tax_amount,shipping_amount,order_total\nO0,C1,2024-12-31T23:59:03Z,completed,USD,1.00,0,0,1.00\nO1,C1,2025-01-01T10:00:00Z,completed,USD,90.00,5.00,5.25,100.25\nO2,C1,2025-01-01T11:00:00Z,completed,USD,10.00,0,0,10.00\n',
    );
    fs.writeFileSync(
      paths.payments,
      'payment_id,order_id,paid_at,payment_status,amount\nP0,O0,2024-12-31T23:59:59Z,succeeded,1.00\nP1,O1,2025-01-01T10:01:00Z,succeeded,100.25\nP2,O2,2025-01-01T11:01:00Z,failed,10.00\n',
    );
    fs.writeFileSync(
      paths.refunds,
      'refund_id,payment_id,order_id,refunded_at,refund_reason,amount\nR1,P1,O1,2025-01-02T10:00:00Z,damaged,25.10\n',
    );
    worker = new DuckDBService();
    const imported = await worker.importCommerce({ files: paths });
    expect(imported.validation.valid).toBe(true);
    source = {
      id: 1,
      ownerId: 7,
      name: 'test',
      status: 'ready',
      publishedFilename: imported.filename,
      summaryJson: JSON.stringify({ sampleType: 'normal' }),
      presentationJson: null,
    };
    const sources: any = {
      findOne: jest.fn().mockResolvedValue(source),
      find: jest.fn(),
      save: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    ai = {
      callLlm: jest
        .fn()
        .mockResolvedValue(
          '{"title":"매출·환불","explanation":"집계 기준","chartTitle":"현금 흐름"}',
        ),
    };
    service = new CommerceService(sources, {} as any, worker, ai as any);
  });

  afterAll(async () => {
    await worker?.onModuleDestroy();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('reports payment and refund event dates separately and uses order cohort for refund rate', async () => {
    const boundary: any = (await service.report(7, 1, '2024-12-31', '2024-12-31')).data;
    expect(boundary.orders[0].orderedAt).toBe('2024-12-31T23:59:03Z');

    const dayOne: any = (await service.report(7, 1, '2025-01-01', '2025-01-01')).data;
    expect(dayOne.summary).toEqual({
      paymentTotal: '100.25',
      refundTotal: '0.00',
      netCollected: '100.25',
      paidOrders: 1,
      refundedOrders: 1,
      refundOrderRate: 1,
    });
    expect(dayOne.daily).toEqual([
      { date: '2025-01-01', paymentTotal: '100.25', refundTotal: '0.00', netCollected: '100.25' },
    ]);

    const dayTwo: any = (await service.report(7, 1, '2025-01-02', '2025-01-02')).data;
    expect(dayTwo.summary.paymentTotal).toBe('0.00');
    expect(dayTwo.summary.refundTotal).toBe('25.10');
    expect(dayTwo.summary.netCollected).toBe('-25.10');
    expect(dayTwo.reasons).toEqual([{ reason: 'damaged', refundTotal: '25.10', refunds: 1 }]);
  });

  it('denies another user before opening the source', async () => {
    await expect(service.report(8, 1, '2025-01-01', '2025-01-01')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('sends only aggregates and explicit metric definitions to the presentation AI', async () => {
    const previousProvider = process.env.AI_PROVIDER;
    process.env.AI_PROVIDER = 'codex';
    try {
      await service.aiDraft(7, 1, {
        prompt: '제목과 지표 계산 기준을 설명해 줘',
        currentPresentation: { title: 'x'.repeat(500), unexpected: 'drop this' },
        start: '2025-01-01',
        end: '2025-01-02',
      });
      const prompt = JSON.parse(ai.callLlm.mock.calls[0][1]);
      expect(prompt.existing.title).toHaveLength(200);
      expect(prompt.existing).not.toHaveProperty('unexpected');
      expect(prompt.report).not.toHaveProperty('daily');
      expect(prompt.report).not.toHaveProperty('orders');
      expect(prompt.report.chart.series).toEqual(['paymentTotal', 'refundTotal', 'netCollected']);
      expect(ai.callLlm.mock.calls[0][0]).toContain('never include them in chartTitle');
      expect(prompt.report.summary.paymentTotal).toBe('100.25');
      expect(prompt.report.definitions.netCollected).toContain('integer cents');
      expect(prompt.report.definitions.refundOrderRate).toContain('ordered_at cohort');
      expect(prompt.report.definitions.refundTotal).toContain(
        'separate tax and shipping refund allocations are unavailable',
      );
    } finally {
      if (previousProvider === undefined) delete process.env.AI_PROVIDER;
      else process.env.AI_PROVIDER = previousProvider;
    }
  });

  it('updates only presentationJson so stale source fields cannot overwrite a concurrent publication', async () => {
    const sources = (service as any).sources;
    await service.savePresentation(7, 1, {
      title: 'Title',
      explanation: 'Explanation',
      chartTitle: 'Chart',
    });
    expect(sources.update).toHaveBeenCalledWith(
      { id: 1, ownerId: 7 },
      {
        presentationJson: JSON.stringify({
          title: 'Title',
          explanation: 'Explanation',
          chartTitle: 'Chart',
        }),
      },
    );
    expect(sources.save).not.toHaveBeenCalled();
  });

  const createIncomingFiles = () => {
    const directory = path.join(root, 'commerce-incoming');
    fs.mkdirSync(directory, { recursive: true });
    const files: Record<string, Array<{ path: string }>> = {};
    for (const field of ['orders', 'payments', 'refunds']) {
      const filename = path.join(directory, `${field}-${Date.now()}-${Math.random()}.csv`);
      fs.writeFileSync(filename, 'temporary upload');
      files[field] = [{ path: filename }];
    }
    return files;
  };

  it('cleans incoming multipart files when the project name is rejected', async () => {
    const files = createIncomingFiles();
    const filenames = Object.values(files)
      .flat()
      .map(file => file.path);
    const outsideIncoming = path.join(root, 'do-not-delete.csv');
    fs.writeFileSync(outsideIncoming, 'outside multer directory');
    files.untrusted = [{ path: outsideIncoming }];
    await expect(service.createAndImport(7, '   ', files as any)).rejects.toThrow(
      'name must be 1–160 characters',
    );
    expect(filenames.every(filename => !fs.existsSync(filename))).toBe(true);
    expect(fs.existsSync(outsideIncoming)).toBe(true);
    fs.unlinkSync(outsideIncoming);
  });

  it('cleans incoming multipart files when project ownership is denied', async () => {
    const files = createIncomingFiles();
    const filenames = Object.values(files)
      .flat()
      .map(file => file.path);
    await expect(
      service.createAndImport(8, 'Replacement', files as any, 'normal', 1),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(filenames.every(filename => !fs.existsSync(filename))).toBe(true);
  });

  it('cleans incoming multipart files after successful publication while preserving the managed import', async () => {
    const files = createIncomingFiles();
    const filenames = Object.values(files)
      .flat()
      .map(file => file.path);
    const existingSource = {
      id: 1,
      ownerId: 7,
      name: 'test',
      status: 'ready',
      currentVersion: 0,
      publishedDigest: null,
    };
    const sourceRepository: any = {
      findOne: jest.fn().mockResolvedValue(existingSource),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const runRepository: any = {
      create: jest.fn(value => value),
      save: jest.fn(async value => ({ ...value, id: 22 })),
      update: jest.fn(),
    };
    const duckdb: any = {
      importCommerce: jest.fn().mockResolvedValue({
        filename: 'published-managed.duckdb',
        rows: { orders: 1, payments: 1, refunds: 0 },
        validation: { valid: true, errors: [], errorCount: 0 },
        sampleType: 'normal',
      }),
      removeImport: jest.fn(),
    };
    const publicationService = new CommerceService(
      sourceRepository,
      runRepository,
      duckdb,
      {} as any,
    );

    const result = await publicationService.createAndImport(
      7,
      'Replacement',
      files as any,
      'normal',
      1,
    );

    expect(result.data.state).toBe('succeeded');
    expect(filenames.every(filename => !fs.existsSync(filename))).toBe(true);
    expect(duckdb.removeImport).not.toHaveBeenCalled();
    expect(sourceRepository.update).toHaveBeenCalledWith(
      { id: 1, ownerId: 7, currentVersion: 0 },
      expect.objectContaining({ publishedFilename: 'published-managed.duckdb' }),
    );
  });
});
