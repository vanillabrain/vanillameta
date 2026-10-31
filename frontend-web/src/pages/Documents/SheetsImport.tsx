import React, { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { documentService } from '@/api/documentService';
import { DocumentFrame } from './shared';

const PENDING = 'vm:sheets-oauth:v1';
const idFrom = (value: string) => {
  const match = /\/spreadsheets\/d\/([A-Za-z0-9_-]{10,200})/.exec(value);
  return match ? match[1] : value.trim();
};
const verifier = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...Array.from(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export default function SheetsImport() {
  const [params] = useSearchParams();
  const location = useLocation();
  const [sheet, setSheet] = useState('');
  const [range, setRange] = useState('A1:Z1000');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ databaseId: number; name: string; rowCount: number } | null>(null);
  const code = params.get('code');

  React.useEffect(() => {
    if (!code) return;
    const raw = sessionStorage.getItem(PENDING);
    const pending = raw ? (JSON.parse(raw) as { state: string; verifier: string; spreadsheetId: string; range: string; name: string }) : null;
    if (!pending || pending.state !== params.get('state')) {
      setError('승인 요청을 찾지 못했습니다. 처음부터 다시 시도해 주세요.');
      return;
    }
    setBusy(true);
    documentService
      .sheetsImport({ code, verifier: pending.verifier, spreadsheetId: pending.spreadsheetId, range: pending.range, name: pending.name })
      .then(value => {
        sessionStorage.removeItem(PENDING);
        setResult(value as { databaseId: number; name: string; rowCount: number });
      })
      .catch(() => setError('시트를 데이터소스로 등록하지 못했습니다. 권한과 범위를 확인해 주세요.'))
      .finally(() => setBusy(false));
  }, [code]);

  const start = async () => {
    setError('');
    const spreadsheetId = idFrom(sheet);
    if (!/^[A-Za-z0-9_-]{10,200}$/.test(spreadsheetId) || !name.trim()) {
      setError('시트 주소나 ID와 데이터소스 이름을 확인해 주세요.');
      return;
    }
    setBusy(true);
    try {
      const v = verifier();
      const { authorizationUrl, state } = await documentService.sheetsAuthorization(v);
      sessionStorage.setItem(PENDING, JSON.stringify({ state, verifier: v, spreadsheetId, range, name: name.trim() }));
      window.location.assign(authorizationUrl);
    } catch {
      setError('Google Sheets 승인을 시작하지 못했습니다. 관리자 설정을 확인해 주세요.');
      setBusy(false);
    }
  };

  return (
    <DocumentFrame title="Sheets 가져오기">
      <p className="text-sm text-muted-foreground">
        Google Sheets 범위를 읽어 DuckDB 파일 데이터소스로 등록합니다. 값은 복사되며 원본 시트 권한은 부여하지 않습니다.
      </p>
      {result ? (
        <section aria-label="등록 결과" className="mt-4 rounded-xl border p-5">
          <h2 className="font-semibold">{result.name}</h2>
          <p className="text-sm">데이터소스 #{result.databaseId} · {result.rowCount.toLocaleString()}행</p>
          <Button asChild className="mt-3 h-10" variant="outline">
            <Link to="/data/file">파일 데이터에서 열기</Link>
          </Button>
        </section>
      ) : code ? (
        <p role="status" className="mt-4">{busy ? '시트를 등록하는 중입니다…' : error}</p>
      ) : (
        <div className="mt-4 grid max-w-xl gap-4">
          <label className="grid gap-1 text-sm">
            시트 주소 또는 ID
            <input className="h-10 rounded-md border bg-background px-3" value={sheet} onChange={event => setSheet(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            범위
            <input className="h-10 rounded-md border bg-background px-3" value={range} onChange={event => setRange(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            데이터소스 이름
            <input className="h-10 rounded-md border bg-background px-3" value={name} onChange={event => setName(event.target.value)} />
          </label>
          {error && <p role="alert" className="text-sm">{error}</p>}
          <Button className="h-10 justify-self-start" disabled={busy} onClick={start}>
            {busy ? '이동 중…' : 'Google로 승인하고 가져오기'}
          </Button>
          <Link className="text-sm underline" to={location.pathname.replace(/\/sheets.*/, '')}>
            문서 목록으로
          </Link>
        </div>
      )}
      {error && code && <p role="alert" className="mt-2 text-sm">{error}</p>}
    </DocumentFrame>
  );
}

