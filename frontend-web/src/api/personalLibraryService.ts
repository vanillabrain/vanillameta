import { get, put } from '@/helpers/apiHelper';
import { getToken } from '@/helpers/authHelper';
import { editorDraftSessionEpoch } from '@/helpers/editorDraftStorage';

let fallbackSession: { token: string; scope: string } | null = null;
/** Cache/response ownership only: server authorization remains mandatory for every request. */
export function personalLibrarySessionScope(): string | null {
  const token = getToken();
  if (!token) {
    fallbackSession = null;
    return null;
  }
  const epoch = editorDraftSessionEpoch();
  if (epoch !== null) {
    try {
      const encoded = token.split('.')[1];
      const actor = JSON.parse(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')))?.accessKeyData;
      if (
        Number.isSafeInteger(actor?.id) &&
        actor.id > 0 &&
        Number.isSafeInteger(actor.authVersion) &&
        actor.authVersion >= 0
      ) {
        fallbackSession = null;
        // Metadata is published before the new token: bind that epoch to its current actor/epoch claims too.
        // Decoding is only a cache fence, never authorization. Issued-at and signature changes are irrelevant.
        return JSON.stringify([epoch, actor.id, actor.authVersion]);
      }
    } catch {
      // Undecodable identities remain token-isolated until server authorization decides the request.
    }
  }
  // Optional metadata/identity may be unreadable. Tokens stay in RAM; keys contain only an opaque UUID.
  if (fallbackSession?.token !== token) fallbackSession = { token, scope: `ephemeral:${crypto.randomUUID()}` };
  return epoch === null ? fallbackSession.scope : JSON.stringify([epoch, fallbackSession.scope]);
}

export type LibraryView = 'active' | 'archived';
export type LibraryEntry = {
  id: number;
  title: string;
  updatedAt?: string;
  analysisDefinition?: string;
  library: { archived: boolean; version: number };
};
export type PersonalLibrary = {
  entries: LibraryEntry[];
  canArchive: boolean;
  organizationId: number | null;
  actorId: number;
  view: LibraryView;
};
export type LibraryWriteInput = {
  archived: boolean;
  expectedVersion: number;
  expectedOrganizationId: number;
  expectedActorId: number;
};
export type LibraryReceipt = { dashboardId: number; organizationId: number; archived: boolean; version: number };
const positive = (value: unknown) => Number.isSafeInteger(value) && Number(value) > 0;
const version = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;
const unwrap = (response: any) => {
  if (response?.data?.status !== 'SUCCESS') throw new Error('invalid library response');
  return response.data.data;
};

export async function fetchPersonalLibrary(view: LibraryView, signal?: AbortSignal): Promise<PersonalLibrary> {
  const data = unwrap(await get('/dashboard/library', { view }, { signal }));
  if (
    !data ||
    data.view !== view ||
    typeof data.canArchive !== 'boolean' ||
    !positive(data.actorId) ||
    !(data.organizationId === null || positive(data.organizationId)) ||
    (data.canArchive && data.organizationId === null) ||
    (!data.canArchive && (data.organizationId !== null || (view === 'archived' && data.entries?.length !== 0))) ||
    !Array.isArray(data.entries) ||
    !data.entries.every(
      (entry: any) =>
        positive(entry?.id) &&
        typeof entry.title === 'string' &&
        entry.library?.archived === (view === 'archived') &&
        version(entry.library.version),
    ) ||
    new Set(data.entries.map((entry: LibraryEntry) => entry.id)).size !== data.entries.length
  )
    throw new Error('invalid library list');
  return data;
}

export async function savePersonalLibrary(
  entry: LibraryEntry,
  organizationId: number,
  actorId: number,
): Promise<LibraryReceipt> {
  if (!positive(organizationId)) throw new Error('confirmed organization required');
  if (!positive(actorId)) throw new Error('confirmed actor required');
  const archived = !entry.library.archived;
  const input: LibraryWriteInput = {
    archived,
    expectedVersion: entry.library.version,
    expectedOrganizationId: organizationId,
    expectedActorId: actorId,
  };
  const data = unwrap(await put(`/dashboard/${entry.id}/library`, input));
  if (
    !data ||
    data.dashboardId !== entry.id ||
    data.organizationId !== organizationId ||
    data.archived !== archived ||
    !version(data.version) ||
    data.version <= entry.library.version
  )
    throw new Error('invalid library receipt');
  return data;
}

export function personalLibraryError(error: any): string {
  if (error?.response?.status === 409) return '보관 상태가 변경되었습니다. 목록을 다시 읽은 뒤 이어서 진행해 주세요.';
  if (error?.response?.status === 401 || error?.response?.status === 403)
    return '현재 보관 상태를 변경할 권한을 확인할 수 없습니다. 목록을 다시 읽어 주세요.';
  return '보관·복원 결과를 확인하지 못했습니다. 목록을 다시 읽어 현재 상태를 확인해 주세요.';
}
