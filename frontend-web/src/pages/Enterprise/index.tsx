import ReceivedDashboards from './ReceivedDashboards';
import Notifications from './Notifications';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
import {
  EnterpriseApiError,
  EnterpriseContext,
  EnterpriseMember,
  ENROLLMENT_CODE_PATTERN,
  MAX_ENROLLMENT_CODE_LENGTH,
  MAX_ORGANIZATION_NAME_LENGTH,
  MAX_TEAM_LENGTH,
  MAX_USER_ID_LENGTH,
  createOrganization,
  createEnrollment,
  enterpriseError,
  fetchContext,
  fetchMembers,
  addMember,
  revokeEnrollment,
  updateMember,
} from '@/api/enterpriseService';
import ResourcePolicies from './ResourcePolicies';

const ORGANIZATION_ID_PATTERN = /^[1-9][0-9]{0,18}$/;

type EditEntry = { member: EnterpriseMember; team: string; role: EnterpriseMember['role']; active: boolean };

const roleLabel = (role: EnterpriseMember['role']) => (role === 'admin' ? 'admin (관리자)' : 'member (구성원)');
const activeLabel = (active: boolean) => (active ? '활성' : '비활성');

const reasonOf = (error: unknown): string =>
  error instanceof EnterpriseApiError ? error.message : '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';

/**
 * UC051 first unit. One organization per account, admin-only staff roles, consent codes for additions, and an
 * explicit confirmation before every write. Reads and writes are fenced by a request generation so a slow or
 * refused answer can never leave a stale organization directory usable.
 */
