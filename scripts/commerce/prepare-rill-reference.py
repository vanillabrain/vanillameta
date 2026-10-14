#!/usr/bin/env python3
"""Generate an isolated Rill reference from the bundled public synthetic commerce CSVs."""
import argparse
import csv
import hashlib
import json
from decimal import Decimal
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    output = parser.parse_args().output.resolve()
    source = Path(__file__).resolve().parents[2] / 'backend-api/src/commerce/samples'
    manifest = json.loads((source / 'manifest.json').read_text())
    tables = {}
    for name in ('orders', 'payments', 'refunds', 'customers'):
        path = source / (name + '.csv')
        assert hashlib.sha256(path.read_bytes()).hexdigest() == manifest['sha256'][name]
        with path.open(newline='') as stream:
            tables[name] = list(csv.DictReader(stream))
    channels = {r['customer_id']: r['acquisition_channel'] or 'Unassigned' for r in tables['customers']}
    orders = {r['order_id']: r for r in tables['orders']}
    payments = [r for r in tables['payments'] if r['payment_status'] == 'succeeded']
    paid_ids = {r['order_id'] for r in payments}
    refunded_ids = {r['order_id'] for r in tables['refunds']}
    rows = []

    def append(oid, timestamp, kind, payment=0, refund=0, paid=0, refunded=0):
        rows.append([timestamp, channels.get(orders[oid]['customer_id'], 'Unassigned'), kind,
                     payment, refund, payment-refund, paid, refunded])

    for r in payments:
        append(r['order_id'], r['paid_at'], 'payment', payment=int(Decimal(r['amount']) * 100))
    for r in tables['refunds']:
        append(r['order_id'], r['refunded_at'], 'refund', refund=int(Decimal(r['amount']) * 100))
    for oid, r in orders.items():
        # A marker per order preserves cohort membership without changing cash totals.
        append(oid, r['ordered_at'], 'cohort', paid=int(oid in paid_ids), refunded=int(oid in paid_ids & refunded_ids))
    for folder in ('sources', 'metrics', 'dashboards', 'data'):
        (output / folder).mkdir(parents=True, exist_ok=True)
    path = output / 'data/events.csv'
    with path.open('w', newline='') as stream:
        writer = csv.writer(stream)
        writer.writerow(['event_at', 'channel', 'kind', 'payment_minor', 'refund_minor', 'net_minor', 'paid_orders', 'refunded_orders'])
        writer.writerows(rows)
    (output / 'rill.yaml').write_text('compiler: rillv1\ndisplay_name: Commerce Semantic Reference\n')
    (output / 'sources/events.yaml').write_text('type: source\nconnector: local_file\npath: data/events.csv\n')
    measures = [('payment', 'Payment USD', 'sum(payment_minor)/100.0', 'currency_usd'),
                ('refund', 'Refund USD', 'sum(refund_minor)/100.0', 'currency_usd'),
                ('net', 'Net Collected USD', 'sum(net_minor)/100.0', 'currency_usd'),
                ('paid_orders', 'Paid Order Cohort', 'sum(paid_orders)', 'humanize'),
                ('refunded_orders', 'Refunded Order Cohort', 'sum(refunded_orders)', 'humanize'),
                ('refund_rate', 'Cohort Refund Rate', 'sum(refunded_orders)*1.0/nullif(sum(paid_orders),0)', 'percentage')]
    yaml = 'type: metrics_view\nversion: 1\nmodel: events\ntimeseries: event_at\nsmallest_time_grain: day\nmeasures:\n'
    for name, label, expression, fmt in measures:
        yaml += f'  - name: {name}\n    display_name: {label}\n    expression: {expression}\n    format_preset: {fmt}\n'
    yaml += 'dimensions:\n  - name: channel\n    column: channel\n    display_name: Channel\n'
    (output / 'metrics/commerce_metrics.yaml').write_text(yaml)
    (output / 'dashboards/commerce_explore.yaml').write_text(
        'type: explore\ntitle: Commerce Cash Events and Order Cohorts\nmetrics_view: commerce_metrics\n'
        'dimensions: "*"\nmeasures: "*"\ntime_zones: [UTC]\ndefaults:\n  time_range: inf\n')
    (output / 'LICENSE.txt').write_bytes((source / 'LICENSE.txt').read_bytes())
    (output / 'provenance.json').write_text(json.dumps(dict(source=manifest, rows=len(rows),
        transform='Successful payments on paid_at; refunds on refunded_at; zero-cash order markers on ordered_at. Cohort membership uses only this bundle.',
        events_sha256=hashlib.sha256(path.read_bytes()).hexdigest()), indent=2) + '\n')
    print(f'Prepared {len(rows)} reference records at {output}; original source files unchanged.')


if __name__ == '__main__':
    main()
