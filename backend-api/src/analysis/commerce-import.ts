/**
 * Load the normalized order/payment/refund CSV bundle used by the commerce MVP.
 * The caller supplies paths created by the upload pipeline, never paths from a SQL
 * request. Invalid bundles retain a bounded, queryable issue table and do not get
 * normalized commerce tables.
 */
export type CommerceImportInput = {
  files: {
    orders: string;
    payments: string;
    refunds: string;
    customers?: string;
  };
  sampleType?: 'normal' | 'error';
  /** Internal Studio sample projection, never model-provided SQL. */
  analytical?: boolean;
};

export type CommerceImportResult = {
  valid: boolean;
  counts: { orders: number; payments: number; refunds: number };
  errors: Array<{ code: string; rowId: string; detail: string }>;
  errorCount: number;
  sampleType: 'normal' | 'error';
  helpErrorCode?: 'IMPORT_INVALID_DATE' | 'IMPORT_MISSING_COLUMNS';
  summary?: { salesMinor: number; refundMinor: number; orderCount: number };
};

type DuckConnection = {
  run(sql: string): Promise<unknown>;
  runAndReadAll(sql: string): Promise<{ getRowObjects(): any[] }>;
};

const sqlString = (value: string) => `'${value.replace(/'/g, "''")}'`;

const requiredColumns: Record<string, string[]> = {
  orders: [
    'order_id',
    'customer_id',
    'ordered_at',
    'order_status',
    'currency',
    'subtotal',
    'tax_amount',
    'shipping_amount',
    'order_total',
  ],
  payments: ['payment_id', 'order_id', 'paid_at', 'payment_status', 'amount'],
  refunds: ['refund_id', 'payment_id', 'order_id', 'refunded_at', 'refund_reason', 'amount'],
  customers: ['customer_id', 'acquisition_channel'],
};

async function createSource(connection: DuckConnection, table: string, filename: string) {
  const source = sqlString(filename);
  await connection.run(
    `CREATE TEMP TABLE _commerce_${table}_source AS SELECT * FROM read_csv(${source}, header=true, all_varchar=true, sample_size=-1, strict_mode=true)`,
  );
  const columns = await connection.runAndReadAll(`DESCRIBE _commerce_${table}_source`);
  const actual = new Set(columns.getRowObjects().map(row => String(row.column_name).toLowerCase()));
  const missing = requiredColumns[table].filter(column => !actual.has(column));
  return missing;
}

