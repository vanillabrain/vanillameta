import { DuckDBService } from './duckdb.service';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('DuckDB commerce bundle import', () => {
  let worker: DuckDBService;
  let directory: string;
  const saved = {
    FILE_UPLOAD_DIR: process.env.FILE_UPLOAD_DIR,
    FILE_UPLOAD_MAX_BYTES: process.env.FILE_UPLOAD_MAX_BYTES,
    ANALYSIS_MAX_STORAGE_BYTES: process.env.ANALYSIS_MAX_STORAGE_BYTES,
  };

  const csv = (name: string, contents: string) => {
    const filename = path.join(directory, name);
    fs.writeFileSync(filename, contents, { mode: 0o600 });
    return filename;
  };

  beforeAll(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'commerce-import-'));
    process.env.FILE_UPLOAD_DIR = directory;
    worker = new DuckDBService();
  });

  beforeEach(() => {
    for (const key of ['FILE_UPLOAD_MAX_BYTES', 'ANALYSIS_MAX_STORAGE_BYTES']) {
      const value = saved[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  afterAll(async () => {
    await worker.onModuleDestroy();
    fs.rmSync(directory, { recursive: true, force: true });
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('normalizes a valid bundle to exact minor units and keeps source dates in UTC', async () => {
    const ordersPath = csv(
      'orders.csv',
      'order_id,customer_id,ordered_at,order_status,currency,subtotal,tax_amount,shipping_amount,order_total\nO1,C1,2025-01-01T10:00:00Z,completed,USD,100.25,8.02,0.00,108.27\n',
    );
    const paymentsPath = csv(
      'payments.csv',
      'payment_id,order_id,paid_at,payment_status,amount\nP1,O1,2025-01-01T10:01:00Z,succeeded,108.27\n',
    );
    const refundsPath = csv(
      'refunds.csv',
      'refund_id,payment_id,order_id,refunded_at,refund_reason,amount\nR1,P1,O1,2025-01-02T10:00:00Z,damaged,25.10\n',
    );
    const customersPath = csv('customers.csv', 'customer_id,acquisition_channel\nC1,organic\n');
    const originalFiles = new Map(
      [
        ['orders.csv', ordersPath],
        ['payments.csv', paymentsPath],
        ['refunds.csv', refundsPath],
        ['customers.csv', customersPath],
      ].map(([name, filename]) => [name, fs.readFileSync(filename)]),
    );

    const imported = await worker.importCommerce({
      files: {
        orders: ordersPath,
        payments: paymentsPath,
        refunds: refundsPath,
        customers: customersPath,
      },
    });

    expect(imported.validation.valid).toBe(true);
    const managedDirectory = path.dirname(imported.filename);
    for (const [name, original] of [
      ['orders.csv', ordersPath],
      ['payments.csv', paymentsPath],
      ['refunds.csv', refundsPath],
      ['customers.csv', customersPath],
    ]) {
      expect(fs.readFileSync(path.join(managedDirectory, name))).toEqual(originalFiles.get(name));
      expect(fs.readFileSync(original)).toEqual(originalFiles.get(name));
    }
    expect(imported.rows).toEqual({ orders: 1, payments: 1, refunds: 1 });
    expect(imported.validation.errorCount).toBe(0);
    expect(
      (
        await worker.query(
          imported.filename,
          'SELECT merchandise_refund_minor FROM commerce_refunds',
        )
      ).datas,
    ).toEqual([{ merchandise_refund_minor: 2510 }]);
    expect(
      (
        await worker.query(
          imported.filename,
          'SELECT order_id, merchandise_amount_minor, channel FROM commerce_orders',
        )
      ).datas,
    ).toEqual([{ order_id: 'O1', merchandise_amount_minor: 10025, channel: 'organic' }]);
  });

  it('retains chronology issues for review and does not create publishable tables', async () => {
    const ordersPath = csv(
      'bad-orders.csv',
      'order_id,customer_id,ordered_at,order_status,currency,subtotal,tax_amount,shipping_amount,order_total\nO2,C2,2025-01-01T10:00:00Z,completed,USD,100.00,0.00,0.00,100.00\n',
    );
    const paymentsPath = csv(
      'bad-payments.csv',
      'payment_id,order_id,paid_at,payment_status,amount\nP2,O2,2025-01-02T10:00:00Z,succeeded,100.00\n',
    );
    const refundsPath = csv(
      'bad-refunds.csv',
      'refund_id,payment_id,order_id,refunded_at,refund_reason,amount\nR2,P2,O2,2025-01-01T10:01:00Z,damaged,20.00\n',
    );

    const imported = await worker.importCommerce({
      files: { orders: ordersPath, payments: paymentsPath, refunds: refundsPath },
      sampleType: 'error',
    });

    expect(imported.validation.valid).toBe(false);
    expect(imported.sampleType).toBe('error');
    expect(imported.validation.errorCount).toBe(1);
    expect(imported.validation.errors).toContainEqual({
      code: 'refund_before_payment',
      rowId: 'R2',
      detail: 'refund timestamp precedes successful payment',
    });
    expect(
      (await worker.query(imported.filename, 'SELECT row_id FROM commerce_import_errors')).datas,
    ).toEqual([{ row_id: 'R2' }]);
    await expect(
      worker.query(imported.filename, 'SELECT * FROM commerce_orders'),
    ).rejects.toThrow();
  });

  it('rejects source files outside the managed upload directory', async () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'commerce-outside-'));
    const outsideFile = path.join(outside, 'outside.csv');
    fs.writeFileSync(outsideFile, 'value\n1\n');
    try {
      await expect(
        worker.importCommerce({
          files: { orders: outsideFile, payments: outsideFile, refunds: outsideFile },
        }),
      ).rejects.toThrow('inside managed upload storage');
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  it('enforces the per-file upload limit before creating an import directory', async () => {
    const ordersPath = csv('limit-orders.csv', 'oversized\n1234567890\n');
    const paymentsPath = csv('limit-payments.csv', 'payment_id,order_id\nP1,O1\n');
    const refundsPath = csv('limit-refunds.csv', 'refund_id,payment_id,order_id\nR1,P1,O1\n');
    const before = fs.readdirSync(directory).filter(name => /^[0-9a-f-]{36}$/.test(name));
    process.env.FILE_UPLOAD_MAX_BYTES = String(fs.statSync(ordersPath).size - 1);

    await expect(
      worker.importCommerce({
        files: { orders: ordersPath, payments: paymentsPath, refunds: refundsPath },
      }),
    ).rejects.toThrow('per-file upload limit');
    expect(fs.readdirSync(directory).filter(name => /^[0-9a-f-]{36}$/.test(name))).toEqual(before);
  });

  it('checks staged bundle storage before starting the worker', async () => {
    const ordersPath = csv(
      'quota-orders.csv',
      'order_id,customer_id,ordered_at,order_status,currency,subtotal,tax_amount,shipping_amount,order_total\nO1,C1,2025-01-01T10:00:00Z,completed,USD,1.00,0.00,0.00,1.00\n',
    );
    const paymentsPath = csv(
      'quota-payments.csv',
      'payment_id,order_id,paid_at,payment_status,amount\nP1,O1,2025-01-01T10:01:00Z,succeeded,1.00\n',
    );
    const refundsPath = csv(
      'quota-refunds.csv',
      'refund_id,payment_id,order_id,refunded_at,refund_reason,amount\nR1,P1,O1,2025-01-02T10:00:00Z,damaged,0.10\n',
    );
    const bundleBytes = [ordersPath, paymentsPath, refundsPath].reduce(
      (total, filename) => total + fs.statSync(filename).size,
      0,
    );
    const before = fs.readdirSync(directory).filter(name => /^[0-9a-f-]{36}$/.test(name));
    process.env.ANALYSIS_MAX_STORAGE_BYTES = String(bundleBytes);

    await expect(
      worker.importCommerce({
        files: { orders: ordersPath, payments: paymentsPath, refunds: refundsPath },
      }),
    ).rejects.toThrow('analysis import storage exceeds');
    expect(fs.readdirSync(directory).filter(name => /^[0-9a-f-]{36}$/.test(name))).toEqual(before);
  });

  it('rejects a combined input bundle over storage quota before copying it', async () => {
    const ordersPath = csv('bundle-orders.csv', 'orders\n1234567890\n');
    const paymentsPath = csv('bundle-payments.csv', 'payments\n1234567890\n');
    const refundsPath = csv('bundle-refunds.csv', 'refunds\n1234567890\n');
    const bundleBytes = [ordersPath, paymentsPath, refundsPath].reduce(
      (total, filename) => total + fs.statSync(filename).size,
      0,
    );
    const before = fs.readdirSync(directory).filter(name => /^[0-9a-f-]{36}$/.test(name));
    process.env.ANALYSIS_MAX_STORAGE_BYTES = String(bundleBytes - 1);

    await expect(
      worker.importCommerce({
        files: { orders: ordersPath, payments: paymentsPath, refunds: refundsPath },
      }),
    ).rejects.toThrow('source bundle exceeds');
    expect(fs.readdirSync(directory).filter(name => /^[0-9a-f-]{36}$/.test(name))).toEqual(before);
  });

  it('rejects null and blank identifiers, currencies, statuses, and duplicate customer keys', async () => {
    const ordersPath = csv(
      'required-values-orders.csv',
      'order_id,customer_id,ordered_at,order_status,currency,subtotal,tax_amount,shipping_amount,order_total\n,C1,2025-01-01T10:00:00Z,, ,1.00,0.00,0.00,1.00\nO2,,2025-01-01T10:00:00Z,completed,USD,1.00,0.00,0.00,1.00\n',
    );
    const paymentsPath = csv(
      'required-values-payments.csv',
      'payment_id,order_id,paid_at,payment_status,amount\nP1,,2025-01-01T10:00:00Z,,1.00\n',
    );
    const refundsPath = csv(
      'required-values-refunds.csv',
      'refund_id,payment_id,order_id,refunded_at,refund_reason,amount\nR1,, ,2025-01-01T10:00:00Z,damaged,1.00\n',
    );
    const customersPath = csv(
      'duplicate-customers.csv',
      'customer_id,acquisition_channel\nC1,organic\nC1,paid_search\n ,referral\n',
    );

    const imported = await worker.importCommerce({
      files: {
        orders: ordersPath,
        payments: paymentsPath,
        refunds: refundsPath,
        customers: customersPath,
      },
    });

    expect(imported.validation.valid).toBe(false);
    const codes = imported.validation.errors.map(error => error.code);
    expect(codes).toContain('invalid_order');
    expect(codes).toContain('invalid_payment');
    expect(codes).toContain('invalid_refund');
    expect(codes).toContain('duplicate_customer_id');
    expect(codes).toContain('invalid_customer_id');
  });

  it('rejects fractional-cent amounts and order totals that do not reconcile', async () => {
    const ordersPath = csv(
      'precision-orders.csv',
      'order_id,customer_id,ordered_at,order_status,currency,subtotal,tax_amount,shipping_amount,order_total\nO1,C1,2025-01-01T10:00:00Z,completed,USD,1.001,0.00,0.00,1.001\nO2,C2,2025-01-01T10:00:00Z,completed,USD,10.00,1.00,0.00,10.99\n',
    );
    const paymentsPath = csv(
      'precision-payments.csv',
      'payment_id,order_id,paid_at,payment_status,amount\nP1,O1,2025-01-01T10:00:00Z,succeeded,1.001\nP2,O2,2025-01-01T10:00:00Z,succeeded,11.00\n',
    );
    const refundsPath = csv(
      'precision-refunds.csv',
      'refund_id,payment_id,order_id,refunded_at,refund_reason,amount\nR1,P2,O2,2025-01-02T10:00:00Z,damaged,0.001\n',
    );

    const imported = await worker.importCommerce({
      files: { orders: ordersPath, payments: paymentsPath, refunds: refundsPath },
    });

    expect(imported.validation.valid).toBe(false);
    const codes = imported.validation.errors.map(error => error.code);
    expect(codes).toContain('invalid_order_amount');
    expect(codes).toContain('invalid_payment');
    expect(codes).toContain('invalid_refund');
    expect(codes).toContain('order_total_mismatch');
  });

  it('returns ten issue examples while retaining the full 173-row chronology count', async () => {
    const ordersPath = csv(
      'many-errors-orders.csv',
      'order_id,customer_id,ordered_at,order_status,currency,subtotal,tax_amount,shipping_amount,order_total\nO3,C3,2025-01-01T10:00:00Z,completed,USD,1000.00,0.00,0.00,1000.00\n',
    );
    const paymentsPath = csv(
      'many-errors-payments.csv',
      'payment_id,order_id,paid_at,payment_status,amount\nP3,O3,2025-01-02T10:00:00Z,succeeded,1000.00\n',
    );
    const refundRows = Array.from(
      { length: 173 },
      (_, index) => `R${index + 1},P3,O3,2025-01-01T10:01:00Z,damaged,0.01`,
    ).join('\n');
    const refundsPath = csv(
      'many-errors-refunds.csv',
      `refund_id,payment_id,order_id,refunded_at,refund_reason,amount\n${refundRows}\n`,
    );

    const imported = await worker.importCommerce({
      files: { orders: ordersPath, payments: paymentsPath, refunds: refundsPath },
      sampleType: 'error',
    });

    expect(imported.validation.errorCount).toBe(173);
    expect(imported.validation.errors).toHaveLength(10);
  });
  it('identifies missing columns without exposing source values or filenames', async () => {
    const wrong = csv('private-customer.csv', 'secret_column\npassword=hidden\n');
    const imported = await worker.importCommerce({
      files: { orders: wrong, payments: wrong, refunds: wrong },
    });
    expect(imported.validation.valid).toBe(false);
    expect(imported.validation.helpErrorCode).toBe('IMPORT_MISSING_COLUMNS');
    expect(JSON.stringify(imported.validation)).not.toMatch(
      /password|hidden|private-customer|secret_column/,
    );
    await expect(
      worker.query(imported.filename, 'SELECT * FROM commerce_orders'),
    ).rejects.toThrow();
  });
  it.each(['orders', 'payments', 'refunds'])(
    'identifies an unreadable date in %s before publication',
    async table => {
      const files = Object.fromEntries(
        ['orders', 'payments', 'refunds', 'customers'].map(key => {
          let content = fs.readFileSync(
            path.join(__dirname, '../commerce/samples', `${key}.csv`),
            'utf8',
          );
          if (key === table) content = content.replace(/\d{4}-\d{2}-\d{2}T[0-9:]+Z/, 'not-a-date');
          return [key, csv(`date-${table}-${key}.csv`, content)];
        }),
      );
      const imported = await worker.importCommerce({ files: files as any });
      expect(imported.validation.valid).toBe(false);
      expect(imported.validation.helpErrorCode).toBe('IMPORT_INVALID_DATE');
      await expect(
        worker.query(imported.filename, 'SELECT * FROM commerce_orders'),
      ).rejects.toThrow();
    },
  );
});
