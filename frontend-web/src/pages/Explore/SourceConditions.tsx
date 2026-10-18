import { categoryTextType } from './businessVariable';
import ConditionProfilePanel from './ConditionProfilePanel';
import { profileKey, readProfileColumns } from './conditionProfile';
import React, { useEffect, useId, useRef, useState } from 'react';
import type { StudioConditions, ConditionSemantics } from '@/pages/Dashboard/Studio/studioTypes';
import { validateStudioConditions, validateConditionSemantics } from '@/pages/Dashboard/Studio/studioDocument';
import { post } from '@/helpers/apiHelper';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { NativeSelect } from '@/components/ui/native-select';
import { Notice } from '@/components/ui/notice';
export type Column = {
  name: string;
  type: string;
  kind: 'number' | 'string' | 'boolean' | 'date' | 'timestamp' | 'unsupported';
  businessType?: 'auto' | 'number' | 'category' | 'date';
  dateFormat?: '' | 'native' | 'YYYY-MM-DD' | 'YYYY/MM/DD' | 'YYYYMMDD';
};
export type Node =
  | { kind: 'group'; operator: 'and' | 'or'; children: Node[] }
  | { kind: 'predicate'; column: string; operator: string; values?: Array<string | number | boolean> };
export type Definition = { include: Node | null; exclude: Node | null };
export type Draft = {
  sourceId: number;
  sourceRevision: string;
  version: number;
  definition: Definition;
  semantics?: ConditionSemantics;
};
export type Conditions = Draft & { schemaChanged: boolean; columns: Column[] };
export type Preview = {
  draft: Draft;
  analysisConditions?: StudioConditions;
  population: {
    total: string;
    matched: string;
    excluded: string;
    remaining: string;
    matchedRatio: number | null;
    remainingRatio: number | null;
  };
};
export const nullOperator = (operator: string) => operator === 'isNull' || operator === 'isNotNull';
export const operators = (kind: Column['kind'], businessType?: Column['businessType']) => [
  ...(kind === 'unsupported' ? [] : ['eq', 'ne', 'in', 'notIn']),
  ...(businessType !== 'category' && ['number', 'date', 'timestamp'].includes(kind)
    ? ['gt', 'gte', 'lt', 'lte', 'between']
    : []),
  ...(businessType !== 'category' && kind === 'string' ? ['contains'] : []),
  'isNull',
  'isNotNull',
];
export const countNodes = (node: Node | null): number =>
  !node ? 0 : 1 + (node.kind === 'group' ? node.children.reduce((sum, child) => sum + countNodes(child), 0) : 0);
