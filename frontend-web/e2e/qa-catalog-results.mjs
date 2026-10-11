import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const reportPath = process.argv[2];
if (!reportPath) throw new Error('Provide a completed Playwright JSON report.');
const catalog = JSON.parse(await fs.readFile(path.join(path.dirname(fileURLToPath(import.meta.url)), 'scenario-catalog.json'), 'utf8'));
const report = JSON.parse(await fs.readFile(reportPath, 'utf8'));
const cases = catalog.cases;
if (!Array.isArray(cases) || new Set(cases.map(item => item.id)).size !== cases.length) throw new Error('Scenario catalog is missing or has duplicate IDs.');
const rows = [];
const walk = (suite, parents = []) => {
  const names = [...parents, suite.title].filter(Boolean);
  for (const spec of suite.specs || []) {
    for (const execution of spec.tests || []) {
      const results = execution.results || [];
      const last = results.at(-1);
      const title = [...names, spec.title].join(' > ');
      const ids = [...new Set(title.match(/\b(?:AUTH|FILE|DATA|SET|METRIC|WIDGET|DASH|SHARE|TEMPLATE|AI|RELIABILITY|NAV|COMPONENT)-\d{2}\b/g) || [])];
      rows.push({ title, ids, file: spec.file, line: spec.line, project: execution.projectName, status: last?.status || 'not-run', expectedStatus: execution.expectedStatus, attempts: results.length, error: String(last?.error?.message || (last?.errors || []).map(item => item.message).join('\n') || '').replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[REDACTED_TEST_TOKEN]'), attachments: (last?.attachments || []).filter(item => item.path).map(item => ({ name: item.name, path: item.path, contentType: item.contentType })) });
    }
  }
  for (const child of suite.suites || []) walk(child, names);
};
for (const suite of report.suites || []) walk(suite);
const scenarios = cases.map(item => {
  const variants = rows.filter(row => row.ids.includes(item.id));
  const state = variants.length === 0 ? 'NOT_IMPLEMENTED' : variants.every(row => row.status === 'passed' && row.expectedStatus === 'passed' && row.attempts === 1) ? 'PASS' : 'FAIL_OR_BLOCKED';
  return { ...item, verification: { state, variants } };
});
const summary = {
  reportPath: path.resolve(reportPath),
  originalStats: report.stats,
  runnerErrors: report.errors || [],
  executedVariants: rows.length,
  catalogScenarios: cases.length,
  passingScenarios: scenarios.filter(item => item.verification.state === 'PASS').map(item => item.id),
  failingOrBlockedScenarios: scenarios.filter(item => item.verification.state === 'FAIL_OR_BLOCKED').map(item => item.id),
  notImplementedScenarios: scenarios.filter(item => item.verification.state === 'NOT_IMPLEMENTED').map(item => item.id),
  failedVariants: rows.filter(row => row.status !== 'passed' || row.expectedStatus !== 'passed' || row.attempts !== 1),
  legacyVariants: rows.filter(row => row.ids.length === 0),
  scenarios,
};
const destination = path.join(path.dirname(path.resolve(reportPath)), 'catalog-results.json');
await fs.writeFile(destination, JSON.stringify(summary, null, 2), { mode: 0o600 });
console.log(JSON.stringify({ destination, stats: report.stats, catalogScenarios: cases.length, passingScenarios: summary.passingScenarios.length, failingOrBlockedScenarios: summary.failingOrBlockedScenarios.length, notImplementedScenarios: summary.notImplementedScenarios, failedVariants: summary.failedVariants.map(row => ({ title: row.title, file: row.file, line: row.line, status: row.status, error: row.error })) }, null, 2));
