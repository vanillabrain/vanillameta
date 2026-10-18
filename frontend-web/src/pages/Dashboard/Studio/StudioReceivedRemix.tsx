import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { get } from '@/helpers/apiHelper';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { StudioRemixFlow } from './StudioRemix';
import { saveRemix } from './studioRemixApi';

export default function StudioReceivedRemix() {
  const { dashboardId = '' } = useParams();
  const navigate = useNavigate();
  const [reference, setReference] = useState(''),
    [error, setError] = useState(''),
    [reload, setReload] = useState(0);
  useEffect(() => {
    let current = true;
    setReference('');
    setError('');
    if (!/^[1-9][0-9]*$/.test(dashboardId) || !Number.isSafeInteger(Number(dashboardId))) {
      setError('받은 자료 번호를 확인해 주세요.');
      return () => {
        current = false;
      };
    }
    get(`/studio/received/${dashboardId}/remix-reference`)
      .then(({ data }) => {
        if (!current) return;
        if (
          typeof data?.reference !== 'string' ||
          !new RegExp('^d-[1-9][0-9]*-[1-9][0-9]*-' + dashboardId + '-[1-9][0-9]*-[a-f0-9]{64}$').test(data.reference)
        )
          throw new Error('invalid reference');
        setReference(data.reference);
      })
      .catch(() => {
        if (current)
          setError('현재 복제 허용과 원본을 확인하지 못했습니다. 받은 자료에서 권한을 확인한 뒤 다시 시도해 주세요.');
      });
    return () => {
      current = false;
    };
  }, [dashboardId, reload]);
  if (reference)
    return (
      <StudioRemixFlow
        key={reference}
        token={reference}
        onOriginRefresh={() => setReload(value => value + 1)}
        onSave={async (request, isCurrent) => {
          const result = await saveRemix(reference, request);
          if (isCurrent()) navigate(`/dashboard/${result.dashboardId}/studio`);
        }}
      />
    );
  return (
    <section className="mx-auto max-w-3xl min-w-0 space-y-3 p-4 text-sm">
      <h1 className="text-lg font-semibold">받은 분석을 내 소스로 복제</h1>
      {error ? (
        <>
          <Notice severity="error">{error}</Notice>
          <Button size="sm" onClick={() => setReload(value => value + 1)}>
            복제 허용 다시 확인
          </Button>
        </>
      ) : (
        <p role="status">복제 허용과 원본을 확인하는 중…</p>
      )}
      <Button asChild size="sm" variant="outline">
        <a href="/organization">받은 자료로 돌아가기</a>
      </Button>
    </section>
  );
}