export default function Enterprise() {
  const [context, setContext] = useState<EnterpriseContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);

  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [created, setCreated] = useState('');

  const [enrollmentTarget, setEnrollmentTarget] = useState('');
  const [enrollment, setEnrollment] = useState<{
    code: string;
    expiresAt: string;
    organization: { id: number; name: string };
  } | null>(null);
  const [enrollmentBusy, setEnrollmentBusy] = useState(false);
  const [enrollmentRevoking, setEnrollmentRevoking] = useState(false);
  const [enrollmentError, setEnrollmentError] = useState('');
  const [enrollmentNotice, setEnrollmentNotice] = useState('');
  const organizationIdRef = useRef<HTMLInputElement | null>(null);

  const [members, setMembers] = useState<EnterpriseMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState('');
  const [membersDenied, setMembersDenied] = useState(false);
  const [nextAfterId, setNextAfterId] = useState<number | null>(null);
  const [membersReload, setMembersReload] = useState(0);

  const [newUserId, setNewUserId] = useState('');
  const [newTeam, setNewTeam] = useState('');
  const [newRole, setNewRole] = useState<EnterpriseMember['role']>('member');
  const [newEnrollmentCode, setNewEnrollmentCode] = useState('');
  const [addAck, setAddAck] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [addNotice, setAddNotice] = useState('');

  const [edit, setEdit] = useState<EditEntry | null>(null);
  const [editAck, setEditAck] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [editNotice, setEditNotice] = useState('');
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const editSaveRef = useRef<HTMLButtonElement | null>(null);
  const editingRow = useRef<HTMLElement | null>(null);

  /** Bumped whenever a directory read starts, so any in-flight read or write answer becomes stale. */
  const readGeneration = useRef(0);
  /** Bumped whenever a directory read starts; a mutation captures it once and never re-reads it later. */
  const directoryGeneration = useRef(0);
  /** Why the directory was withdrawn, so the refusal is readable on screen instead of inside a hidden form. */
  const [deniedReason, setDeniedReason] = useState('');

  const organization = context?.organization ?? null;
  const membership = context?.membership ?? null;
  const isAdmin = membership?.role === 'admin';

  /** A mutation or page request is applied only while its exact directory generation is still current. */
  const isCurrent = (generation: number) => directoryGeneration.current === generation;
  const denyDirectory = () => {
    setMembers([]);
    setNextAfterId(null);
    setEdit(null);
    setEditingRowId(null);
    setEditAck(false);
    setMembersDenied(true);
  };
  /** Drop the possibly stale directory and require a fresh read before anything stays writable. */
  const resetDirectory = (failure: EnterpriseApiError) => {
    if (failure.kind === 'forbidden') {
      setMembersError('');
      denyDirectory();
      return;
    }
    setMembers([]);
    setNextAfterId(null);
    setEdit(null);
    setEditingRowId(null);
    setEditAck(false);
    setMembersError(
      failure.kind === 'conflict'
        ? '조직 정보가 변경되었습니다. 최신 정보를 다시 불러온 뒤 이어서 진행해 주세요.'
        : '최신 직원 목록을 확인할 수 없습니다. 다시 불러온 뒤 이어서 진행해 주세요.',
    );
  };

  useEffect(() => {
    readGeneration.current += 1;
    const read = readGeneration.current;
    const abort = new AbortController();
    setLoading(true);
    setLoadError('');
    fetchContext({ signal: abort.signal })
      .then(data => {
        if (readGeneration.current === read) setContext(data);
      })
      .catch(error => {
        if (readGeneration.current !== read || abort.signal.aborted) return;
        const failure = enterpriseError(error);
        setLoadError(failure.kind === 'auth' ? 'auth' : reasonOf(failure));
      })
      .finally(() => {
        if (readGeneration.current === read) setLoading(false);
      });
    return () => {
      readGeneration.current += 1;
      abort.abort();
    };
  }, [reload]);

  useEffect(() => {
    if (!isAdmin) {
      directoryGeneration.current += 1;
      setMembers([]);
      setDeniedReason('');
      setMembersDenied(false);
      setMembersError('');
      setNextAfterId(null);
      return;
    }
    readGeneration.current += 1;
    const read = readGeneration.current;
    directoryGeneration.current += 1;
    const directoryRead = directoryGeneration.current;
    const abort = new AbortController();
    setMembersLoading(true);
    setMembersError('');
    setMembersDenied(false);
    setDeniedReason('');
    setMembers([]);
    setNextAfterId(null);
    fetchMembers(undefined, { signal: abort.signal })
      .then(page => {
        if (readGeneration.current !== read || directoryGeneration.current !== directoryRead) return;
        setMembers(page.entries);
        setNextAfterId(page.nextAfterId);
        setContext(current =>
          current?.organization
            ? { ...current, organization: { ...current.organization, version: page.organizationVersion } }
            : current,
        );
      })
      .catch(error => {
        if (readGeneration.current !== read || abort.signal.aborted || directoryGeneration.current !== directoryRead) return;
        resetDirectory(enterpriseError(error));
      })
      .finally(() => {
        if (readGeneration.current === read) setMembersLoading(false);
      });
    return () => {
      readGeneration.current += 1;
      abort.abort();
    };
  }, [isAdmin, membersReload]);

  const loadMore = useCallback(async () => {
    if (nextAfterId === null || membersLoading || !organization) return;
    const directoryRead = directoryGeneration.current;
    const organizationId = organization.id;
    const version = organization.version;
    setMembersLoading(true);
    setMembersError('');
    try {
      const page = await fetchMembers(nextAfterId, {});
      if (!isCurrent(directoryRead) || organization?.id !== organizationId) return;
      if (page.organizationVersion !== version) {
        // A newer organization version means the pages no longer form one snapshot; start over.
        resetDirectory(new EnterpriseApiError('organization changed', 'conflict', 409));
        setMembersReload(value => value + 1);
        return;
      }
      setMembers(current => {
        const seen = new Set(current.map(entry => entry.id));
        return [...current, ...page.entries.filter(entry => !seen.has(entry.id))];
      });
      setNextAfterId(page.nextAfterId);
    } catch (error) {
      if (!isCurrent(directoryRead) || organization?.id !== organizationId) return;
      const failure = enterpriseError(error);
      if (failure.kind === 'forbidden') denyDirectory();
      else setMembersError(reasonOf(failure));
    } finally {
      setMembersLoading(false);
    }
  }, [nextAfterId, membersLoading, organization]);

  const issueEnrollment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (enrollmentBusy) return;
    const target = enrollmentTarget.trim();
    if (!ORGANIZATION_ID_PATTERN.test(target) || !Number.isSafeInteger(Number(target))) {
      setEnrollmentError('참여할 조직 번호(양의 정수)를 입력해 주세요. 조직 번호는 초대하는 admin이 알려 줍니다.');
      setEnrollmentNotice('');
      organizationIdRef.current?.focus();
      return;
    }
    setEnrollmentBusy(true);
    setEnrollmentError('');
    setEnrollmentNotice('');
    try {
      const issued = await createEnrollment(Number(target));
      setEnrollment({
        code: issued.enrollmentCode,
        expiresAt: issued.expiresAt,
        organization: issued.organization,
      });
    } catch (error) {
      const failure = enterpriseError(error);
      setEnrollmentError(
        failure.kind === 'auth' ? '로그인이 만료되었습니다. 다시 로그인한 뒤 연결 코드를 발급해 주세요.' : reasonOf(failure),
      );
    } finally {
      setEnrollmentBusy(false);
    }
  };

  const revokeEnrollmentCode = async () => {
    if (enrollmentRevoking || !enrollment) return;
    setEnrollmentRevoking(true);
    setEnrollmentError('');
    setEnrollmentNotice('');
    try {
      await revokeEnrollment();
      // Only a confirmed revoke clears the code; a failure keeps it visible for an explicit retry.
      setEnrollment(null);
      setEnrollmentNotice('조직 연결 코드를 중지했습니다. 필요하면 다시 발급하세요.');
    } catch (error) {
      setEnrollmentError(reasonOf(enterpriseError(error)));
    } finally {
      setEnrollmentRevoking(false);
    }
  };

  const copyEnrollment = async () => {
    const code = enrollment?.code;
    if (!code) return;
    setEnrollmentNotice('');
    setEnrollmentError('');
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
        setEnrollmentNotice('연결 코드를 복사했습니다.');
        return;
      }
      throw new Error('clipboard unavailable');
    } catch {
      setEnrollmentNotice('복사할 수 없어 코드를 다시 표시했습니다. 코드를 직접 선택해 복사해 주세요.');
    }
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (creating) return;
    const requested = name.trim();
    if (!requested || requested.length > MAX_ORGANIZATION_NAME_LENGTH) {
      setCreateError('조직 이름은 1~100자로 입력해 주세요.');
      return;
    }
    setCreating(true);
    setCreateError('');
    setCreated('');
    try {
      const data = await createOrganization(requested);
      setContext(data);
      setCreated(data.organization ? `“${data.organization.name}” 조직을 만들었습니다.` : '조직을 만들었습니다.');
      setName('');
    } catch (error) {
      setCreateError(reasonOf(enterpriseError(error)));
    } finally {
      setCreating(false);
    }
  };

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    if (adding || !organization) return;
    const loginId = newUserId.trim();
    const team = newTeam.trim();
    if (!loginId || loginId.length > MAX_USER_ID_LENGTH) {
      setAddError('기존 계정의 로그인 ID를 1~255자로 입력해 주세요.');
      return;
    }
    if (team.length > MAX_TEAM_LENGTH) {
      setAddError('팀 이름은 100자 이내로 입력해 주세요.');
      return;
    }
    const enrollmentCode = newEnrollmentCode.trim();
    if (!enrollmentCode) {
      setAddError('추가할 계정이 발급한 연결 코드를 입력해 주세요. 코드 없이는 계정을 추가할 수 없습니다.');
      return;
    }
    if (!ENROLLMENT_CODE_PATTERN.test(enrollmentCode)) {
      setAddError('연결 코드 형식이 올바르지 않습니다. 64자리 코드를 그대로 붙여넣어 주세요.');
      return;
    }
    if (!addAck) {
      setAddError('변경 내용을 확인하고 확인란을 선택해 주세요.');
      return;
    }
    const directoryRead = directoryGeneration.current;
    const organizationId = organization.id;
    setAdding(true);
    setAddError('');
    setAddNotice('');
    try {
      const written = await addMember({
        userId: loginId,
        team,
        role: newRole,
        enrollmentCode,
        expectedVersion: organization.version,
      });
      if (!isCurrent(directoryRead) || organization?.id !== organizationId) return;
      setAddNotice(`로그인 ID ${written.member.userId} 계정을 ${roleLabel(written.member.role)}로 추가했습니다.`);
      setNewUserId('');
      setNewTeam('');
      setNewRole('member');
      setNewEnrollmentCode('');
      setAddAck(false);
      setMembersReload(value => value + 1);
    } catch (error) {
      if (!isCurrent(directoryRead) || organization?.id !== organizationId) return;
      const failure = enterpriseError(error);
      setAddError(reasonOf(failure));
      if (failure.kind === 'conflict' || failure.kind === 'forbidden') resetDirectory(failure);
    } finally {
      setAdding(false);
    }
  };

  const openEdit = (member: EnterpriseMember, focusTarget?: HTMLElement | null) => {
    setEdit({ member, team: member.team, role: member.role, active: member.active });
    setEditAck(false);
    setEditError('');
    setEditNotice('');
    setEditingRowId(member.id);
    if (focusTarget) editingRow.current = focusTarget;
  };

  useEffect(() => {
    if (editingRowId !== null) editSaveRef.current?.focus();
  }, [editingRowId]);

  const closeEdit = () => {
    setEdit(null);
    setEditAck(false);
    setEditError('');
    setEditingRowId(null);
    editingRow.current?.focus();
    editingRow.current = null;
  };

  const dirty =
    !!edit &&
    (edit.team.trim() !== edit.member.team || edit.role !== edit.member.role || edit.active !== edit.member.active);

  const summary = !edit
    ? ''
    : [
        edit.team.trim() !== edit.member.team ? `팀 ${edit.member.team || '미지정'} → ${edit.team.trim() || '미지정'}` : '',
        edit.role !== edit.member.role ? `역할 ${roleLabel(edit.member.role)} → ${roleLabel(edit.role)}` : '',
        edit.active !== edit.member.active ? `상태 ${activeLabel(edit.member.active)} → ${activeLabel(edit.active)}` : '',
      ]
        .filter(Boolean)
        .join(' · ');

  const handleSave = async () => {
    if (!edit || saving || !organization || !dirty || !editAck) return;
    if (edit.team.trim().length > MAX_TEAM_LENGTH) {
      setEditError('팀 이름은 100자 이내로 입력해 주세요.');
      return;
    }
    const directoryRead = directoryGeneration.current;
    const organizationId = organization.id;
    setSaving(true);
    setEditError('');
    setEditNotice('');
    try {
      const written = await updateMember(edit.member.id, {
        team: edit.team.trim(),
        role: edit.role,
        active: edit.active,
        expectedVersion: organization.version,
      });
      if (!isCurrent(directoryRead) || organization?.id !== organizationId) return;
      setMembers(current => current.map(entry => (entry.id === written.member.id ? written.member : entry)));
      setContext(current =>
        current?.organization
          ? { ...current, organization: { ...current.organization, version: written.organizationVersion } }
          : current,
      );
      setEditNotice('변경 내용을 저장했습니다.');
      closeEdit();
    } catch (error) {
      if (!isCurrent(directoryRead) || organization?.id !== organizationId) return;
      // Inputs, agreement and the confirm step stay exactly as typed for an explicit retry.
      const failure = enterpriseError(error);
      if (failure.kind === 'forbidden') {
        setDeniedReason(reasonOf(failure));
        denyDirectory();
      } else {
        setEditError(reasonOf(failure));
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading && !context && !loadError) {
    return (
      <section aria-label="조직·직원" className="mx-auto w-full max-w-3xl min-w-0 px-4 py-6">
        <h1 className="text-xl font-bold text-foreground">조직·직원</h1>
        <p role="status" className="mt-4 text-sm text-muted-foreground">
          조직 정보를 불러오는 중…
        </p>
      </section>
    );
  }

  if (loadError && !context) {
    const expired = loadError === 'auth';
    return (
      <section aria-label="조직·직원" className="mx-auto w-full max-w-3xl min-w-0 px-4 py-6">
        <h1 className="text-xl font-bold text-foreground">조직·직원</h1>
        <Notice severity="error" className="mt-4 flex flex-wrap items-center gap-2">
          <span className="break-words">
            {expired ? '로그인이 만료되었습니다. 다시 로그인한 뒤 조직 정보를 확인해 주세요.' : loadError}
          </span>
          {!expired && (
            <Button variant="ghost" onClick={() => setReload(value => value + 1)}>
              조직 정보 다시 불러오기
            </Button>
          )}
        </Notice>
      </section>
    );
  }

  return (
    <section aria-label="조직·직원" className="mx-auto w-full max-w-3xl min-w-0 px-4 py-6">
      <h1 className="text-xl font-bold text-foreground">조직·직원</h1>
      {organization && <Notifications key={`${organization.id}:${membership?.userId}`} organizationId={organization.id} />}
      {organization && <ReceivedDashboards key={`received:${organization.id}:${membership?.userId}`} />}

      {membership === null && (
        <form onSubmit={handleCreate} className="mt-4 flex min-w-0 flex-col gap-3">
          <Notice severity="info" role="status">
            현재 소속된 조직이 없습니다. 본인이 조직을 만들면 그 조직의 admin이 됩니다. 기존 개인 데이터와 다른 조직의 자료는
            함께 옮겨지지 않으며, 기존 계정을 직원으로 추가하려면 그 계정의 정확한 로그인 ID와 본인이 발급한 연결 코드가
            필요합니다.
          </Notice>
          <TextField
            label="새 조직 이름"
            required
            value={name}
            maxLength={MAX_ORGANIZATION_NAME_LENGTH}
            disabled={creating}
            onChange={event => {
              setName(event.target.value);
              setCreateError('');
            }}
            className="max-w-md"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={creating || !name.trim()}>
              {creating ? '조직 만드는 중…' : '조직 만들기'}
            </Button>
            <span className="text-xs text-muted-foreground">조직은 한 계정에 하나만 소속됩니다.</span>
          </div>
          {createError && (
            <Notice severity="error">
              <span className="break-words">{createError}</span>
            </Notice>
          )}
          {created && (
            <p role="status" className="text-[13px]">
              {created}
            </p>
          )}
        </form>
      )}

      {membership === null && (
        <section
          aria-label="조직 연결 코드"
          className="mt-6 flex min-w-0 flex-col gap-3 rounded-lg border border-border p-3"
        >
          <h2 className="text-base font-semibold text-foreground">명시 조직 연결 코드 발급</h2>
          <p className="text-xs text-muted-foreground">
            다른 조직의 admin이 내 계정을 직원으로 추가하려면, 내가 그 조직을 지정해 직접 발급한 연결 코드를 전달해야 합니다.
            코드는 지정한 조직에만 유효하고 15분 동안 한 번만 사용할 수 있습니다. 조직 번호는 초대하는 admin이 알려 줍니다.
            가입하면 그 조직의 관리자가 내 계정 활성 상태를 관리하며, 비활성화되면 로그인과 접근이 중단됩니다. 기존 개인
            데이터의 소유권은 그대로 유지되고, 코드만으로 다른 조직 자료가 열리지는 않습니다.
          </p>

          <form onSubmit={issueEnrollment} className="flex min-w-0 flex-wrap items-end gap-3">
            <TextField
              ref={organizationIdRef as React.Ref<HTMLInputElement>}
              label="참여할 조직 번호"
              inputMode="numeric"
              value={enrollmentTarget}
              disabled={enrollmentBusy}
              onChange={event => {
                setEnrollmentTarget(event.target.value);
                setEnrollmentError('');
              }}
              helperText="초대하는 admin이 알려 준 숫자 조직 번호"
              className="w-full max-w-[220px]"
            />
            <Button type="submit" variant="outline" disabled={enrollmentBusy || !enrollmentTarget.trim()}>
              {enrollmentBusy ? '코드 발급 중…' : enrollment ? '조직 연결 코드 다시 발급' : '조직 연결 코드 발급'}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            소속되지 않은 active 계정만 발급할 수 있습니다. 다시 발급하면 이전 코드는 즉시 무효가 됩니다.
          </p>

          {enrollment && (
            <div className="flex min-w-0 flex-col gap-2">
              <p role="status" className="wrap-anywhere text-sm text-foreground">
                조직 “{enrollment.organization.name}” (#{enrollment.organization.id}) 전용 코드입니다. 이 조직의 admin에게만
                전달하세요.
              </p>
              <TextField
                label="발급된 연결 코드"
                readOnly
                value={enrollment.code}
                onFocus={event => event.currentTarget.select()}
                className="w-full max-w-md"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" onClick={() => void copyEnrollment()}>
                  코드 복사
                </Button>
                <Button variant="outline" disabled={enrollmentRevoking} onClick={() => void revokeEnrollmentCode()}>
                  {enrollmentRevoking ? '중지 중…' : '코드 중지'}
                </Button>
                <span className="text-xs text-muted-foreground">
                  만료 예정 {new Date(enrollment.expiresAt).toLocaleString()} · 15분 · 1회
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                코드는 화면을 벗어나면 다시 볼 수 없습니다. 잘못 발급했으면 코드 중지로 즉시 무효화하고, 만료되면 새로
                발급하세요. 이 코드를 전달하면 상대 조직의 관리자가 내 계정 활성 상태를 관리하며, 비활성화되면 로그인과
                접근이 중단됩니다. 기존 개인 데이터의 소유권은 그대로 유지됩니다.
              </p>
            </div>
          )}

          {enrollmentNotice && (
            <p role="status" className="text-[13px]">
              {enrollmentNotice}
            </p>
          )}
          {enrollmentError && (
            <Notice severity="error">
              <span className="break-words">{enrollmentError}</span>
            </Notice>
          )}
        </section>
      )}

      {organization && membership && (
        <div className="mt-4 flex min-w-0 flex-col gap-2">
          <dl className="flex min-w-0 flex-wrap gap-x-6 gap-y-1 text-sm">
            <div className="flex min-w-0 gap-2">
              <dt className="text-muted-foreground">조직</dt>
              <dd className="wrap-anywhere font-medium text-foreground">{organization.name}</dd>
            </div>
            <div className="flex min-w-0 gap-2">
              <dt className="text-muted-foreground">조직 번호</dt>
              <dd className="font-medium text-foreground">#{organization.id}</dd>
            </div>
            <div className="flex min-w-0 gap-2">
              <dt className="text-muted-foreground">내 역할</dt>
              <dd className="font-medium text-foreground">{roleLabel(membership.role)}</dd>
            </div>
            <div className="flex min-w-0 gap-2">
              <dt className="text-muted-foreground">팀</dt>
              <dd className="wrap-anywhere font-medium text-foreground">{membership.team || '미지정'}</dd>
            </div>
            <div className="flex min-w-0 gap-2">
              <dt className="text-muted-foreground">조직 버전</dt>
              <dd className="font-medium text-foreground">{organization.version}</dd>
            </div>
          </dl>
          {isAdmin && (
            <p className="text-xs text-muted-foreground">
              직원을 추가할 계정에는 이 조직 번호 <span className="font-medium text-foreground">#{organization.id}</span>를
              알려 주고, 그 계정이 직접 발급한 연결 코드를 받아야 합니다.
            </p>
          )}
          {!isAdmin && (
            <Notice severity="info" role="status">
              구성원은 소속 정보만 확인할 수 있습니다. 직원 목록과 팀·역할·활성 변경은 조직 admin만 할 수 있습니다.
            </Notice>
          )}
        </div>
      )}

      {created && membersDenied && (
        <Notice severity="error" className="mt-3">
          조직 정보를 볼 권한이 없습니다. 조직 정보를 다시 불러온 뒤 다시 확인해 주세요.
        </Notice>
      )}

      {isAdmin && organization && (
        <div className="mt-6 flex min-w-0 flex-col gap-3">
          <h2 className="text-base font-semibold text-foreground">직원 목록</h2>

          {editNotice && (
            <p role="status" className="text-[13px]">
              {editNotice}
            </p>
          )}

          {membersDenied ? (
            <Notice severity="error">
              <span className="break-words">
                {deniedReason
                  ? `${deniedReason} 직원 목록을 다시 불러온 뒤 권한을 확인해 주세요.`
                  : '직원 목록을 볼 권한이 없습니다. 권한을 확인한 뒤 다시 시도해 주세요.'}
              </span>
            </Notice>
          ) : (
            <div className="flex min-w-0 flex-col gap-3">
              <p role="status" className="text-xs text-muted-foreground">
                현재 {members.length}명 표시 · 조직 버전 {organization.version}
                {nextAfterId === null ? ' · 마지막 페이지' : ' · 다음 페이지 있음'}
              </p>
              {members.length === 0 && !membersLoading && !membersError && (
                <p className="text-sm text-muted-foreground">아직 추가된 직원이 없습니다.</p>
              )}
              <ul className="flex min-w-0 flex-col gap-2">
                {members.map(member => (
                  <li key={member.id} className="flex min-w-0 flex-col gap-2 rounded-lg border border-border p-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <span className="wrap-anywhere font-medium text-foreground">로그인 ID {member.userId}</span>
                      <span className="wrap-anywhere text-muted-foreground">팀 {member.team || '미지정'}</span>
                      <span className="text-muted-foreground">역할 {roleLabel(member.role)}</span>
                      <span className="text-muted-foreground">상태 {activeLabel(member.active)}</span>
                      <Button
                        variant="ghost"
                        className="ml-auto"
                        disabled={saving}
                        aria-label={`로그인 ID ${member.userId} 변경`}
                        onClick={event => openEdit(member, event.currentTarget)}
                      >
                        팀·역할·활성 변경
                      </Button>
                    </div>

                    {edit?.member.id === member.id && (
                      <div className="flex min-w-0 flex-col gap-3 rounded-md bg-muted/40 p-3">
                        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap">
                          <TextField
                            label="팀"
                            value={edit.team}
                            maxLength={MAX_TEAM_LENGTH}
                            disabled={saving}
                            onChange={event => {
                              setEdit(current => (current ? { ...current, team: event.target.value } : current));
                              setEditAck(false);
                              setEditError('');
                            }}
                            className="w-full max-w-[220px]"
                          />
                          <TextField
                            select
                            label="역할"
                            value={edit.role}
                            disabled={saving}
                            onChange={event => {
                              setEdit(current =>
                                current ? { ...current, role: event.target.value as EnterpriseMember['role'] } : current,
                              );
                              setEditAck(false);
                              setEditError('');
                            }}
                            className="w-full max-w-[200px]"
                          >
                            <option value="member">member (구성원)</option>
                            <option value="admin">admin (관리자)</option>
                          </TextField>
                          <label className="flex min-h-9 items-center gap-2 text-sm text-foreground sm:mt-6">
                            <input
                              type="checkbox"
                              className="size-4"
                              checked={edit.active}
                              disabled={saving}
                              onChange={event => {
                                setEdit(current => (current ? { ...current, active: event.target.checked } : current));
                                setEditAck(false);
                                setEditError('');
                              }}
                            />
                            계정 활성
                          </label>
                        </div>

                        <p role="status" className="text-xs text-muted-foreground">
                          {edit.team.trim().length > MAX_TEAM_LENGTH
                            ? '팀 이름은 100자 이내로 입력해 주세요.'
                            : dirty
                            ? `변경 요약: ${summary}. 저장은 아래 확인 후에만 전송됩니다.`
                            : '변경된 값이 없습니다. 팀·역할·활성을 수정하면 요약이 표시됩니다.'}
                        </p>

                        <label className="flex flex-wrap items-center gap-2 text-sm text-foreground">
                          <input
                            type="checkbox"
                            className="size-4"
                            checked={editAck}
                            disabled={saving || !dirty}
                            onChange={event => {
                              setEditAck(event.target.checked);
                              setEditError('');
                            }}
                          />
                          {summary
                            ? `위 변경(${summary})을 이 직원에게 적용하는 데 동의합니다.`
                            : '위 변경 내용을 확인했습니다.'}
                        </label>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            ref={editSaveRef}
                            disabled={saving || !dirty || !editAck || edit.team.trim().length > MAX_TEAM_LENGTH}
                            onClick={() => void handleSave()}
                          >
                            {saving ? '저장 중…' : '변경 저장'}
                          </Button>
                          <Button variant="ghost" disabled={saving} onClick={closeEdit}>
                            취소
                          </Button>
                        </div>
                        {editError && (
                          <Notice severity="error">
                            <span className="break-words">{editError}</span>
                          </Notice>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  disabled={membersLoading || nextAfterId === null || membersError !== ''}
                  onClick={() => void loadMore()}
                >
                  {membersLoading ? '불러오는 중…' : '다음 20명 더 보기'}
                </Button>
                <Button variant="ghost" disabled={membersLoading} onClick={() => setMembersReload(value => value + 1)}>
                  직원 목록 다시 불러오기
                </Button>
              </div>
              {membersError && (
                <Notice severity="error" className="flex flex-wrap items-center gap-2">
                  <span className="break-words">{membersError}</span>
                  <Button variant="ghost" disabled={membersLoading} onClick={() => setMembersReload(value => value + 1)}>
                    직원 목록 다시 불러오기
                  </Button>
                </Notice>
              )}
            </div>
          )}

          {!membersDenied && (
            <form onSubmit={handleAdd} className="mt-2 flex min-w-0 flex-col gap-3 rounded-lg border border-border p-3">
              <h3 className="text-sm font-semibold text-foreground">기존 계정 추가</h3>
              <p className="text-xs text-muted-foreground">
                기존 가입 계정을 정확한 로그인 ID와 그 계정이 이 조직을 지정해 발급한 연결 코드로만 추가합니다. 코드가 없거나
                다른 조직용 코드면 추가되지 않습니다. 새 계정 발급·초대 메일·이메일 검색은 지원하지 않습니다. 추가한 계정의
                활성 상태는 이 조직의 admin이 관리하며, 비활성화하면 그 계정의 로그인과 접근이 중단됩니다.
              </p>
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap">
                <TextField
                  label="로그인 ID (userId)"
                  value={newUserId}
                  maxLength={MAX_USER_ID_LENGTH}
                  disabled={adding}
                  onChange={event => {
                    setNewUserId(event.target.value);
                    setAddAck(false);
                    setAddError('');
                  }}
                  helperText="기존 계정의 로그인 ID를 정확히 입력"
                  className="w-full max-w-[240px]"
                />
                <TextField
                  label="팀"
                  value={newTeam}
                  maxLength={MAX_TEAM_LENGTH}
                  disabled={adding}
                  onChange={event => {
                    setNewTeam(event.target.value);
                    setAddAck(false);
                    setAddError('');
                  }}
                  className="w-full max-w-[220px]"
                />
                <TextField
                  select
                  label="역할"
                  value={newRole}
                  disabled={adding}
                  onChange={event => {
                    setNewRole(event.target.value as EnterpriseMember['role']);
                    setAddAck(false);
                    setAddError('');
                  }}
                  className="w-full max-w-[200px]"
                >
                  <option value="member">member (구성원)</option>
                  <option value="admin">admin (관리자)</option>
                </TextField>
                <TextField
                  label="연결 코드"
                  value={newEnrollmentCode}
                  maxLength={MAX_ENROLLMENT_CODE_LENGTH}
                  disabled={adding}
                  onChange={event => {
                    setNewEnrollmentCode(event.target.value);
                    setAddAck(false);
                    setAddError('');
                  }}
                  helperText="직원이 이 조직을 지정해 발급한 15분·1회 코드"
                  className="w-full max-w-[280px]"
                />
              </div>
              <label className="flex flex-wrap items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={addAck}
                  disabled={adding}
                  onChange={event => {
                    setAddAck(event.target.checked);
                    setAddError('');
                  }}
                />
                {`로그인 ID ${newUserId.trim() || '(미입력)'} 계정을 팀 ${newTeam.trim() || '미지정'} · ${roleLabel(
                  newRole,
                )}로 추가하는 데 동의합니다. 이 계정이 발급한 연결 코드를 함께 전송합니다.`}
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="submit"
                  disabled={
                    adding ||
                    !newUserId.trim() ||
                    newUserId.trim().length > MAX_USER_ID_LENGTH ||
                    !newEnrollmentCode.trim() ||
                    !addAck
                  }
                >
                  {adding ? '추가하는 중…' : '직원 추가'}
                </Button>
                <span className="text-xs text-muted-foreground">확인란을 선택해야 전송됩니다.</span>
              </div>
              {addError && (
                <Notice severity="error">
                  <span className="break-words">{addError}</span>
                </Notice>
              )}
              {addNotice && (
                <p role="status" className="text-[13px]">
                  {addNotice}
                </p>
              )}
            </form>
          )}

          {/* UC051: resource-level grants live beside the staff directory and are read only when an admin opens them. */}
          <ResourcePolicies organizationId={organization.id} selfRecipientId={membership?.userId} />
        </div>
      )}
    </section>
  );
}
