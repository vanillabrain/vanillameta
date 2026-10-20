import http from 'node:http';

const port = Number(process.env.QA_PROVIDER_PORT || 4310);
let mode = 'normal';
const sql = 'SELECT SUM(amount) AS total FROM uploaded_data';

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/health') {
    res.end(JSON.stringify({ status: 'ok', mode }));
    return;
  }
  let body = '';
  for await (const chunk of req) body += chunk;
  if (req.url === '/qa/mode' && req.method === 'POST') {
    try {
      mode = JSON.parse(body).mode || 'normal';
      res.end(JSON.stringify({ mode }));
    } catch {
      res.writeHead(400).end(JSON.stringify({ error: 'invalid fixture mode' }));
    }
    return;
  }
  if (req.url !== '/v1/chat/completions' || req.method !== 'POST') {
    res.writeHead(404).end(JSON.stringify({ error: 'unknown fixture endpoint' }));
    return;
  }
  if (mode === 'http-error') {
    res.writeHead(503).end(JSON.stringify({ error: 'local fixture unavailable' }));
    return;
  }
  if (mode === 'empty') {
    res.end(JSON.stringify({ choices: [] }));
    return;
  }
  if (mode === 'malformed-envelope') {
    res.end('invalid-json');
    return;
  }
  let input;
  try {
    input = JSON.parse(body);
  } catch {
    res.writeHead(400).end(JSON.stringify({ error: 'invalid fixture input' }));
    return;
  }
  const system = input.messages?.find(message => message.role === 'system')?.content || '';
  let content = sql;
  if (mode === 'write-sql') content = 'UPDATE uploaded_data SET amount = amount WHERE 1 = 0';
  else if (mode === 'multi-sql') content = 'SELECT 1; SELECT 2';
  else if (system.includes('data visualization expert')) {
    content = mode === 'bad-chart-json' ? 'not-json' : JSON.stringify({
      type: mode === 'unknown-chart' ? 'QA_UNREGISTERED_CHART' : 'CHART_BAR',
      reason: 'Local integration fixture, not model-quality evidence',
    });
  } else if (system.includes('BI analyst')) {
    content = '- 로컬 계약 검증 결과입니다.\n- 테스트 매출 합계는 500입니다.\n총평: 모델 품질 평가는 아닙니다.';
  }
  res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] }));
});

server.listen(port, '127.0.0.1', () => console.log(`Local provider contract fixture listening on ${port}`));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
