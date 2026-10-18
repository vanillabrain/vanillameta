import React, { useEffect, useId, useRef, useState } from 'react';
import { post } from '@/helpers/apiHelper';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { compile, Column, Conditions, countNodes, Definition, readConditions, Tree } from '../../Explore/SourceConditions';
import { studioClone, studioConditionsKey, validateStudioConditions } from './studioDocument';
import { StudioConditions, ConditionSemantics } from './studioTypes';

type Props = {
  sourceId: number;
  sourceRevision: string;
  conditions?: StudioConditions;
  columns?: Column[];
  conditionSemantics?: ConditionSemantics;
  disabled?: boolean;
  busy?: boolean;
  onApply: (conditions: StudioConditions | null) => void;
};
/** A source/file switch discards only the panel's unapplied review, never rebinds an applied scope. */
export default function StudioConditionsPanel(props: Props) {
  return <Editor key={`${props.sourceId}:${props.sourceRevision}`} {...props} />;
}
function Editor({
  sourceId,
  sourceRevision,
  conditions,
  columns = [],
  conditionSemantics,
  disabled = false,
  busy = false,
  onApply,
}: Props) {
  const id = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const serial = useRef(0);
  const contextOrigin = useRef<'document' | 'source' | 'latest' | 'frozen'>('document');
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Conditions | null>(null);
  const [draft, setDraft] = useState<Definition>(studioClone(conditions?.definition ?? { include: null, exclude: null }));
  const [draftSemantics, setDraftSemantics] = useState<ConditionSemantics | undefined>(
    conditions ? (conditions.semantics ? studioClone(conditions.semantics) : undefined) : conditionSemantics,
  );
  const [localColumns, setLocalColumns] = useState<Column[] | null>(
    columns.length && (conditions !== undefined || conditionSemantics !== undefined) ? columns : null,
  );
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const applied = studioConditionsKey(conditions);
  const current = useRef({ conditions, disabled, busy });
  current.current = { conditions, disabled, busy };
  useEffect(() => {
    serial.current += 1;
    contextOrigin.current = 'document';
    setReading(false);
    setDraftSemantics(
      current.current.conditions
        ? current.current.conditions.semantics
          ? studioClone(current.current.conditions.semantics)
          : undefined
        : conditionSemantics,
    );
    setLocalColumns(columns.length && (conditions !== undefined || conditionSemantics !== undefined) ? columns : null);
    setDraft(studioClone(current.current.conditions?.definition ?? { include: null, exclude: null }));
  }, [applied]);
  useEffect(() => {
    if (contextOrigin.current !== 'document') return;
    setLocalColumns(columns.length && (conditions !== undefined || conditionSemantics !== undefined) ? columns : null);
    setDraftSemantics(conditions ? conditions.semantics : conditionSemantics);
  }, [columns, conditionSemantics, applied]);
  useEffect(
    () => () => {
      serial.current += 1;
    },
    [],
  );
  // Editing/saving or losing permission while a read is in flight must not replace a reviewed draft.
  useEffect(() => {
    if (disabled || busy) {
      serial.current += 1;
      setReading(false);
    }
  }, [disabled, busy]);
  const read = async (mode: 'source' | 'current' | 'latest' = 'source') => {
    if (disabled || busy || reading) return;
    serial.current += 1;
    const token = serial.current;
    setReading(true);
    setError('');
    try {
      const adoptCurrentSemantics = mode === 'latest';
      const analysisConditions =
        mode === 'source'
          ? undefined
          : validateStudioConditions({
              sourceRevision,
              definition: localColumns ? compile(draft, localColumns) : draft,
              ...(draftSemantics === undefined ? {} : { semantics: draftSemantics }),
            });
      const response = await post('/bi/source-conditions/read', {
        sourceId,
        ...(adoptCurrentSemantics ? { adoptCurrentSemantics: true } : {}),
        ...(analysisConditions ? { analysisConditions } : {}),
      });
      if (serial.current !== token || current.current.disabled || current.current.busy) return;
      if (response?.data?.status !== 'SUCCESS') throw new Error('invalid response');
      const next = readConditions(response.data.data, sourceId);
      if ((analysisConditions?.semantics ?? draftSemantics) && next.semantics === undefined)
        throw new Error('업무 의미가 누락됐습니다. 현재 조건을 보존합니다.');
      if (analysisConditions) {
        const expected = adoptCurrentSemantics ? { ...analysisConditions, semantics: next.semantics } : analysisConditions;
        if (
          studioConditionsKey({
            sourceRevision,
            definition: next.definition,
            ...(next.semantics === undefined ? {} : { semantics: next.semantics }),
          }) !== studioConditionsKey(expected)
        )
          throw new Error('현재 조건의 업무 의미를 확인하지 못했습니다.');
      }
      // Validate before accepting: provenance stays informational, outside the document.
      validateStudioConditions({
        sourceRevision,
        definition: next.definition,
        ...(next.semantics !== undefined ? { semantics: next.semantics } : {}),
      });
      contextOrigin.current = mode === 'current' ? 'frozen' : adoptCurrentSemantics ? 'latest' : 'source';
      setData(next);
      setDraftSemantics(next.semantics ? studioClone(next.semantics) : undefined);
      setLocalColumns(next.columns);
      if (mode === 'source') setDraft(studioClone(next.definition));
    } catch (cause) {
      if (serial.current !== token) return;
      setError(
        cause?.response?.status === 409
          ? '데이터 버전이 변경됐습니다. 입력을 보존했습니다. 최신 데이터를 확인하세요.'
          : '조건을 읽지 못했습니다. 입력과 적용된 조건을 보존했습니다. 다시 시도하세요.',
      );
    } finally {
      if (serial.current === token) setReading(false);
    }
  };
  const locked = disabled || busy || reading;
  return (
    <section
      aria-label="포함·제외 조건"
      aria-busy={busy || reading}
      className="my-3 min-w-0 rounded-lg border border-border"
      onKeyDown={event => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          toggle.current?.focus();
        }
      }}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2 p-2">
        <Button
          ref={toggle}
          type="button"
          variant="ghost"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
        >
          포함·제외 조건
        </Button>
        <span className="min-w-0 break-words text-sm">{conditions ? '조건 적용됨' : '적용된 조건 없음'}</span>
      </div>
      {open && (
        <div id={id} className="min-w-0 space-y-3 border-t border-border p-3 text-sm">
          <p>
            저장 조건 읽기는 분석에 적용하지 않습니다. 현재 열과 트리를 검토한 뒤 명시 적용하세요. 적용 후 전체 미리보기에서
            파일 버전과 열을 검증합니다.
          </p>
          {error && (
            <Notice severity="error" role="alert">
              {error}
            </Notice>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={locked} onClick={() => void read()}>
              저장 조건 읽기
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={locked || (!conditions && !localColumns)}
              onClick={() => void read('current')}
            >
              적용된 조건 검토
            </Button>
            <Button type="button" variant="outline" disabled={locked} onClick={() => void read('latest')}>
              최신 업무 의미 채택
            </Button>
            <Button type="button" variant="outline" disabled={locked || !conditions} onClick={() => onApply(null)}>
              조건 전체 해제
            </Button>
          </div>
          {reading && <p role="status">조건 읽는 중…</p>}
          {localColumns && (
            <>
              <p>
                {data && <>소스 조건 버전 {data.version} · </>}
                {draftSemantics
                  ? `업무 의미 카탈로그 버전 ${draftSemantics.catalogVersion}`
                  : '원본 유형 기준 (legacy native)'}{' '}
                · 명시 적용 후 전체 미리보기로 검증합니다.
              </p>
              {data?.schemaChanged && (
                <Notice severity="warning">
                  소스 열이 변경됐습니다. 현재 열로 조건을 검토하세요. 자동 수정하지 않습니다.
                </Notice>
              )}
              <fieldset disabled={locked} className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
                {(['include', 'exclude'] as const).map(key => (
                  <Tree
                    key={key}
                    node={draft[key]}
                    columns={localColumns}
                    label={key === 'include' ? '포함' : '제외'}
                    depth={0}
                    room={32 - countNodes(draft.include) - countNodes(draft.exclude)}
                    onChange={node => {
                      setDraft({ ...draft, [key]: node });
                      setError('');
                    }}
                  />
                ))}
              </fieldset>
              <Button
                type="button"
                disabled={locked}
                onClick={() => {
                  try {
                    const next = validateStudioConditions({
                      sourceRevision,
                      definition: compile(draft, localColumns),
                      ...(draftSemantics !== undefined ? { semantics: draftSemantics } : {}),
                    });
                    setError('');
                    onApply(next);
                  } catch (cause) {
                    setError(cause instanceof Error ? cause.message : '조건을 확인하세요.');
                  }
                }}
              >
                조건 명시 적용
              </Button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
