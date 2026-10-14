#!/usr/bin/env python3
"""Compare the owned bundled demo's live report with independent CSV/Decimal totals.

Uses the idempotent sample endpoint, which may create a demo project for the account.
Does not replace existing projects, invoke AI, or delete data. Credentials are not saved.
"""
import argparse
import csv
import hashlib
import json
import os
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--api-url', required=True)
    parser.add_argument('--user-id', required=True)
    parser.add_argument('--password-env', default='COMMERCE_VERIFY_PASSWORD')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    base = args.api_url.rstrip('/')
    url = urlparse(base)
    if url.scheme not in ('http', 'https') or url.username or url.password:
        parser.error('Use an HTTP(S) API URL without embedded credentials.')
    password = os.environ.get(args.password_env)
    if not password:
        parser.error('The password environment variable is missing.')
    samples = Path(__file__).resolve().parents[2] / 'backend-api/src/commerce/samples'
    manifest = json.loads((samples / 'manifest.json').read_text())
    tables = {}
    for name in ('orders', 'payments', 'refunds', 'customers'):
        path = samples / (name + '.csv')
        assert hashlib.sha256(path.read_bytes()).hexdigest() == manifest['sha256'][name], name
        with path.open(newline='') as stream:
            tables[name] = list(csv.DictReader(stream))
        assert len(tables[name]) == manifest['rows'][name], name
    customers = {r['customer_id']: r['acquisition_channel'] or 'Unassigned' for r in tables['customers']}
    orders = {r['order_id']: r for r in tables['orders']}
    channel = lambda oid: customers.get(orders[oid]['customer_id'], 'Unassigned')
    success = [r for r in tables['payments'] if r['payment_status'] == 'succeeded']
    paid_ids = {r['order_id'] for r in success}
    refund_ids = {r['order_id'] for r in tables['refunds']}
    dates = [r['ordered_at'][:10] for r in tables['orders']]
    dates += [r['paid_at'][:10] for r in success]
    dates += [r['refunded_at'][:10] for r in tables['refunds']]

    def oracle(start, end, selected=None):
        include = lambda r, col: start <= r[col][:10] <= end and (not selected or channel(r['order_id']) == selected)
        pay = sum((Decimal(r['amount']) for r in success if include(r, 'paid_at')), Decimal(0))
        refund = sum((Decimal(r['amount']) for r in tables['refunds'] if include(r, 'refunded_at')), Decimal(0))
        cohort = {oid for oid, r in orders.items() if include(r, 'ordered_at')} & paid_ids
        refunded = len(cohort & refund_ids)
        return dict(paymentTotal=f'{pay:.2f}', refundTotal=f'{refund:.2f}', netCollected=f'{pay-refund:.2f}',
                    paidOrders=len(cohort), refundedOrders=refunded,
                    refundOrderRate=refunded / len(cohort) if cohort else None)

    token = None

    def api(path, body=None):
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = 'Bearer ' + token
        req = Request(base + path, headers=headers, data=json.dumps(body).encode() if body is not None else None)
        with urlopen(req, timeout=30) as response:
            return json.load(response)

    token = api('/login/signin', {'userId': args.user_id, 'password': password})['accessToken']
    project = api('/commerce/sample', {})['data']['projectId']
    delayed = next(r for r in tables['refunds'] if r['refunded_at'][:10] > orders[r['order_id']]['ordered_at'][:10])
    order_day = orders[delayed['order_id']]['ordered_at'][:10]
    refund_day = delayed['refunded_at'][:10]
    cases = [('all', min(dates), max(dates), None), ('order-cohort-day', order_day, order_day, None),
             ('refund-event-day', refund_day, refund_day, None),
             ('refund-channel', refund_day, refund_day, channel(delayed['order_id'])),
             ('empty', '2030-01-01', '2030-01-01', None)]
    results = []
    for label, start, end, selected in cases:
        query = dict(start=start, end=end)
        if selected:
            query['channel'] = selected
        report = api(f'/commerce/{project}/report?' + urlencode(query))['data']
        expected = oracle(start, end, selected)
        assert report['summary'] == expected, (label, report['summary'], expected)
        assert report['scope']['paymentAndRefundTotalsByEventDate'] is True
        assert report['scope']['refundOrderRateByOrderDateCohort'] is True
        day = date.fromisoformat(start)
        expected_daily = []
        while day <= date.fromisoformat(end):
            key = day.isoformat()
            value = oracle(key, key, selected)
            expected_daily.append(dict(date=key, **{k: value[k] for k in ('paymentTotal', 'refundTotal', 'netCollected')}))
            day += timedelta(days=1)
        assert report['daily'] == expected_daily, label + ' daily'
        for item in report['channels']:
            value = oracle(start, end, item['channel'])
            assert all(item[k] == value[k] for k in ('paymentTotal', 'refundTotal', 'netCollected')), label + ' channel'
        for field in ('paymentTotal', 'refundTotal', 'netCollected'):
            assert sum((Decimal(r[field]) for r in report['channels']), Decimal(0)) == Decimal(expected[field])
        # Re-query establishes persisted publication rather than relying on a UI screenshot.
        again = api(f'/commerce/{project}/report?' + urlencode(query))['data']
        assert again['summary'] == expected and again['project'] == report['project']
        results.append(dict(case=label, query=query, expected=expected, project=report['project'], days=len(expected_daily)))
    assert api('/commerce/sample', {})['data']['projectId'] == project
    receipt = dict(sample=manifest, projectId=project, results=results)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
    print(f'PASS: {len(results)} CSV/Decimal cases, daily/channel totals, repeat reads and idempotent demo; project {project}')


if __name__ == '__main__':
    main()
