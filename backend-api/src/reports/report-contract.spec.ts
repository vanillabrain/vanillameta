import { randomUUID } from 'crypto';
import {
  encodeReport,
  canonicalReport,
  reportHash,
  parseReport,
  reportSaveRequest,
} from './report-contract';
const command = () => ({
  requestId: randomUUID(),
  expectedOrganizationId: null,
  expectedRevision: null,
  title: '매출',
  body: '직접 쓴 본문',
  data: {
    mode: 'capture',
    capture: {
      dashboardId: 1,
      expectedDashboardRevision: 'a'.repeat(64),
      kpiId: 'kpi',
      chartId: 'chart',
    },
    previewDigest: 'b'.repeat(64),
  },
});
describe('private report boundary and canonical storage', () => {
  it('splits astral Unicode without breaking characters and retains exact bytes', () => {
    const payload = { body: '😀한글'.repeat(10000) };
    const encoded = encodeReport(payload);
    expect(encoded.chunks.length).toBeGreaterThan(3);
    expect(encoded.chunks.every(chunk => Array.from(chunk).length <= 8000)).toBe(true);
    expect(encoded.chunks.every(chunk => Buffer.byteLength(chunk, 'utf8') <= 32000)).toBe(true);
    expect(JSON.parse(encoded.chunks.join(''))).toEqual(payload);
    expect(reportHash(encoded.chunks.join(''))).toBe(encoded.hash);
  });
  it('canonicalizes object keys but preserves array order, exact decimals and plaintext', () => {
    expect(canonicalReport({ z: '9007199254740993.01', a: '<script>"&\n' })).toBe(
      canonicalReport({ a: '<script>"&\n', z: '9007199254740993.01' }),
    );
    expect(canonicalReport([1, 2])).not.toBe(canonicalReport([2, 1]));
  });
  it.each(['datas', 'sql', 'evidence', 'sourceId'])('rejects client %s before execution', key => {
    expect(() => parseReport(reportSaveRequest, { ...command(), [key]: [] })).toThrow();
  });
  it('rejects nested tampering and invalid Unicode, body and snapshot limits', () => {
    const input = command();
    expect(() =>
      parseReport(reportSaveRequest, { ...input, data: { ...input.data, datas: [] } }),
    ).toThrow();
    expect(() => parseReport(reportSaveRequest, { ...input, body: '\ud800' })).toThrow();
    expect(() => parseReport(reportSaveRequest, { ...input, body: '😀'.repeat(16385) })).toThrow();
    expect(() =>
      parseReport(reportSaveRequest, { ...input, body: '😀'.repeat(16384) }),
    ).not.toThrow();
    expect(() => encodeReport({ body: 'a'.repeat(2 * 1024 * 1024) })).toThrow();
    expect(() => encodeReport({ value: Infinity })).toThrow();
  });
});
