import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { documentService } from '@/api/documentService';
import { DocumentFrame } from './shared';

const PENDING = 'vm:microsoft-oauth:v1';
const verifier = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...Array.from(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export default function MicrosoftConnect() {
  const [params] = useSearchParams();
  const [itemId, setItemId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [doc, setDoc] = useState<{ name: string; markdown: string; mimeType: string } | null>(null);
  const code = params.get('code');

  useEffect(() => {
    if (!code) return;
    const raw = sessionStorage.getItem(PENDING);
    const pending = raw ? (JSON.parse(raw) as { state: string; verifier: string; itemId: string }) : null;
    if (!pending || pending.state !== params.get('state')) {
      setError('승인 요청을 찾지 못했습니다. 처음부터 다시 시도해 주세요.');
      return;
    }
    setBusy(true);
    documentService
      .microsoftPreview({ code, verifier: pending.verifier, itemId: pending.itemId })
      .then(value => {
        sessionStorage.removeItem(PENDING);
        setDoc(value as { name: string; markdown: string; mimeType: string });
      })
      .catch(() => setError('Microsoft 문서를 읽지 못했습니다. 권한과 파일 형식을 확인해 주세요.'))
      .finally(() => setBusy(false));
  }, [code]);

  const start = async () => {
    setError('');
    if (!itemId.trim()) {
      setError('OneDrive 문서 주소나 항목 ID를 입력해 주세요.');
      return;
    }
    setBusy(true);
    try {
      const v = verifier();
      const { authorizationUrl, state } = await documentService.microsoftAuthorization(v);
      sessionStorage.setItem(PENDING, JSON.stringify({ state, verifier: v, itemId: itemId.trim() }));
      window.location.assign(authorizationUrl);
    } catch {
      setError('Microsoft 승인을 시작하지 못했습니다. 관리자 설정을 확인해 주세요.');
      setBusy(false);
    }
  };

  return (
    <DocumentFrame title="Microsoft 문서 연결">
      <p className="text-sm text-muted-foreground">
        OneDrive의 텍스트 문서를 읽어 내용을 확인합니다. 라이브러리 저장과 버전 고정은 다음 단계입니다.
      </p>
      {doc ? (
        <section aria-label="Microsoft 문서 내용" className="mt-4 rounded-xl border p-5">
          <h2 className="font-semibold">{doc.name}</h2>
          <p className="text-xs text-muted-foreground">{doc.mimeType}</p>
          <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap break-words text-sm">
            {doc.markdown.slice(0, 4000)}
          </pre>
          <p className="mt-3 text-sm text-muted-foreground">
            미리보기만 제공합니다. 저장·공유는 아직 연결되지 않았습니다.
          </p>
        </section>
      ) : code ? (
        <p role="status" className="mt-4">{busy ? '문서를 읽는 중입니다…' : error}</p>
      ) : (
        <div className="mt-4 grid max-w-xl gap-4">
          <label className="grid gap-1 text-sm">
            OneDrive 문서 주소 또는 항목 ID
            <input
              className="h-10 rounded-md border bg-background px-3"
              value={itemId}
              onChange={event => setItemId(event.target.value)}
            />
          </label>
          {error && <p role="alert" className="text-sm">{error}</p>}
          <Button className="h-10 justify-self-start" disabled={busy} onClick={start}>
            {busy ? '이동 중…' : 'Microsoft로 승인하고 읽기'}
          </Button>
          <Link className="text-sm underline" to="/documents">
            문서 목록으로
          </Link>
        </div>
      )}
      {error && code && <p role="alert" className="mt-2 text-sm">{error}</p>}
    </DocumentFrame>
  );
}

