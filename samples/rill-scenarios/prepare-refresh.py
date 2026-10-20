#!/usr/bin/env python3
"""Generate a bounded repeatable refresh workload without committing a large CSV."""
import argparse
import csv
import json
from decimal import Decimal
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', required=True, type=Path)
parser.add_argument('--repeats', type=int, default=50000)
args = parser.parse_args()
if not 1 <= args.repeats <= 200000:
    parser.error('--repeats must be between 1 and 200000 (at most 4,000,000 rows)')
source = Path(__file__).parent / 'data' / 'margin-refresh-recovery.csv'
lines = source.read_text().splitlines(keepends=True)
# Exclusive creation protects existing customer files and previous evidence.
with args.output.open('x', encoding='utf-8', newline='') as target:
    target.write(lines[0])
    for _ in range(args.repeats):
        target.writelines(lines[1:])
with source.open(newline='') as handle:
    rows = list(csv.DictReader(handle))
sums = {column: sum(Decimal(row[column]) for row in rows) * args.repeats
        for column in ('sales_amount', 'expense_amount', 'net_profit')}
print(json.dumps({'rows': len(rows) * args.repeats,
                  'bytes': args.output.stat().st_size,
                  'sums': {key: str(value) for key, value in sums.items()},
                  'costRatio': str(sums['expense_amount'] / sums['sales_amount'] * 100)}, indent=2))