export const predicate = (column: Column): Node => ({
  kind: 'predicate',
  column: column.name,
  operator: column.kind === 'unsupported' ? 'isNull' : 'eq',
  ...(column.kind === 'unsupported' ? {} : { values: [column.kind === 'boolean' ? false : ''] }),
});
const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number(value.slice(0, 4)) >= 1 &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
/** Canonical base-10 coefficient/exponent, without rounding the input through Number. */
function decimalKey(text: string): string {
  const [mantissa, exponent = '0'] = text.replace(/^[+-]/, '').toLowerCase().split('e');
  const [whole, fraction = ''] = mantissa.split('.');
  const digits = `${whole}${fraction}`.replace(/^0+/, '');
  if (!digits) return '0';
  const coefficient = digits.replace(/0+$/, '');
  const power = Number(exponent) - fraction.length + digits.length - coefficient.length;
  return `${text.startsWith('-') ? '-' : ''}${coefficient}e${power}`;
}
/** Parse only explicit native column types. String columns retain their exact text. */
export function compile(definition: Definition, columns: Column[]): Definition {
  if (countNodes(definition.include) + countNodes(definition.exclude) > 32)
    throw new Error('조건은 총 32개 노드까지 가능합니다.');
  const visit = (node: Node | null, depth: number): Node | null => {
    if (!node) return null;
    if (node.kind === 'group') {
      if (depth >= 4) throw new Error('그룹 깊이는 4단계까지 가능합니다.');
      if (!['and', 'or'].includes(node.operator) || !node.children.length || node.children.length > 8)
        throw new Error('그룹에는 1~8개 조건이 필요합니다.');
      return { ...node, children: node.children.map(child => visit(child, depth + 1) as Node) };
    }
    const column = columns.find(c => c.name === node.column);
    const textCategory = column && categoryTextType(column.type);
    if (
      !column ||
      (textCategory && column.kind !== (column.businessType === 'category' ? 'string' : 'unsupported')) ||
      !operators(column.kind, column.businessType).includes(node.operator)
    )
      throw new Error('열과 원본 유형에 맞는 연산자를 확인해 주세요.');
    if (nullOperator(node.operator)) return { kind: 'predicate', column: node.column, operator: node.operator };
    const values = node.values ?? [];
    const multiple = ['in', 'notIn'].includes(node.operator);
    if (!values.length || values.length > 50 || (!multiple && values.length !== (node.operator === 'between' ? 2 : 1)))
      throw new Error('값 개수를 확인해 주세요. 목록은 최대 50개입니다.');
    const parsed = values.map(value => {
      const text = String(value);
      if (text.length > 2000) throw new Error('값은 2000자까지 가능합니다.');
      if (column.businessType === 'category' && textCategory) {
        if (typeof value !== 'string') throw new Error('UUID·ENUM 범주 값은 문자열로 입력하세요.');
        if (textCategory === 'uuid') {
          if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value))
            throw new Error('유효한 36자 UUID를 입력하세요.');
          return value.toLowerCase();
        }
        return value;
      }
      if (column.kind === 'number') {
        if (
          !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text) ||
          !Number.isFinite(Number(text)) ||
          Math.abs(Number(text)) > Number.MAX_SAFE_INTEGER
        )
          throw new Error('절댓값 9007199254740991 이하의 유효한 숫자를 입력하세요.');
        const numeric = Number(text);
        if (decimalKey(text) !== decimalKey(String(numeric)))
          throw new Error('입력한 숫자를 정밀도 손실 없이 전달할 수 없습니다. 값을 반올림하지 않고 입력을 보존했습니다.');
        return numeric;
      }
      if (column.kind === 'boolean') {
        if (typeof value !== 'boolean') throw new Error('참 또는 거짓을 선택하세요.');
        return value;
      }
      if (column.kind === 'date' && !validDate(text)) throw new Error('유효한 날짜 YYYY-MM-DD를 입력하세요.');
      if (
        column.kind === 'timestamp' &&
        (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(text) ||
          !validDate(text.slice(0, 10)) ||
          !Number.isFinite(Date.parse(text)) ||
          Number(text.slice(11, 13)) > 23 ||
          Number(text.slice(14, 16)) > 59 ||
          Number(text.slice(17, 19)) > 59)
      )
        throw new Error('유효한 ISO UTC 시각(예: 2024-01-01T00:00:00Z)을 입력하세요.');
      if (column.kind === 'timestamp') {
        return text.replace(/\.(\d+)Z$/, (_match, fraction: string) => {
          const trimmed = fraction.replace(/0+$/, '');
          const precision = /^TIMESTAMP_NS$/i.test(column.type.trim()) ? 9 : 6;
          if (trimmed.length > precision)
            throw new Error(
              `이 원본 시각 유형은 소수부 ${precision}자리까지 지원합니다. 값을 반올림하지 않고 입력을 보존했습니다.`,
            );
          return trimmed ? `.${trimmed}Z` : 'Z';
        });
      }
      return text;
    });
    if (node.operator === 'between') {
      // Pad fractions rather than using Date, which loses nanosecond ordering.
      const ordered =
        column.kind === 'timestamp'
          ? parsed.map(value => {
              const text = String(value);
              return text.slice(0, 19) + (text.split('.')[1]?.slice(0, -1) ?? '').padEnd(9, '0');
            })
          : parsed;
      if (ordered[0] > ordered[1]) throw new Error('범위의 시작 값은 끝 값 이하여야 합니다.');
    }
    return { ...node, values: parsed };
  };
  const result = { include: visit(definition.include, 0), exclude: visit(definition.exclude, 0) };
  if (new TextEncoder().encode(JSON.stringify(result)).length > 32768) throw new Error('조건 크기는 32KiB까지 가능합니다.');
  return result;
}
export function readConditions(value: Conditions, sourceId: number): Conditions {
  if (
    !value ||
    value.sourceId !== sourceId ||
    typeof value.sourceRevision !== 'string' ||
    !value.sourceRevision ||
    !Number.isInteger(value.version) ||
    value.version < 0 ||
    typeof value.schemaChanged !== 'boolean' ||
    !Array.isArray(value.columns) ||
    !value.columns.every(
      c =>
        c &&
        typeof c.name === 'string' &&
        typeof c.type === 'string' &&
        ['number', 'string', 'boolean', 'date', 'timestamp', 'unsupported'].includes(c.kind),
    ) ||
    !value.definition ||
    !('include' in value.definition) ||
    !('exclude' in value.definition)
  )
    throw new Error('invalid response');
  // The read contract returns current columns and a still-valid stored definition, even when the revision changed.
  readProfileColumns(value.columns);
  if (value.semantics !== undefined) validateConditionSemantics(value.semantics);
  for (const column of value.columns) {
    if (
      categoryTextType(column.type) &&
      (column.businessType === 'category') !==
        (value.semantics?.columns.find(c => c.column === column.name)?.businessType === 'category')
    )
      throw new Error('UUID·ENUM 범주의 업무 의미 기준을 확인해 주세요.');
  }
  // A newly adopted schema can make old values invalid. Preserve them for explicit review; compile before preview/save.
  validateStudioConditions({
    sourceRevision: 'a'.repeat(64),
    definition: value.definition,
    ...(value.semantics !== undefined ? { semantics: value.semantics } : {}),
  });
  return value;
}
// Object property order is not part of the API; array order and primitive types are.
function sameValue(left: any, right: any): boolean {
  if (left === right) return true;
  if (
    !left ||
    !right ||
    typeof left !== 'object' ||
    typeof right !== 'object' ||
    Array.isArray(left) !== Array.isArray(right)
  )
    return false;
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every(key => Object.prototype.hasOwnProperty.call(right, key) && sameValue(left[key], right[key]))
  );
}
export function readPreview(value: Preview, draft: Draft): Preview {
  if (!value || !sameValue(value.draft, draft) || !value.population) throw new Error('invalid preview');
  const p = value.population;
  if (
    ![p.total, p.matched, p.excluded, p.remaining].every(n => typeof n === 'string' && /^\d+$/.test(n)) ||
    ![p.matchedRatio, p.remainingRatio].every(
      n => n === null || (typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1),
    )
  )
    throw new Error('invalid population');
  if (value.analysisConditions !== undefined) {
    const analysisConditions = validateStudioConditions(value.analysisConditions);
    if (
      !sameValue(analysisConditions.definition, draft.definition) ||
      !sameValue(analysisConditions.semantics, draft.semantics)
    )
      throw new Error('invalid analysis conditions');
    return { ...value, analysisConditions };
  }
  return value;
}

