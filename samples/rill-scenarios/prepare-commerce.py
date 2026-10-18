"""Reproduce the public sample's order cohort; never join payments to refunds at event grain."""
import csv
import hashlib
import io
import json
from collections import defaultdict
from decimal import Decimal
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent.parent / "backend-api/src/commerce/samples"
manifest = json.loads((SOURCE / "manifest.json").read_text())
data = {}
for name in ("orders", "payments", "refunds", "customers"):
    content = (SOURCE / (name + ".csv")).read_bytes()
    if hashlib.sha256(content).hexdigest() != manifest["sha256"][name]:
        raise ValueError("Public sample checksum changed: " + name)
    data[name] = list(csv.DictReader(io.StringIO(content.decode("utf-8-sig"))))

paid, refunded = defaultdict(Decimal), defaultdict(Decimal)
paid_orders, refunded_orders = set(), set()
for payment in data["payments"]:
    if payment["payment_status"] == "succeeded":
        paid[payment["order_id"]] += Decimal(payment["amount"])
        paid_orders.add(payment["order_id"])
for refund in data["refunds"]:
    refunded[refund["order_id"]] += Decimal(refund["amount"])
    refunded_orders.add(refund["order_id"])
customers = {row["customer_id"]: row for row in data["customers"]}
rows = []
for order in data["orders"]:
    key = order["order_id"]
    revenue, refund = paid[key], refunded[key]
    rows.append({
        "ordered_at": order["ordered_at"],
        "channel": customers[order["customer_id"]]["acquisition_channel"],
        "currency": order["currency"],
        "revenue": f"{revenue:.2f}", "refund_amount": f"{refund:.2f}",
        "net_amount": f"{revenue - refund:.2f}",
        "paid_orders": int(key in paid_orders),
        "refunded_orders": int(key in paid_orders and key in refunded_orders),
    })
assert len(rows) == 37
assert sum(Decimal(row["revenue"]) for row in rows) == Decimal("20994.61")
assert sum(Decimal(row["refund_amount"]) for row in rows) == Decimal("4457.60")
assert sum(row["paid_orders"] for row in rows) == 35
assert sum(row["refunded_orders"] for row in rows) == 8
with (HERE / "data/commerce.csv").open("w", newline="", encoding="utf-8") as output:
    writer = csv.DictWriter(output, fieldnames=list(rows[0]), lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
print("commerce.csv: 37 order-cohort rows; USD 20994.61 / 4457.60; paid 35 / refunded 8")
