import React, { useEffect, useId, useRef, useState } from 'react';
import { EnterpriseContext, EnterpriseMember, enterpriseError } from '@/api/enterpriseService';
import {
  DEPARTURE_COUNT_KEYS,
  DepartureCountKey,
  StaffDepartureImpact as Impact,
  fetchStaffDepartureImpact,
} from '@/api/staffDepartureService';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Notice } from '@/components/ui/notice';

type Props = { context: EnterpriseContext; members: EnterpriseMember[] };
const labels: Record<DepartureCountKey, string> = {
  sources: '전체 소스 (비활성 포함)',
  metrics: '소스 연결 지표 (비활성 포함)',
  soleDashboards: '단독 소유 대시보드',
  ambiguousDashboards: '소유 관계가 중복된 대시보드',
  directGrants: '저장 직접 권한 관계 (회수 포함)',
  personalDeliveries: '개인 전달 관계 (회수 포함)',
  groupMemberships: '그룹 가입 관계 (비활성 그룹 포함)',
  ownedGroupGrants: '소유 자료의 그룹 권한 관계 (회수 포함)',
  ownedGroupDeliveries: '소유 자료의 그룹 전달 관계 (회수 포함)',
  publications: 'Studio 게시 기록 (중지·만료 포함)',
  exportJobs: '조직 출력 작업 (종료 포함)',
};
export default function StaffDepartureImpact({ context, members }: Props) {
  const memberHintId = useId();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [result, setResult] = useState<Impact | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const organization = context.organization;
  const admin = context.membership?.role === 'admin';
  const scopeKey = `${organization?.id}:${organization?.version}:${context.membership?.userId}:${admin}`;
  const selected = members.find(member => String(member.id) === target);
  const selectedKey = selected ? `${selected.id}:${selected.active}:${selected.team}:${selected.role}` : '';
  const clear = () => {
    generation.current += 1;
    pending.current?.abort();
    pending.current = null;
    setResult(null);
    setError('');
    setBusy(false);
  };
  useEffect(() => {
    clear();
    setTarget('');
    setOpen(false);
    return () => {
      generation.current += 1;
      pending.current?.abort();
    };
  }, [scopeKey]);
  useEffect(() => {
    clear();
    return () => {
      generation.current += 1;
      pending.current?.abort();
    };
  }, [selectedKey]);
  const load = async () => {
    if (!open || !admin || !organization || !selected || busy) return;
    clear();
    const read = generation.current;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    try {
      const next = await fetchStaffDepartureImpact(
        { organizationId: organization.id, organizationVersion: organization.version, targetId: selected.id },
        { signal: controller.signal },
      );
      if (generation.current === read && !controller.signal.aborted) setResult(next);
    } catch (cause) {
      if (generation.current === read && !controller.signal.aborted) setError(enterpriseError(cause).message);
    } finally {
      if (generation.current === read) {
        setBusy(false);
        pending.current = null;
      }
    }
  };
  if (!admin || !organization) return null;
  const visible =
    result &&
    selected &&
    result.targetId === selected.id &&
    result.organizationId === organization.id &&
    result.organizationVersion === organization.version
      ? result
      : null;
  return (
    <section aria-label="퇴사·인계 영향 확인" className="min-w-0 rounded-lg border border-border p-3">
      <Button
        variant="ghost"
        aria-expanded={open}
        onClick={() => {
          clear();
          setOpen(!open);
        }}
      >
        퇴사·인계 전 확인 {open ? '접기' : '열기'}
      </Button>
      {open && (
        <div className="mt-3 flex min-w-0 flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            건수만 확인하며, 개인 자산은 전체 계정 소유 건수로 조직 소유 목록이 아닙니다. 이번 조회는 퇴사·탈퇴·삭제·인계
            실행 승인이 아닙니다.
          </p>
          <div className="flex min-w-0 flex-wrap items-end gap-2">
            <TextField
              select
              label="영향 확인 직원"
              aria-describedby={memberHintId}
              value={target}
              onChange={event => {
                clear();
                setTarget(event.target.value);
              }}
              className="w-full sm:max-w-sm"
            >
              <option value="">직원을 선택하세요</option>
              {members.map(member => (
                <option key={member.id} value={member.id}>
                  #{member.id} · {member.userId} · {member.active ? '활성' : '비활성'}
                </option>
              ))}
            </TextField>
            <Button variant="outline" disabled={busy || !selected} onClick={() => void load()}>
              {busy ? '영향 건수 조회 중…' : '영향 건수 조회'}
            </Button>
          </div>
          <p id={memberHintId} className="text-xs text-muted-foreground">
            현재 직원 목록에 불러온 직원만 선택할 수 있습니다.
          </p>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer py-1">집계 기준과 제외 범위</summary>
            <div className="mt-2 flex flex-col gap-2">
              <p>
                관계 건수는 현재 접근권이 아니며, 게시 건수도 현재 공개 수가 아닙니다. 서로 겹치는 항목이 있어 총합을
                표시하지 않습니다.
              </p>
              <p>전체 인계 영향 분석이 아니며 자료 변경을 동결하지 않습니다. 확정 작업에는 별도 최신 검토가 필요합니다.</p>
              <p>
                개인 저장 보기·기존 대시보드 게시/공유·별도 BI 조직·고아 관계·다른 자료 유형·외부 원본·파일 크기·전역
                사용처는 포함하지 않습니다. 자료 내용이나 소유권을 열거나 변경하지 않습니다.
              </p>
              <p>미조회 직원은 기존 직원 목록에서 먼저 불러오세요. 선택·열기·접기만으로 조회하지 않습니다.</p>
            </div>
          </details>
          {visible && (
            <div className="flex min-w-0 flex-col gap-2">
              <p role="status" className="wrap-anywhere text-xs">
                직원 #{visible.targetId} · {visible.targetActive ? '활성' : '비활성'} · 조직 #{visible.organizationId} 버전{' '}
                {visible.organizationVersion} · 조회 시각 {new Date(visible.observedAt).toLocaleString()}
              </p>
              <dl className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {DEPARTURE_COUNT_KEYS.map(key => (
                  <div key={key} className="min-w-0 rounded-md bg-muted/40 p-3">
                    <dt className="break-words text-xs text-muted-foreground">{labels[key]}</dt>
                    <dd className="text-base font-semibold tabular-nums">{visible.counts[key].toLocaleString()}건</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {error && <Notice severity="error">{error}</Notice>}
        </div>
      )}
    </section>
  );
}
