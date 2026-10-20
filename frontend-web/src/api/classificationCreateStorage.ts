import { ClassificationCreate, classificationName } from './classificationService';
const PREFIX = 'vanillameta:classification-create:v1:';
const TTL = 24 * 60 * 60 * 1000;
const key = (session: string | null, actorId: number, organizationId: number) =>
  session && Number.isSafeInteger(actorId) && actorId > 0 && Number.isSafeInteger(organizationId) && organizationId > 0
    ? `${PREFIX}${session}:${actorId}:${organizationId}`
    : null;
const valid = (body: any, actorId: number, organizationId: number): body is ClassificationCreate => {
  try {
    return (
      body &&
      typeof body === 'object' &&
      Object.keys(body).length === 4 &&
      ['expectedActorId', 'expectedOrganizationId', 'requestId', 'name'].every(k =>
        Object.prototype.hasOwnProperty.call(body, k),
      ) &&
      body.expectedActorId === actorId &&
      body.expectedOrganizationId === organizationId &&
      typeof body.requestId === 'string' &&
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(body.requestId) &&
      typeof body.name === 'string' &&
      classificationName(body.name) === body.name
    );
  } catch {
    return false;
  }
};
export function storeClassificationCreate(session: string | null, body: ClassificationCreate, now = Date.now()): boolean {
  const storageKey = key(session, body.expectedActorId, body.expectedOrganizationId);
  if (!storageKey || !valid(body, body.expectedActorId, body.expectedOrganizationId)) return false;
  const text = JSON.stringify({ schemaVersion: 1, savedAt: now, body });
  if (new TextEncoder().encode(text).length > 8192) return false;
  try {
    sessionStorage.setItem(storageKey, text);
    return sessionStorage.getItem(storageKey) === text;
  } catch {
    return false;
  }
}
export function readClassificationCreate(
  session: string | null,
  actorId: number,
  organizationId: number,
  now = Date.now(),
): { record: ClassificationCreate | null; error: boolean } {
  const storageKey = key(session, actorId, organizationId);
  if (!storageKey) return { record: null, error: false };
  let text: string | null;
  try {
    text = sessionStorage.getItem(storageKey);
  } catch {
    return { record: null, error: true };
  }
  try {
    if (!text || new TextEncoder().encode(text).length > 8192) return { record: null, error: false };
    const value = JSON.parse(text);
    if (
      !value ||
      Object.keys(value).length !== 3 ||
      value.schemaVersion !== 1 ||
      !Number.isSafeInteger(value.savedAt) ||
      value.savedAt > now ||
      now - value.savedAt >= TTL ||
      !valid(value.body, actorId, organizationId)
    )
      return { record: null, error: false };
    return { record: value.body, error: false };
  } catch {
    return { record: null, error: false };
  }
}
export function clearClassificationCreate(session: string | null, actorId: number, organizationId: number): boolean {
  const storageKey = key(session, actorId, organizationId);
  if (!storageKey) return true;
  try {
    sessionStorage.removeItem(storageKey);
    return sessionStorage.getItem(storageKey) === null;
  } catch {
    return false;
  }
}
