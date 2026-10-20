import { getToken } from './authHelper';
import { editorDraftSessionEpoch } from './editorDraftStorage';

function tokenSubject(token: string | null): number | null {
  try {
    if (!token || token.length > 32768) return null;
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const value = JSON.parse(atob(part)).accessKeyData?.id;
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}
/** Client response fence only; actual authority is verified by the server JWT guard and policy. */
export function captureAuthResponseFence() {
  const epoch = editorDraftSessionEpoch(),
    token = getToken(),
    subject = tokenSubject(token);
  return () => {
    const current = getToken();
    if (
      !token ||
      !current ||
      (epoch ? editorDraftSessionEpoch() !== epoch : current !== token) ||
      (subject !== null ? tokenSubject(current) !== subject : current !== token)
    )
      throw { response: { status: 403 } };
  };
}
