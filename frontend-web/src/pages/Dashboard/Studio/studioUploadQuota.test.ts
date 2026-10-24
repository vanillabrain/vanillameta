import { describe, expect, it } from 'vitest';
import { creationError } from './studioCreation';
import { remixError } from './studioRemixApi';
import { uploadQuotaMessage } from './studioUploadQuota';

const refusal = (data: unknown, status = 403) => ({ response: { status, data } });
const quota = {
  success: false,
  code: 403,
  data: {
    error: 'UPLOAD_QUOTA_EXCEEDED',
    message: '저장 용량 한도에 도달했습니다. 사용하지 않는 소스를 삭제해 주세요.',
    reason: 'bytes',
  },
};

describe('upload quota refusals in Studio', () => {
  it('reads the server message from a 403 carrying UPLOAD_QUOTA_EXCEEDED', () => {
    expect(uploadQuotaMessage(refusal(quota))).toBe(quota.data.message);
    expect(uploadQuotaMessage(refusal(quota.data))).toBe(quota.data.message);
  });

  it('ignores every other error, including a plain permission 403', () => {
    expect(uploadQuotaMessage(refusal({ success: false, code: 403, data: { message: 'Forbidden' } }))).toBeUndefined();
    expect(uploadQuotaMessage(refusal(quota, 429))).toBeUndefined();
    expect(uploadQuotaMessage(new Error('offline'))).toBeUndefined();
    expect(uploadQuotaMessage(undefined)).toBeUndefined();
  });

  it('falls back to a fixed sentence when the server message is missing or oversized', () => {
    const fixed = '저장 용량 한도에 도달했습니다. 사용하지 않는 소스를 삭제한 뒤 다시 시도해 주세요.';
    expect(uploadQuotaMessage(refusal({ data: { error: 'UPLOAD_QUOTA_EXCEEDED' } }))).toBe(fixed);
    expect(uploadQuotaMessage(refusal({ data: { error: 'UPLOAD_QUOTA_EXCEEDED', message: 'x'.repeat(301) } }))).toBe(fixed);
  });

  it('shows it instead of the permission sentence in creation and remix, but keeps that sentence otherwise', () => {
    expect(creationError(refusal(quota), 'file')).toBe(quota.data.message);
    expect(remixError(refusal(quota))).toBe(quota.data.message);
    expect(remixError(refusal(quota), true)).toBe(quota.data.message);
    expect(creationError(refusal({ data: { message: 'Forbidden' } }), 'file')).toContain('권한이 없습니다');
    expect(remixError(refusal({ data: { message: 'Forbidden' } }))).toContain('권한이 없습니다');
  });
});
