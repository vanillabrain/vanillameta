import React, { useEffect, useRef, useState } from 'react';
import { enterpriseError } from '@/api/enterpriseService';
import { HandoverProposal, HandoverScope } from '@/api/handoverService';
import {
  HandoverDependencyReport,
  HandoverDependencyAsset,
  fetchHandoverDependencyReview,
} from '@/api/handoverReviewService';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';

type Props = { review: HandoverProposal; scope: HandoverScope; organizationVersion: number };
const dependencyLabel: Record<HandoverDependencyAsset['dependencyStatus'], string> = {
  covered: '저장 연결이 선택 범위에 포함됨',
  missing: '선택에 포함되지 않은 소스 있음',
  unresolved: '저장 연결을 확정할 수 없음',
};
const storageLabel: Record<HandoverDependencyAsset['storage'], string> = {
  not_applicable: '소스별 보관 조건에서 확인',
  file_review_required: '파일 실체·보관 주체 별도 검토 필요',
  connection_review_required: '외부 연결·계정 별도 검토 필요',
  unresolved: '보관 조건을 확인할 수 없음',
};
export default function HandoverDependencyReview(props: Props) {
  const { review, scope } = props;
  const allowed =
    scope.actorId === review.ownerId &&
    scope.organizationId === review.organizationId &&
    review.status === 'accepted' &&
    review.detailsAvailable &&
    !review.expired;
  // Changed scope or frozen review fields withdraw previous reports without fetching.
  const identity = JSON.stringify([scope, props.organizationVersion, review]);
  return allowed ? <DependencyRead key={identity} {...props} /> : null;
}
function DependencyRead({ review, scope }: Props) {
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState<HandoverDependencyReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const abort = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      generation.current += 1;
      abort.current?.abort();
    },
    [],
  );
  const clear = () => {
    generation.current += 1;
    abort.current?.abort();
    abort.current = null;
    setReport(null);
    setError('');
    setBusy(false);
  };
  const load = async () => {
    if (!open || busy) return;
    clear();
    const token = generation.current,
      controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    try {
      const next = await fetchHandoverDependencyReview(review, scope, { signal: controller.signal });
      if (generation.current === token && !controller.signal.aborted) setReport(next);
    } catch (cause) {
      if (generation.current === token && !controller.signal.aborted) setError(enterpriseError(cause).message);
    } finally {
      if (generation.current === token) {
        setBusy(false);
        abort.current = null;
      }
    }
  };
  return (
    <section aria-label="인계 전 연결 자료·보관 조건" className="min-w-0 rounded-lg border border-border p-3">
      <Button
        size="sm"
        variant="ghost"
        aria-expanded={open}
        onClick={() => {
          clear();
          setOpen(!open);
        }}
      >
        연결 자료·보관 조건 확인 {open ? '접기' : '열기'}
      </Button>
      {open && (
        <div className="mt-2 flex min-w-0 flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            선택 자료에서 연결된 소스와 보관 검토 필요만 확인합니다. 실제 이전·복사·권한 부여를 실행할 수 있는 승인이
            아닙니다.
          </p>
          <Button className="self-start" variant="outline" disabled={busy} onClick={() => void load()}>
            {busy ? '연결 자료 확인 중…' : '연결 자료·보관 조건 조회'}
          </Button>
          {report && (
            <div className="flex min-w-0 flex-col gap-2">
              <p role="status" className="wrap-anywhere text-xs">
                의향 버전 {report.proposalVersion} · 확인 시각 {new Date(report.checkedAt).toLocaleString()} · 실제 이전 실행
                불가
              </p>
              <ul className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2" aria-label="선택 자료별 연결·보관 검토">
                {report.assets.map(asset => (
                  <li key={`${asset.kind}:${asset.id}`} className="min-w-0 rounded-md bg-muted/40 p-3">
                    <h4 className="wrap-anywhere text-sm font-medium">
                      {asset.kind === 'source' ? '소스' : '대시보드'} #{asset.id} · {asset.title}
                    </h4>
                    {asset.kind === 'dashboard' && <p className="mt-1 text-xs">{dependencyLabel[asset.dependencyStatus]}</p>}
                    <dl className="mt-2 grid min-w-0 grid-cols-2 gap-2 text-xs">
                      {asset.kind === 'dashboard' &&
                        (
                          [
                            ['필요한 소스', asset.requiredSources],
                            ['선택한 소스', asset.selectedSources],
                            ['선택 누락 본인 소스', asset.missingOwnedSources],
                            ['타인·소유 미확인 소스', asset.otherSources],
                          ] as const
                        ).map(([label, count]) => (
                          <div key={label}>
                            <dt className="break-words text-muted-foreground">{label}</dt>
                            <dd className="tabular-nums">{count.toLocaleString()}개</dd>
                          </div>
                        ))}
                      {asset.kind === 'source' && (
                        <div>
                          <dt className="text-muted-foreground">소스 지표 (비활성 포함)</dt>
                          <dd>{asset.metricCount.toLocaleString()}개</dd>
                        </div>
                      )}
                    </dl>
                    <p className="mt-2 text-xs">{storageLabel[asset.storage]}</p>
                    {asset.kind === 'dashboard' && asset.missingOwnedSources > 0 && (
                      <p className="mt-2 text-xs">
                        누락된 본인 소스를 포함한 새 의향 요청을 검토하세요. 자동 추가나 기존 요청 변경은 하지 않습니다.
                      </p>
                    )}
                    {asset.kind === 'dashboard' && asset.otherSources > 0 && (
                      <p className="mt-2 text-xs">다른 소유·접근 경계는 별도 검토가 필요합니다.</p>
                    )}
                    {asset.kind === 'dashboard' && asset.dependencyStatus === 'unresolved' && (
                      <p className="mt-2 text-xs">저장 연결의 형식·참조·지원 범위를 별도로 확인해야 합니다.</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {error && <Notice severity="error">{error}</Notice>}
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer py-1">검토 범위와 제외 사항</summary>
            <p className="mt-2">
              저장된 명시 연결만 확인하며 전역 역방향 사용처·임의 계산식의 전체 의존성을 증명하지 않습니다. 소스 건수는
              중복을 제거하며 지표 건수와 합산하지 않습니다. 지표는 별도 소유 이전 대상이 아닙니다. 파일 내용·경로·존재·공유
              여부·배타적 소유·이관 가능성은 확인하지 않습니다. 외부 계정 이전과 실제 이전·퇴사 확정은 별도 검토·설계가
              필요합니다.
            </p>
          </details>
        </div>
      )}
    </section>
  );
}
