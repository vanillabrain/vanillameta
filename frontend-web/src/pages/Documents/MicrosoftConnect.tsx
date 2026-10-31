import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { documentService } from '@/api/documentService';
import { DocumentFrame } from './shared';

type Pending = { state: string; verifier: string; itemId: string; mode: 'preview' | 'save' };
const PENDING = 'vm:microsoft-oauth:v1';
const verifier = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...Array.from(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

export default function MicrosoftConnect() {
  const [params] = useSearchParams();
  const [itemId, setItemId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [doc, setDoc] = useState<{ name: string; markdown: string; mimeType: string } | null>(null);
  const [saved, setSaved] = useState<{ documentId: string; version: number; title: string } | null>(null);
  const code = params.get('code');

  useEffect(() => {
    if (!code) return;
    const raw = sessionStorage.getItem(PENDING);
    const pending = raw ? (JSON.parse(raw) as Pending) : null;
    if (!pending || pending.state !== params.get('state')) {
      setError('승인 요청을 찾지 못했습니다. 처음부터 다시 시도해 주세요.');
      return;
    }
    setBusy(true);
    const call =
      pending.mode === 'save'
        ? documentService.microsoftSave({ code, verifier: pending.verifier, itemId: pending.itemId })
        : documentService.microsoftPreview({ code, verifier: pending.verifier, itemId: pending.itemId });
    call
      .then(value => {
        sessionStorage.removeItem(PENDING);
        if ('documentId' in value) setSaved(value);
        else setDoc(value as { name: string; markdown: string; mimeType: string });
      })
      .catch(() =>
        setError(
          pending.mode === 'save'
            ? '문서를 저장하지 못했습니다. 권한·조직 소속·파일 형식을 확인해 주세요.'
            : 'Microsoft 문서를 읽지 못했습니다. 권한과 파일 형식을 확인해 주세요.',
        ),
      )
      .finally(() => setBusy(false));
  }, [code]);

  const start = async (mode: 'preview' | 'save') => {
    setError('');
    if (!itemId.trim()) {
      setError('OneDrive 문서 주소나 항목 ID를 입력해 주세요.');
      return;
    }
    setBusy(true);
    try {
      const v = verifier();
      const { authorizationUrl, state } = await documentService.microsoftAuthorization(v);
      sessionStorage.setItem(PENDING, JSON.stringify({ state, verifier: v, itemId: itemId.trim(), mode }));
      window.location.assign(authorizationUrl);
    } catch {
      setError('Microsoft 승인을 시작하지 못했습니다. 관리자 설정을 확인해 주세요.');
      setBusy(false);
    }
  };

  return (
    <DocumentFrame title="Microsoft 문서 연결">
      <p className="text-sm text-muted-foreground">
        OneDrive의 텍스트 문서를 읽습니다. 저장을 선택하면 이 시점의 본문이 비공개 버전 1로 고정되고 이후 원본 변경과
        분리됩니다.
      </p>
      {saved ? (
        <section aria-label="저장 결과" className="mt-4 rounded-xl border p-5">
          <h2 className="font-semibold">{saved.title}</h2>
          <p className="text-sm">비공개 버전 {saved.version}으로 저장했습니다.</p>
          <Button asChild className="mt-3 h-10" variant="outline">
            <Link to={'/documents/' + saved.documentId}>저장한 문서 열기</Link>
          </Button>
        </section>
      ) : doc ? (
        <section aria-label="Microsoft 문서 내용" className="mt-4 rounded-xl border p-5">
          <h2 className="font-semibold">{doc.name}</h2>
          <p className="text-xs text-muted-foreground">{doc.mimeType}</p>
          <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap break-words text-sm">
            {doc.markdown.slice(0, 4000)}
          </pre>
          <p className="mt-3 text-sm text-muted-foreground">
            미리보기는 저장하지 않습니다. 저장하려면 승인을 다시 진행해 주세요.
          </p>
          <Button className="mt-3 h-10" variant="outline" onClick={() => start('save')}>
            비공개로 저장
          </Button>
        </section>
      ) : code ? (
        <p role="status" className="mt-4">
          {busy ? '문서를 처리하는 중입니다…' : error}
        </p>
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
          {error && (
            <p role="alert" className="text-sm">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button className="h-10" variant="outline" disabled={busy} onClick={() => start('preview')}>
              미리보기
            </Button>
            <Button className="h-10" disabled={busy} onClick={() => start('save')}>
              {busy ? '이동 중…' : '비공개로 저장'}
            </Button>
          </div>
          <Link className="text-sm underline" to="/documents">
            문서 목록으로
          </Link>
        </div>
      )}
      {error && code && (
        <p role="alert" className="mt-2 text-sm">
          {error}
        </p>
      )}
    </DocumentFrame>
  );
}
