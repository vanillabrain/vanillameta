#!/usr/bin/env python3
"""Compare the generated Rill metrics view with verify-report.py's CSV oracle.

Only calls the local metadata and aggregation read APIs. Saves no credentials.
Empty Rill SUMs are NULL; VanillaMeta deliberately returns zero cash/counts.
"""
import argparse
import json
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--rill-url', required=True)
    parser.add_argument('--oracle', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    base = args.rill_url.rstrip('/')
    if urlparse(base).hostname not in ('localhost', '127.0.0.1', '::1'):
        parser.error('Use an isolated localhost Rill reference.')
    with urlopen(base + '/local/config', timeout=30) as response:
        config = json.load(response)
    endpoint = base + '/v1/instances/' + quote(config['instance_id'], safe='')
    endpoint += '/queries/metrics-views/commerce_metrics/aggregation'
    mapping = {'payment': 'paymentTotal', 'refund': 'refundTotal', 'net': 'netCollected',
               'paid_orders': 'paidOrders', 'refunded_orders': 'refundedOrders',
               'refund_rate': 'refundOrderRate'}
    oracle = json.loads(args.oracle.read_text())
    results = []
    for case in oracle['results']:
        query = case['query']
        end = date.fromisoformat(query['end']) + timedelta(days=1)
        body = {'measures': [{'name': name} for name in mapping],
                'timeRange': {'start': query['start'] + 'T00:00:00Z',
                              'end': end.isoformat() + 'T00:00:00Z', 'timeZone': 'UTC'}}
        if query.get('channel'):
            # The value comes from the fixed public CSV oracle, not user SQL.
            body['whereSql'] = "channel = '" + query['channel'].replace("'", "''") + "'"
        request = Request(endpoint, data=json.dumps(body).encode(),
                          headers={'Content-Type': 'application/json'})
        with urlopen(request, timeout=30) as response:
            data = json.load(response)['data']
        assert len(data) == 1, (case['case'], data)
        row = data[0]
        for name, target in mapping.items():
            actual, expected = row[name], case['expected'][target]
            if name == 'refund_rate':
                assert actual == expected, (case['case'], name, actual, expected)
            else:
                # Normalize only empty SUM; preserve the raw NULL in evidence.
                assert Decimal(str(actual if actual is not None else 0)) == Decimal(str(expected)), (
                    case['case'], name, actual, expected)
        results.append({'case': case['case'], 'request': body, 'rill': row,
                        'expected': case['expected']})
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({'rillVersion': config['version'], 'sample': oracle['sample'],
                                     'emptySumPolicy': 'Rill NULL versus VanillaMeta zero; rate stays NULL',
                                     'results': results}, ensure_ascii=False, indent=2) + '\n')
    print(f'PASS: {len(results)} Rill metrics-view cases match CSV oracle; empty SUM policy recorded.')


if __name__ == '__main__':
    main()
