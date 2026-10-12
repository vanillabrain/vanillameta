from pathlib import Path
from collections import defaultdict,Counter
from decimal import Decimal as D
import json,csv,io,zipfile,hashlib
import argparse
parser=argparse.ArgumentParser(description='Build attributed AE normal/error commerce subsets and an independent Decimal oracle.')
parser.add_argument('--source-zip', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
args=parser.parse_args()
root=args.output.resolve(); root.mkdir(parents=True, exist_ok=True)
source=args.source_zip.resolve()
with zipfile.ZipFile(source) as z:
 tables={n:list(csv.DictReader(io.StringIO(z.read(n+'.csv').decode('utf-8-sig')))) for n in ['orders','payments','refunds','customers']}
 license=z.read('LICENSE.txt')
p={r['payment_id']:r for r in tables['payments']}
bad={r['order_id'] for r in tables['refunds'] if r['refunded_at']<p[r['payment_id']]['paid_at']}
if len(bad)!=173:
 raise ValueError('Unexpected AE dataset version: expected 173 chronology-anomaly orders; inspect source before use')
manifest={'source':'https://www.analyticsengineering.com/datasets/ecommerce-sales','version':'1.0.0','license':'CC BY 4.0','sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'criterion':'Exclude entire order and all linked payment/refund rows when refund precedes its linked successful payment. Preserve original values and all rows for retained orders. Customers subset by retained orders. No timestamp repair.','excludedOrderIds':sorted(bad),'samples':{}}
allids={r['order_id'] for r in tables['orders']}
for name,ids in [('normal',allids-bad),('temporal-errors',bad)]:
 directory=root/name;directory.mkdir(exist_ok=True)
 selected={n:[r for r in tables[n] if r['order_id'] in ids] for n in ['orders','payments','refunds']}
 customers={r['customer_id'] for r in selected['orders']}
 selected['customers']=[r for r in tables['customers'] if r['customer_id'] in customers]
 manifest['samples'][name]={}
 for n,rows in selected.items():
  file=directory/(n+'.csv')
  with file.open('w',newline='') as f:
   w=csv.DictWriter(f,fieldnames=list(tables[n][0]),lineterminator='\n');w.writeheader();w.writerows(rows)
  b=file.read_bytes();manifest['samples'][name][n]={'rows':len(rows),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
 (directory/'LICENSE.txt').write_bytes(license)
 (directory/'PROVENANCE.txt').write_text('Derived subset of Analytics Engineering Ecommerce Sales & Returns Dataset v1.0.0, CC BY4.0. Source: '+manifest['source']+'\nRule: '+manifest['criterion']+'\nSubset: '+name+'\nOriginal values unchanged; complete order bundles selected.\n')
(root/'sample-manifest.json').write_text(json.dumps(manifest,indent=2))
normal={n:[r for r in tables[n] if r['order_id'] not in bad] for n in ['orders','payments','refunds']}
cust={r['customer_id']:r for r in tables['customers']};order={r['order_id']:r for r in normal['orders']}
paid=defaultdict(D);refund=defaultdict(D);events=[]
for r in normal['payments']:
 if r['payment_status']=='succeeded':
  paid[r['order_id']]+=D(r['amount']);o=order[r['order_id']];events.append({'event_id':r['payment_id'],'event_type':'payment','order_id':r['order_id'],'event_at':r['paid_at'],'channel':cust[o['customer_id']]['acquisition_channel'],'country_code':cust[o['customer_id']]['country_code'],'currency':o['currency'],'payment_amount':r['amount'],'refund_amount':'0.00','net_collected':r['amount']})
for r in normal['refunds']:
 refund[r['order_id']]+=D(r['amount']);o=order[r['order_id']];events.append({'event_id':r['refund_id'],'event_type':'refund','order_id':r['order_id'],'event_at':r['refunded_at'],'channel':cust[o['customer_id']]['acquisition_channel'],'country_code':cust[o['customer_id']]['country_code'],'currency':o['currency'],'payment_amount':'0.00','refund_amount':r['amount'],'net_collected':str(-D(r['amount']))})
with (root/'normal'/'events.csv').open('w',newline='') as f:
 w=csv.DictWriter(f,fieldnames=list(events[0]),lineterminator='\n');w.writeheader();w.writerows(events)
channels=sorted({x['channel'] for x in events})
def oracle(start='',end='',channel=''):
 chosen=[e for e in events if (not start or e['event_at'][:10]>=start) and (not end or e['event_at'][:10]<=end) and (not channel or e['channel']==channel)]
 cohort=[o for o in order.values() if paid[o['order_id']]>0 and (not start or o['ordered_at'][:10]>=start) and (not end or o['ordered_at'][:10]<=end) and (not channel or cust[o['customer_id']]['acquisition_channel']==channel)]
 sums={n:str(sum((D(e[n]) for e in chosen),D('0')).quantize(D('.01'))) for n in ('payment_amount','refund_amount','net_collected')}
 daily=defaultdict(lambda:defaultdict(D));groups=defaultdict(lambda:defaultdict(D))
 for e in chosen:
  for n in ('payment_amount','refund_amount','net_collected'):daily[e['event_at'][:10]][n]+=D(e[n]);groups[e['channel']][n]+=D(e[n])
 count=len(cohort);refunded=sum(refund[o['order_id']]>0 for o in cohort)
 return {'filters':{'start':start,'end':end,'channel':channel},'summary':sums | {'paidOrders':count,'refundedOrders':refunded,'refundOrderRatePercent':str(D(refunded)*100/D(count)) if count else None},'daily':{d:{n:str(v.quantize(D('.01'))) for n,v in s.items()} for d,s in sorted(daily.items())},'channels':{d:{n:str(v.quantize(D('.01'))) for n,v in s.items()} for d,s in sorted(groups.items())},'eventRows':len(chosen)}
results={'all':oracle(),'september2025':oracle('2025-09-01','2025-09-30'),'septemberPaidSearch':oracle('2025-09-01','2025-09-30','paid_search'),'empty':oracle('2026-01-01','2026-01-31'),'channels':channels,'normalRows':{n:len(t) for n,t in normal.items()},'crossMonthRefunds':sum(r['refunded_at'][:7]!=order[r['order_id']]['ordered_at'][:7] for r in normal['refunds'])}
(root/'oracle.json').write_text(json.dumps(results,indent=2))
print(json.dumps({k:v['summary'] for k,v in results.items() if isinstance(v,dict) and 'summary' in v},indent=2));print('normal',results['normalRows'],'error orders',len(bad),'channels',channels)