/** Import three CSVs atomically into normalized commerce tables after bundle checks. */
export async function importCommerce(
  connection: DuckConnection,
  input: CommerceImportInput,
): Promise<CommerceImportResult> {
  const files = input.files;
  const hasCustomers = Boolean(files.customers);
  for (const table of ['orders', 'payments', 'refunds', ...(hasCustomers ? ['customers'] : [])]) {
    const missing = await createSource(connection, table, files[table]);
    if (missing.length)
      return {
        valid: false,
        counts: { orders: 0, payments: 0, refunds: 0 },
        errors: [
          {
            code: 'missing_required_columns',
            rowId: '',
            detail: 'Required CSV columns are missing.',
          },
        ],
        errorCount: missing.length,
        helpErrorCode: 'IMPORT_MISSING_COLUMNS',
        sampleType: input.sampleType || 'normal',
      };
  }

  const castColumns = [
    `CREATE TEMP TABLE _commerce_orders AS
      SELECT trim(order_id) order_id, trim(customer_id) customer_id,
        try_cast(ordered_at AS TIMESTAMPTZ) ordered_at,
        lower(trim(order_status)) order_status, upper(trim(currency)) currency,
        try_cast(subtotal AS DECIMAL(18,2)) subtotal,
        try_cast(tax_amount AS DECIMAL(18,2)) tax_amount,
        try_cast(shipping_amount AS DECIMAL(18,2)) shipping_amount,
        try_cast(order_total AS DECIMAL(18,2)) order_total,
        regexp_matches(trim(subtotal), '^[0-9]+(\\.[0-9]{1,2})?$')
          AND regexp_matches(trim(tax_amount), '^[0-9]+(\\.[0-9]{1,2})?$')
          AND regexp_matches(trim(shipping_amount), '^[0-9]+(\\.[0-9]{1,2})?$')
          AND regexp_matches(trim(order_total), '^[0-9]+(\\.[0-9]{1,2})?$') AS cents_valid,
        CAST(round(try_cast(subtotal AS DECIMAL(18,2)) * 100) AS BIGINT) amount_minor
      FROM _commerce_orders_source`,
    `CREATE TEMP TABLE _commerce_payments AS
      SELECT trim(payment_id) payment_id, trim(order_id) order_id,
        try_cast(paid_at AS TIMESTAMPTZ) paid_at, lower(trim(payment_status)) payment_status,
        try_cast(amount AS DECIMAL(18,2)) amount,
        regexp_matches(trim(amount), '^[0-9]+(\\.[0-9]{1,2})?$') AS cents_valid,
        CAST(round(try_cast(amount AS DECIMAL(18,2)) * 100) AS BIGINT) amount_minor
      FROM _commerce_payments_source`,
    `CREATE TEMP TABLE _commerce_refunds AS
      SELECT trim(refund_id) refund_id, trim(payment_id) payment_id, trim(order_id) order_id,
        try_cast(refunded_at AS TIMESTAMPTZ) refunded_at, trim(refund_reason) refund_reason,
        try_cast(amount AS DECIMAL(18,2)) amount,
        regexp_matches(trim(amount), '^[0-9]+(\\.[0-9]{1,2})?$') AS cents_valid,
        CAST(round(try_cast(amount AS DECIMAL(18,2)) * 100) AS BIGINT) amount_minor
      FROM _commerce_refunds_source`,
  ];
  for (const sql of castColumns) await connection.run(sql);

  await connection.run(`CREATE TABLE commerce_import_errors AS
    WITH issues AS (
      SELECT 'duplicate_order_id' code, order_id row_id, 'order_id must be unique' detail
        FROM _commerce_orders GROUP BY order_id HAVING count(*) > 1
      UNION ALL
      SELECT 'duplicate_payment_id', payment_id, 'payment_id must be unique'
        FROM _commerce_payments GROUP BY payment_id HAVING count(*) > 1
      UNION ALL
      SELECT 'duplicate_refund_id', refund_id, 'refund_id must be unique'
        FROM _commerce_refunds GROUP BY refund_id HAVING count(*) > 1
      ${
        hasCustomers
          ? `UNION ALL
      SELECT 'duplicate_customer_id', trim(customer_id), 'customer_id must be unique'
        FROM _commerce_customers_source GROUP BY trim(customer_id) HAVING count(*) > 1
      UNION ALL
      SELECT 'invalid_customer_id', coalesce(trim(customer_id), ''), 'customer_id is required'
        FROM _commerce_customers_source WHERE nullif(trim(customer_id), '') IS NULL`
          : ''
      }
      UNION ALL
      SELECT 'invalid_order', coalesce(order_id, ''), 'required order values are invalid'
        FROM _commerce_orders WHERE nullif(order_id, '') IS NULL
          OR nullif(customer_id, '') IS NULL OR ordered_at IS NULL
          OR nullif(currency, '') IS NULL OR currency <> 'USD'
          OR nullif(order_status, '') IS NULL
          OR order_status NOT IN ('completed', 'partially_refunded', 'refunded', 'cancelled')
      UNION ALL
      SELECT 'invalid_order_amount', order_id, 'order amounts must be nonnegative values with at most two decimals'
        FROM _commerce_orders WHERE subtotal IS NULL OR tax_amount IS NULL OR shipping_amount IS NULL
          OR order_total IS NULL OR subtotal < 0 OR tax_amount < 0 OR shipping_amount < 0
          OR order_total < 0 OR cents_valid IS NOT TRUE OR amount_minor IS NULL
      UNION ALL
      SELECT 'order_total_mismatch', order_id, 'order_total must equal subtotal plus tax_amount and shipping_amount'
        FROM _commerce_orders WHERE cents_valid IS TRUE AND subtotal IS NOT NULL
          AND tax_amount IS NOT NULL AND shipping_amount IS NOT NULL AND order_total IS NOT NULL
          AND order_total <> subtotal + tax_amount + shipping_amount
      UNION ALL
      SELECT 'invalid_payment', coalesce(payment_id, ''), 'required payment values are invalid'
        FROM _commerce_payments WHERE nullif(payment_id, '') IS NULL OR nullif(order_id, '') IS NULL
          OR paid_at IS NULL OR amount IS NULL OR amount <= 0 OR amount_minor IS NULL
          OR cents_valid IS NOT TRUE OR nullif(payment_status, '') IS NULL
          OR payment_status NOT IN ('succeeded', 'failed')
      UNION ALL
      SELECT 'invalid_refund', coalesce(refund_id, ''), 'required refund values are invalid'
        FROM _commerce_refunds WHERE nullif(refund_id, '') IS NULL
          OR nullif(payment_id, '') IS NULL OR nullif(order_id, '') IS NULL OR refunded_at IS NULL
          OR amount IS NULL OR amount <= 0 OR amount_minor IS NULL OR cents_valid IS NOT TRUE
      UNION ALL
      SELECT 'empty_orders', '', 'orders CSV has no rows' WHERE NOT EXISTS (SELECT 1 FROM _commerce_orders)
      UNION ALL
      SELECT 'empty_payments', '', 'payments CSV has no rows' WHERE NOT EXISTS (SELECT 1 FROM _commerce_payments)
      ${
        hasCustomers
          ? `UNION ALL
      SELECT 'orphan_order_customer', o.order_id, 'order references an unknown customer'
        FROM _commerce_orders o LEFT JOIN _commerce_customers_source c ON trim(c.customer_id) = o.customer_id
        WHERE c.customer_id IS NULL`
          : ''
      }
      UNION ALL
      SELECT 'orphan_payment_order', p.payment_id, 'payment references an unknown order'
        FROM _commerce_payments p LEFT JOIN _commerce_orders o USING (order_id) WHERE o.order_id IS NULL
      UNION ALL
      SELECT 'orphan_refund_order', r.refund_id, 'refund references an unknown order'
        FROM _commerce_refunds r LEFT JOIN _commerce_orders o USING (order_id) WHERE o.order_id IS NULL
      UNION ALL
      SELECT 'orphan_refund_payment', r.refund_id, 'refund references an unknown payment'
        FROM _commerce_refunds r LEFT JOIN _commerce_payments p USING (payment_id) WHERE p.payment_id IS NULL
      UNION ALL
      SELECT 'refund_payment_mismatch', r.refund_id, 'refund order does not match its payment order'
        FROM _commerce_refunds r JOIN _commerce_payments p USING (payment_id) WHERE r.order_id <> p.order_id
      UNION ALL
      SELECT 'refund_before_payment', r.refund_id, 'refund timestamp precedes successful payment'
        FROM _commerce_refunds r JOIN _commerce_payments p USING (payment_id)
        WHERE p.payment_status = 'succeeded' AND r.refunded_at < p.paid_at
      UNION ALL
      SELECT 'refund_exceeds_payment', p.payment_id, 'refund total exceeds successful payment amount'
        FROM _commerce_payments p JOIN _commerce_refunds r USING (payment_id)
        WHERE p.payment_status = 'succeeded' GROUP BY p.payment_id, p.amount
        HAVING sum(r.amount) > p.amount
      UNION ALL
      SELECT 'refund_for_failed_payment', r.refund_id, 'refund references a failed payment'
        FROM _commerce_refunds r JOIN _commerce_payments p USING (payment_id)
        WHERE p.payment_status <> 'succeeded'
    ) SELECT * FROM issues`);

  const issues = await connection.runAndReadAll(
    'SELECT code, row_id AS rowId, detail FROM commerce_import_errors ORDER BY code, row_id LIMIT 10',
  );
  const total = await connection.runAndReadAll('SELECT count(*) AS n FROM commerce_import_errors');
  const counts = await connection.runAndReadAll(`
    SELECT (SELECT count(*) FROM _commerce_orders) orders,
      (SELECT count(*) FROM _commerce_payments) payments,
      (SELECT count(*) FROM _commerce_refunds) refunds`);
  const errors = issues.getRowObjects().map(row => ({
    code: String(row.code),
    rowId: String(row.rowId ?? ''),
    detail: String(row.detail),
  }));
  const errorCount = Number(total.getRowObjects()[0].n);
  const rowCounts = counts.getRowObjects()[0];

  if (errorCount) {
    const invalidDates = await connection.runAndReadAll(`SELECT
      (SELECT count(*) FROM _commerce_orders WHERE ordered_at IS NULL) +
      (SELECT count(*) FROM _commerce_payments WHERE paid_at IS NULL) +
      (SELECT count(*) FROM _commerce_refunds WHERE refunded_at IS NULL) AS n`);
    return {
      ...(Number(invalidDates.getRowObjects()[0].n) > 0
        ? { helpErrorCode: 'IMPORT_INVALID_DATE' as const }
        : {}),
      valid: false,
      counts: {
        orders: Number(rowCounts.orders),
        payments: Number(rowCounts.payments),
        refunds: Number(rowCounts.refunds),
      },
      errors,
      errorCount,
      sampleType: input.sampleType || 'normal',
    };
  }

  await connection.run(`CREATE TABLE commerce_orders AS
    SELECT o.order_id, o.ordered_at, o.order_status, o.currency, o.subtotal,
      o.amount_minor AS merchandise_amount_minor,
      CASE WHEN EXISTS (SELECT 1 FROM _commerce_payments p WHERE p.order_id=o.order_id AND p.payment_status='succeeded')
        THEN 'succeeded' ELSE 'failed' END AS payment_status,
      ${hasCustomers ? 'c.acquisition_channel' : 'CAST(NULL AS VARCHAR)'} AS channel
    FROM _commerce_orders o
    ${
      hasCustomers
        ? 'LEFT JOIN _commerce_customers_source c ON trim(c.customer_id)=trim(o.customer_id)'
        : ''
    }`);
  await connection.run(`CREATE TABLE commerce_payments AS
    SELECT payment_id, order_id, paid_at, payment_status, amount, amount_minor FROM _commerce_payments`);
  await connection.run(`CREATE TABLE commerce_refunds AS
    SELECT refund_id, payment_id, order_id, refunded_at, amount,
      amount_minor AS merchandise_refund_minor,
      coalesce(nullif(refund_reason, ''), 'unspecified') AS refund_reason
    FROM _commerce_refunds`);
  await connection.run('DROP TABLE commerce_import_errors');
  const summaryRows = await connection.runAndReadAll(`SELECT
    coalesce(sum(CASE WHEN payment_status='succeeded' AND order_status NOT IN ('cancelled','canceled')
      THEN merchandise_amount_minor ELSE 0 END), 0) AS salesMinor,
    coalesce((SELECT sum(merchandise_refund_minor) FROM commerce_refunds), 0) AS refundMinor,
    coalesce(sum(CASE WHEN payment_status='succeeded' AND order_status NOT IN ('cancelled','canceled')
      THEN 1 ELSE 0 END), 0) AS orderCount
    FROM commerce_orders`);
  const summaryRow = summaryRows.getRowObjects()[0];
  return {
    valid: true,
    counts: {
      orders: Number(rowCounts.orders),
      payments: Number(rowCounts.payments),
      refunds: Number(rowCounts.refunds),
    },
    errors: [],
    errorCount: 0,
    sampleType: input.sampleType || 'normal',
    summary: {
      salesMinor: Number(summaryRow.salesMinor),
      refundMinor: Number(summaryRow.refundMinor),
      orderCount: Number(summaryRow.orderCount),
    },
  };
}
