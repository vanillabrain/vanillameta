import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { get } from '@/helpers/apiHelper';
import { getToken } from '@/helpers/authHelper';
import { fetchContext } from '@/api/enterpriseService';
import { personalLibrarySessionScope } from '@/api/personalLibraryService';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { StudioRemixFlow } from './StudioRemix';
import { saveRemix } from './studioRemixApi';
import {
  clearReceivedRemixPending,
  readReceivedRemixPending,
  ReceivedRemixPending,
  ReceivedRemixScope,
  saveReceivedRemixPending,
  validReceivedReference,
} from './receivedRemixPendingStorage';
import ReceivedRemixRecovery from './ReceivedRemixRecovery';
// Claims are only a response/cache fence. Membership and authorization are read from the server.
function cachedActor() {
  try {
    const token = getToken();
    const actor = token && JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))?.accessKeyData?.id;
    return Number.isSafeInteger(actor) && actor > 0 ? (actor as number) : null;
  } catch {
    return null;
  }
}
export default function StudioReceivedRemix() {
  const { dashboardId = '' } = useParams();
  const [session, setSession] = useState(() => personalLibrarySessionScope());
  useEffect(() => {
    const check = () => setSession(personalLibrarySessionScope());
    window.addEventListener('storage', check);
    window.addEventListener('focus', check);
    return () => {
      window.removeEventListener('storage', check);
      window.removeEventListener('focus', check);
    };
  }, []);
  return <ReceivedFlow key={JSON.stringify([dashboardId, session])} dashboardId={dashboardId} session={session} />;
}
function ReceivedFlow({ dashboardId, session }: { dashboardId: string; session: string | null }) {
  const navigate = useNavigate();
  const [scope, setScope] = useState<ReceivedRemixScope | null>(null);
  const [reference, setReference] = useState(''),
    [error, setError] = useState(''),
    [reload, setReload] = useState(0);
  const [pending, setPending] = useState<ReceivedRemixPending | null>(null),
    [storageError, setStorageError] = useState(false);
  const generation = useRef(0);
  const actor = cachedActor();
  const currentIdentity = () => session !== null && personalLibrarySessionScope() === session && cachedActor() === actor;
  useEffect(() => {
    generation.current += 1;
    const epoch = generation.current;
    const controller = new AbortController();
    const current = () => epoch === generation.current && !controller.signal.aborted && currentIdentity();
    setReference('');
    setScope(null);
    setPending(null);
    setStorageError(false);
    setError('');
    if (!session || !/^[1-9][0-9]*$/.test(dashboardId) || !Number.isSafeInteger(Number(dashboardId))) {
      setError('로그인과 받은 자료 번호를 확인해 주세요.');
      return () => {
        generation.current += 1;
        controller.abort();
      };
    }
    void (async () => {
      try {
        const context = await fetchContext({ signal: controller.signal });
        if (!current()) return;
        if (!context.organization || !context.membership || (actor !== null && context.membership.userId !== actor))
          throw new Error('organization required');
        const nextScope: ReceivedRemixScope = {
          actorId: context.membership.userId,
          organizationId: context.organization.id,
          originId: Number(dashboardId),
          session,
        };
        const restored = readReceivedRemixPending(nextScope);
        setScope(nextScope);
        setPending(restored.pending);
        setStorageError(restored.error);
        if (restored.pending || restored.error) return;
        const { data } = await get(`/studio/received/${dashboardId}/remix-reference`);
        if (!current()) return;
        if (!validReceivedReference(data?.reference, nextScope.originId, nextScope.organizationId))
          throw new Error('invalid reference');
        setReference(data.reference);
      } catch {
        if (current())
          setError('현재 조직·복제 허용과 원본을 확인하지 못했습니다. 받은 자료에서 권한을 확인한 뒤 다시 시도해 주세요.');
      }
    })();
    return () => {
      generation.current += 1;
      controller.abort();
    };
  }, [dashboardId, reload, session]);
  if (scope && (pending || storageError))
    return (
      <ReceivedRemixRecovery
        key={JSON.stringify([scope, pending])}
        scope={scope}
        pending={pending}
        storageError={storageError}
        onOpen={id => {
          if (currentIdentity()) navigate(`/dashboard/${id}/studio`);
        }}
        onDiscard={() => {
          setReload(v => v + 1);
        }}
      />
    );
  if (reference && scope)
    return (
      <StudioRemixFlow
        key={reference}
        token={reference}
        onOriginRefresh={() => setReload(v => v + 1)}
        onSave={async (request, isCurrent) => {
          const epoch = generation.current;
          const current = () => epoch === generation.current && currentIdentity() && isCurrent();
          if (!current()) return;
          const ticket: ReceivedRemixPending = {
            savedAt: Date.now(),
            actorId: scope.actorId,
            organizationId: scope.organizationId,
            originId: scope.originId,
            reference,
            input: JSON.parse(JSON.stringify(request)),
          };
          const restored = readReceivedRemixPending(scope);
          if (restored.error || restored.pending || !saveReceivedRemixPending(scope, ticket)) {
            setPending(restored.pending);
            setStorageError(true);
            throw new Error('storage unavailable');
          }
          try {
            // Keep the live flow mounted while its isCurrent callback owns the successful navigation.
            const result = await saveRemix(reference, ticket.input);
            if (!current()) return;
            if (!clearReceivedRemixPending(scope)) {
              setPending(ticket);
              setStorageError(true);
              return;
            }
            navigate(`/dashboard/${result.dashboardId}/studio`);
          } catch (cause) {
            if (current()) setPending(ticket);
            throw cause;
          }
        }}
      />
    );
  return (
    <section className="mx-auto max-w-3xl min-w-0 space-y-3 p-4 text-sm">
      <h1 className="text-lg font-semibold">받은 분석을 내 소스로 복제</h1>
      {error ? (
        <>
          <Notice severity="error">{error}</Notice>
          <Button size="sm" onClick={() => setReload(v => v + 1)}>
            복제 허용 다시 확인
          </Button>
        </>
      ) : (
        <p role="status">조직·복제 허용과 원본을 확인하는 중…</p>
      )}
      <Button asChild size="sm" variant="outline">
        <a href="/organization">받은 자료로 돌아가기</a>
      </Button>
    </section>
  );
}