const labels: Record<string, string> = {
  eq: '같음',
  ne: '다름',
  in: '목록에 포함',
  notIn: '목록에 없음',
  gt: '초과',
  gte: '이상',
  lt: '미만',
  lte: '이하',
  between: '사이 (양 끝 포함)',
  contains: '문자 포함',
  isNull: 'NULL임',
  isNotNull: 'NULL 아님',
};
export function Tree({
  node,
  columns,
  label,
  depth,
  room,
  onChange,
}: {
  node: Node | null;
  columns: Column[];
  label: string;
  depth: number;
  room: number;
  onChange: (node: Node | null) => void;
}) {
  const canAdd = room > 0 && depth <= 4 && columns.length > 0;
  const add = (group: boolean) => {
    const child: Node = group ? { kind: 'group', operator: 'and', children: [] } : predicate(columns[0]);
    if (!node) onChange(child);
    else if (node.kind === 'group') onChange({ ...node, children: [...node.children, child] });
  };
  return (
    <fieldset className="min-w-0 space-y-2 rounded-md border border-border p-2">
      <legend className="max-w-full text-sm font-medium break-words">{label}</legend>
      {node?.kind === 'group' && (
        <>
          <NativeSelect
            aria-label={`${label} 결합`}
            className="w-full"
            value={node.operator}
            onChange={e => onChange({ ...node, operator: e.target.value as 'and' | 'or' })}
          >
            <option value="and">AND · 모두 충족</option>
            <option value="or">OR · 하나 이상 충족</option>
          </NativeSelect>
          {node.children.map((child, index) => (
            <Tree
              key={index}
              node={child}
              columns={columns}
              label={`${label} ${index + 1}`}
              depth={depth + 1}
              room={room}
              onChange={next =>
                onChange({
                  ...node,
                  children: next
                    ? node.children.map((n, i) => (i === index ? next : n))
                    : node.children.filter((_, i) => i !== index),
                })
              }
            />
          ))}
        </>
      )}
      {node?.kind === 'predicate' && (
        <>
          <TextField
            select
            label={`${label} 열`}
            value={node.column}
            onChange={e => {
              const column = columns.find(c => c.name === e.target.value);
              if (column) onChange(predicate(column));
            }}
          >
            {!columns.some(c => c.name === node.column) && <option value={node.column}>{node.column} (현재 열 없음)</option>}
            {columns.map(c => (
              <option key={c.name} value={c.name}>
                {c.name} · {c.type}
              </option>
            ))}
          </TextField>
          <p className="text-xs break-words text-muted-foreground">
            {node.column} · {columns.find(c => c.name === node.column)?.type ?? '변경된 열'}
          </p>
          <TextField
            select
            label={`${label} 연산자`}
            value={node.operator}
            onChange={e => {
              const operator = e.target.value;
              const kind = columns.find(c => c.name === node.column)?.kind;
              onChange({
                ...node,
                operator,
                ...(nullOperator(operator)
                  ? { values: undefined }
                  : {
                      values: Array.from({ length: operator === 'between' ? 2 : 1 }, () =>
                        kind === 'boolean' ? false : '',
                      ),
                    }),
              });
            }}
          >
            {!operators(
              columns.find(c => c.name === node.column)?.kind ?? 'unsupported',
              columns.find(c => c.name === node.column)?.businessType,
            ).includes(node.operator) && (
              <option value={node.operator} disabled>
                {labels[node.operator] ?? node.operator} (현재 업무 의미에서 사용 불가)
              </option>
            )}
            {operators(
              columns.find(c => c.name === node.column)?.kind ?? 'unsupported',
              columns.find(c => c.name === node.column)?.businessType,
            ).map(op => (
              <option key={op} value={op}>
                {labels[op]}
              </option>
            ))}
          </TextField>
          {!nullOperator(node.operator) &&
            (node.values ?? []).map((value, index) => (
              <div key={index} className="flex min-w-0 items-end gap-2">
                <TextField
                  className="flex-1"
                  select={columns.find(c => c.name === node.column)?.kind === 'boolean'}
                  label={`${label} 값 ${index + 1}`}
                  value={String(value)}
                  maxLength={2000}
                  placeholder={
                    columns.find(c => c.name === node.column)?.kind === 'timestamp'
                      ? '2024-01-01T00:00:00Z'
                      : columns.find(c => c.name === node.column)?.kind === 'date'
                      ? 'YYYY-MM-DD'
                      : undefined
                  }
                  onChange={e =>
                    onChange({
                      ...node,
                      values: node.values?.map((v, i) =>
                        i === index
                          ? columns.find(c => c.name === node.column)?.kind === 'boolean'
                            ? e.target.value === 'true'
                            : e.target.value
                          : v,
                      ),
                    })
                  }
                >
                  <option value="false">거짓 (false)</option>
                  <option value="true">참 (true)</option>
                </TextField>
                {['in', 'notIn'].includes(node.operator) && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label={`${label} 값 ${index + 1} 삭제`}
                    onClick={() => onChange({ ...node, values: node.values?.filter((_, i) => i !== index) })}
                  >
                    값 삭제
                  </Button>
                )}
              </div>
            ))}
          {['in', 'notIn'].includes(node.operator) && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={(node.values?.length ?? 0) >= 50}
              onClick={() =>
                onChange({
                  ...node,
                  values: [
                    ...(node.values ?? []),
                    columns.find(c => c.name === node.column)?.kind === 'boolean' ? false : '',
                  ],
                })
              }
            >
              {label} 값 추가
            </Button>
          )}
        </>
      )}
      <div className="flex flex-wrap gap-2">
        {(!node || node.kind === 'group') && (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!canAdd || (node?.kind === 'group' && (node.children.length >= 8 || depth >= 4))}
              onClick={() => add(false)}
            >
              {label} 조건 추가
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={
                !canAdd || (node?.kind === 'group' && (node.children.length >= 8 || depth >= 3)) || (!node && depth >= 4)
              }
              onClick={() => add(true)}
            >
              {label} 그룹 추가
            </Button>
          </>
        )}
        {node && (
          <Button type="button" size="sm" variant="outline" onClick={() => onChange(null)}>
            {label} 삭제
          </Button>
        )}
      </div>
      {!node && <p className="text-xs text-muted-foreground">{label === '포함' ? '전체 포함' : '제외 없음'}</p>}
    </fieldset>
  );
}
const unwrap = (response: any) => {
  if (response?.data?.status !== 'SUCCESS') throw new Error('invalid response');
  return response.data.data;
};
type Props = {
  sourceId: number;
  canEdit?: boolean;
  /** Applies only the validated preview snapshot to the caller's local analysis, never source metadata. */
  onApply?: (conditions: StudioConditions) => void;
};
export default function SourceConditions({ sourceId, canEdit = true, onApply }: Props) {
  return <Editor key={`${sourceId}:${canEdit}`} sourceId={sourceId} canEdit={canEdit} onApply={onApply} />;
}
function Editor({ sourceId, canEdit, onApply }: Props) {
  const panelId = useId();
  const serial = useRef(0);
  const validatedPreview = useRef<Preview | null>(null);
  const inFlight = useRef(false);
  useEffect(
    () => () => {
      serial.current += 1;
      validatedPreview.current = null;
    },
    [],
  );
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Conditions | null>(null);
  const [definition, setDefinition] = useState<Definition>({ include: null, exclude: null });
  const [baseline, setBaseline] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirm, setConfirm] = useState(false);
  const invalidatePreview = () => {
    validatedPreview.current = null;
    setPreview(null);
  };
  const dirty = JSON.stringify({ definition, semantics: data?.semantics }) !== baseline && !!data;
  const accept = (next: Conditions) => {
    setData(next);
    setDefinition(next.definition);
    setBaseline(JSON.stringify({ definition: next.definition, semantics: next.semantics }));
    invalidatePreview();
  };
  const request = async (action: 'read' | 'preview' | 'save', adoptCurrentSemantics = false) => {
    if (inFlight.current || (action !== 'read' && !data) || (action === 'save' && (!canEdit || !validatedPreview.current)))
      return;
    inFlight.current = true;
    serial.current += 1;
    const token = serial.current;
    setBusy(true);
    setError('');
    setNotice('');
    setConfirm(false);
    if (action !== 'save') invalidatePreview();
    try {
      let draft: Draft | undefined;
      if (action === 'preview' && data)
        draft = {
          sourceId,
          sourceRevision: data.sourceRevision,
          version: data.version,
          definition: compile(definition, data.columns),
          ...(data.semantics !== undefined ? { semantics: data.semantics } : {}),
        };
      if (action === 'save') draft = validatedPreview.current?.draft;
      const result = unwrap(
        await post(
          `/bi/source-conditions/${action}`,
          draft ?? { sourceId, ...(adoptCurrentSemantics ? { adoptCurrentSemantics: true } : {}) },
        ),
      );
      if (serial.current !== token) return;
      if (action === 'preview' && draft) {
        const validated = readPreview(result, draft);
        validatedPreview.current = validated;
        setPreview(validated);
      } else {
        const next = readConditions(result, sourceId);
        if (data?.semantics && next.semantics === undefined) throw new Error('업무 의미가 누락됐습니다. 입력을 보존합니다.');
        if (
          action === 'save' &&
          (!draft ||
            next.sourceRevision !== draft.sourceRevision ||
            next.version !== draft.version + 1 ||
            !sameValue(next.definition, compile(draft.definition, data.columns)) ||
            !sameValue(next.semantics, draft.semantics))
        )
          throw new Error('invalid save response');
        if (adoptCurrentSemantics && data) {
          setData(next);
          invalidatePreview();
          setNotice('최신 업무 의미를 채택했습니다. 기존 조건 값은 보존했습니다. 다시 미리보기하세요.');
        } else accept(next);
        if (action === 'save') setNotice('조건을 저장했습니다.');
      }
    } catch (failure) {
      if (serial.current !== token) return;
      invalidatePreview();
      setError(
        failure?.response?.status === 409
          ? '다른 창 또는 데이터가 변경됐습니다. 입력을 보존했습니다. 최신 조건을 다시 읽어 확인하세요.'
          : action === 'read'
          ? '조건을 불러오지 못했습니다. 입력을 보존했습니다. 다시 시도하세요.'
          : action === 'save'
          ? '저장을 확인하지 못했습니다. 입력을 보존했습니다. 최신 조건을 다시 읽어 반영 여부를 확인하세요.'
          : `미리보기를 확인하지 못했습니다. 입력을 보존했습니다. ${
              failure instanceof Error && !failure.message.startsWith('invalid')
                ? failure.message
                : '조건을 확인하고 다시 시도하세요.'
            }`,
      );
    } finally {
      if (serial.current === token) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  };
  const edit = (next: Definition) => {
    // Retire any earlier preview answer before React commits the edited form.
    serial.current += 1;
    inFlight.current = false;
    setBusy(false);
    setDefinition(next);
    invalidatePreview();
    setNotice('');
    setError('');
    setConfirm(false);
  };
  const apply = () => {
    const validated = validatedPreview.current;
    if (!onApply || inFlight.current || !validated?.analysisConditions) return;
    const snapshot: StudioConditions = JSON.parse(JSON.stringify(validated.analysisConditions));
    onApply(snapshot);
  };
  const ratio = (value: number | null) => (value === null ? '비율 없음' : `${Math.round(value * 10000) / 100}%`);
  return (
    <section aria-label="소스 조건" className="my-3 min-w-0 rounded-lg border border-border">
      <Button
        type="button"
        variant="ghost"
        className="m-2 min-w-0 max-w-[calc(100%-1rem)] whitespace-normal break-words text-sm"
        aria-expanded={open}
        aria-controls={panelId}
        disabled={busy}
        onClick={() => {
          setOpen(!open);
          if (!open && !data) void request('read');
        }}
      >
        조건과 분석 범위
      </Button>
      {open && (
        <div id={panelId} className="min-w-0 space-y-3 border-t border-border p-3 text-sm">
          <p>
            소스 조건 미리보기는 전체 소스 · 전체 기간 · UTC 기준입니다. 포함 조건 충족 행에서 제외 조건이 참인 행만 뺍니다.
            NULL은 명시적으로 선택하세요.
          </p>
          <p className="text-xs text-muted-foreground">
            조건에 고정한 업무 의미를 사용하며, 업무 의미가 없으면 원본 유형을 따릅니다. 기존 분석·Studio·게시에는 자동
            적용하지 않습니다. 최대 깊이 4 · 그룹 자식 8 · 총 노드 32 · 목록 값 50.
          </p>
          {onApply && (
            <p>
              이 분석에 적용하면 현재 분석의 기간·필터·시간대 범위에 같은 조건을 사용합니다. 아래 전체 기간·UTC 미리보기
              건수와 분석 범위의 건수는 다를 수 있습니다. 소스 조건 저장과 다른 분석은 변경하지 않습니다.
            </p>
          )}
          {!canEdit && (
            <Notice severity="info">
              읽기 권한으로 조건 편집·미리보기{onApply ? '·이 분석에 적용' : ''}가 가능합니다. 소스 조건 저장 권한은
              없습니다.
            </Notice>
          )}
          {busy && <p role="status">처리 중입니다…</p>}
          {error && <Notice severity="error">{error}</Notice>}
          {notice && <p role="status">{notice}</p>}
          {data && (
            <>
              <p>
                <span>조건 버전 {data.version}</span> ·{' '}
                {data.semantics
                  ? `업무 의미 카탈로그 버전 ${data.semantics.catalogVersion}`
                  : '원본 유형 기준 (legacy native)'}
                {dirty ? ' · 미저장 변경' : ''}
              </p>
              {data.schemaChanged && (
                <Notice severity="warning">
                  소스 데이터 버전이 변경됐습니다. 현재 열과 조건을 확인하고 다시 미리보기하세요.
                </Notice>
              )}
              <fieldset disabled={busy} className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
                {(['include', 'exclude'] as const).map(key => (
                  <Tree
                    key={key}
                    node={definition[key]}
                    columns={data.columns}
                    label={key === 'include' ? '포함' : '제외'}
                    depth={0}
                    room={32 - countNodes(definition.include) - countNodes(definition.exclude)}
                    onChange={node => edit({ ...definition, [key]: node })}
                  />
                ))}
              </fieldset>
              <ConditionProfilePanel
                columns={data.columns}
                disabled={busy}
                contextKey={profileKey({
                  sourceId,
                  sourceRevision: data.sourceRevision,
                  version: data.version,
                  definition,
                  semantics: data.semantics,
                  columns: data.columns,
                })}
                scopeLabel="전체 소스 · 전체 기간 · UTC · 현재 포함/제외 입력"
                load={async (columns, signal) => {
                  const draft = {
                    sourceId,
                    sourceRevision: data.sourceRevision,
                    version: data.version,
                    definition: compile(definition, data.columns),
                    ...(data.semantics !== undefined ? { semantics: data.semantics } : {}),
                  };
                  const raw = unwrap(
                    await post('/bi/source-conditions/profile', { ...draft, columns }, { signal, timeout: 180000 }),
                  );
                  if (profileKey(raw?.draft) !== profileKey(draft))
                    throw new Error('분포 조회의 조건 기준이 요청과 다릅니다.');
                  return raw;
                }}
              />
            </>
          )}
          <div className="flex min-w-0 flex-wrap gap-2 [&>button]:min-w-0 [&>button]:max-w-full [&>button]:whitespace-normal [&>button]:break-words [&>button]:text-sm">
            {data && (
              <>
                <Button type="button" variant="outline" disabled={busy} onClick={() => void request('preview')}>
                  건수 미리보기
                </Button>
                <Button type="button" disabled={busy || !canEdit || !preview} onClick={() => void request('save')}>
                  확인한 조건 저장
                </Button>
                {onApply && (
                  <Button type="button" disabled={busy || !preview?.analysisConditions} onClick={apply}>
                    이 분석에 조건 적용
                  </Button>
                )}
              </>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => (dirty ? setConfirm(true) : void request('read'))}
            >
              최신 조건 다시 읽기
            </Button>
          </div>
          {data && (
            <Button type="button" variant="outline" disabled={busy} onClick={() => void request('read', true)}>
              최신 업무 의미 채택
            </Button>
          )}
          {confirm && (
            <Notice severity="warning">
              <p>미저장 입력을 버리고 최신 조건을 읽겠습니까?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => setConfirm(false)}>
                  입력 유지
                </Button>
                <Button type="button" onClick={() => void request('read')}>
                  입력을 버리고 다시 읽기
                </Button>
              </div>
            </Notice>
          )}
          {preview && (
            <section aria-label="조건 건수 미리보기" className="space-y-1 rounded-md border border-border p-3" role="status">
              <p>전체 {preview.population.total}건</p>
              <p>
                포함 충족 {preview.population.matched}건 · 전체 대비 {ratio(preview.population.matchedRatio)}
              </p>
              <p>그중 제외 {preview.population.excluded}건</p>
              <p>
                최종 {preview.population.remaining}건 · 전체 대비 {ratio(preview.population.remainingRatio)}
              </p>
              <p>
                {onApply
                  ? '이 검증 미리보기의 조건만 이 분석에 적용하거나 소스 조건으로 저장합니다. 적용과 저장은 각각 명시적으로 실행합니다.'
                  : '이 미리보기의 조건만 저장합니다.'}
              </p>
            </section>
          )}
        </div>
      )}
    </section>
  );
}
