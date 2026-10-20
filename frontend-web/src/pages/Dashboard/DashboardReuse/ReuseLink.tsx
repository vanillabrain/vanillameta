import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { getToken } from '@/helpers/authHelper';
/** Anonymous availability contains no recipe, source or authentication data. */
export default function ReuseLink({ kind, uuid }: { kind: 'share' | 'publication'; uuid: string }) {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    setAllowed(false);
    const api = String(import.meta.env.REACT_APP_API_URL || '').replace(/\/$/, '');
    fetch(`${api}/reuse-links/${kind}/${encodeURIComponent(uuid)}`, { signal: abort.signal, credentials: 'omit' })
      .then(async r => {
        if (!r.ok) return;
        const value = await r.json();
        if (!abort.signal.aborted) setAllowed(value.status === 'SUCCESS' && value.data?.reusable === true);
      })
      .catch(() => {
        // A failed availability read keeps the optional reuse action hidden.
        if (!abort.signal.aborted) setAllowed(false);
      });
    return () => abort.abort();
  }, [kind, uuid]);
  if (!allowed) return null;
  const path = `/reuse/${kind}/${encodeURIComponent(uuid)}`;
  return (
    <div className="my-3 flex flex-wrap items-center gap-2">
      <Button asChild variant="outline" size="sm">
        <Link to={getToken() ? path : `/login?returnTo=${encodeURIComponent(path)}`}>내 소스로 복제</Link>
      </Button>
      <span className="text-xs text-muted-foreground">내 데이터로 새 비공개 대시보드를 만듭니다.</span>
    </div>
  );
}
