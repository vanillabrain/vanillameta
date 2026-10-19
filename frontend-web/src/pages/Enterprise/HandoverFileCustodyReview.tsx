import React, { useEffect, useRef, useState } from 'react';
import { enterpriseError } from '@/api/enterpriseService';
import { HandoverProposal, HandoverScope } from '@/api/handoverService';
import { HandoverCustodyReport, HandoverCustodySource, fetchHandoverFileCustody } from '@/api/handoverCustodyService';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';

type Props = { review: HandoverProposal; scope: HandoverScope; organizationVersion: number };
const identityLabel: Record<HandoverCustodySource['identity'], string> = {
  observed: '파일 연결 신원을 관측함',
  unresolved: '파일 존재·연결 신원을 확정할 수 없음',
  not_applicable: '관리 파일 신원 확인 대상 아님',
};
const consumersLabel: Record<HandoverCustodySource['consumers'], string> = {
  present: '공유 사용처가 관측됨 · 보관 책임 검토 필요',
  none_observed: '알려진 검사 범위에서 공유 사용처 미관측',
  unresolved: '공유 사용처 확인 불완전 · 추가 검토 필요',
  not_applicable: '관리 파일 공유 사용처 확인 대상 아님',
};
const refreshLabel: Record<HandoverCustodySource['refresh'], string> = {
  active_or_unresolved: '갱신 진행 또는 미해제 작업 상태 확인 필요',
  none_observed: '열린 갱신 작업 미관측',
  not_applicable: '관리 파일 갱신 확인 대상 아님',
};
export default function HandoverFileCustodyReview(props: Props) {
  const { review, scope } = props;
  const allowed =
    review.ownerId === scope.actorId &&
    review.organizationId === scope.organizationId &&
    review.status === 'accepted' &&
    review.detailsAvailable &&
    !review.expired;
  return allowed ? <CustodyRead key={JSON.stringify([review, scope, props.organizationVersion])} {...props} /> : null;
}
function CustodyRead({ review, scope }: Props) {
  const [report, setReport] = useState<HandoverCustodyReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0),
    abort = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      generation.current += 1;
      abort.current?.abort();
    },
    [],
  );
  const load = async () => {
    if (busy) return;
    generation.current += 1;
    abort.current?.abort();
    setReport(null);
    setError('');
    setBusy(true);
    const token = generation.current,
      controller = new AbortController();
    abort.current = controller;
    try {
      const next = await fetchHandoverFileCustody(review, scope, { signal: controller.signal });
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
    <section aria-label="인계 전 파일·갱신 상태" className="flex min-w-0 flex-col gap-2">
      <Button variant="outline" className="self-start" disabled={busy} onClick={() => void load()}>
        {busy ? '파일·갱신 상태 확인 중…' : '파일·갱신 상태 확인'}
      </Button>
      {report && (
        <div className="flex min-w-0 flex-col gap-2">
          <p role="status" className="wrap-anywhere text-xs">
            의향 버전 {report.proposalVersion} · 파일 확인 시각 {new Date(report.checkedAt).toLocaleString()} · 실제 이전
            실행 불가
          </p>
          <p className="text-xs text-muted-foreground">파일 신원 관측은 내용 정상·배타적 보관·복구 가능 증명이 아닙니다.</p>
          {report.sources.length === 0 ? (
            <p role="status" className="text-sm">
              선택된 소스가 없어 파일·갱신 상태 확인 대상이 없습니다.
            </p>
          ) : (
            <ul aria-label="선택 소스별 파일·갱신 상태" className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2">
              {report.sources.map(source => (
                <li key={source.id} className="min-w-0 rounded-md bg-muted/40 p-3">
                  <h4 className="wrap-anywhere text-sm font-medium">
                    소스 #{source.id} · {source.title}
                  </h4>
                  <p className="mt-1 text-xs">
                    {source.storage === 'managed_file'
                      ? '관리 파일'
                      : source.storage === 'external_connection'
                      ? '외부 연결'
                      : '보관 방식 확인 필요'}
                  </p>
                  {source.storage !== 'external_connection' && (
                    <dl className="mt-2 flex min-w-0 flex-col gap-2 text-xs">
                      <div>
                        <dt className="text-muted-foreground">파일 연결 확인</dt>
                        <dd className="wrap-anywhere">{identityLabel[source.identity]}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">검사한 파일</dt>
                        <dd>{source.filesChecked}개</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">공유 사용처</dt>
                        <dd className="wrap-anywhere">{consumersLabel[source.consumers]}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">갱신 주의</dt>
                        <dd className="wrap-anywhere">{refreshLabel[source.refresh]}</dd>
                      </div>
                    </dl>
                  )}
                  {source.identity === 'unresolved' && (
                    <p className="mt-2 text-xs">일부 관측을 전체 파일 확인으로 해석하지 마세요.</p>
                  )}
                  {source.storage === 'external_connection' && (
                    <p className="mt-2 text-xs">외부 연결 계정·이관 가능성은 별도로 검토하세요.</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error && <Notice severity="error">{error}</Notice>}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer py-1">파일 확인의 범위와 한계</summary>
        <p className="mt-2">
          관측 시점의 파일 존재·연결 신원과 알려진 사용처·갱신 상태만 읽습니다. 파일 내용·내구 보관·배타적 소유·수신자 보관
          책임을 증명하지 않습니다. SQLite에는 소스 소유를 확인하는 별도 관리 명세가 없어 제한된 파일 신원 검사만 수행합니다.
          공유 사용처 미관측은 알려진 두 종류의 검사 범위에 한정되며 외부 프로세스·목록 밖 사용처 부재를 증명하지 않습니다.
          검사 실패·제한 도달·열린 갱신 작업은 자동 복구하지 않습니다. 파일과 자료 정보의 동시 외부 변경을 완전히 동결하지
          않으며 상태별 개수를 합산하거나 실제 이전을 실행하지 않습니다.
        </p>
      </details>
    </section>
  );
}
