import { ClassificationRef, validClassificationRef } from '@/api/classificationService';
export type BusinessSemantics = {
  businessType?: 'auto' | 'number' | 'category' | 'date';
  dateFormat?: '' | 'native' | 'YYYY-MM-DD' | 'YYYY/MM/DD' | 'YYYYMMDD';
  classification?: string;
  classificationRef?: ClassificationRef | null;
};
export const businessTypeLabels = { auto: '원본 유형 따름', number: '수치', category: '범주', date: '날짜' };
export const variableFields = ['businessType', 'dateFormat', 'classification', 'classificationRef'];
export function validBusinessSemantics(value: BusinessSemantics) {
  const kind = value.businessType ?? 'auto',
    format = value.dateFormat ?? '';
  return (
    (value.businessType === undefined || Object.prototype.hasOwnProperty.call(businessTypeLabels, value.businessType)) &&
    (value.dateFormat === undefined || ['', 'native', 'YYYY-MM-DD', 'YYYY/MM/DD', 'YYYYMMDD'].includes(value.dateFormat)) &&
    (value.classification === undefined ||
      (typeof value.classification === 'string' && value.classification.length <= 80)) &&
    (value.classificationRef == null || validClassificationRef(value.classificationRef)) &&
    (kind === 'date') === (format !== '')
  );
}
export function variableText(field: string, value: string) {
  if (field === 'classificationRef') {
    const ref = JSON.parse(value);
    if (ref === null) return '연결 없음';
    if (!validClassificationRef(ref)) throw new Error('분류 연결 기준을 확인할 수 없습니다.');
    return `조직 ${ref.organizationId} · 분류 ${ref.id} · 버전 ${ref.version}`;
  }
  if (field === 'businessType') return businessTypeLabels[value] ?? value;
  if (field === 'dateFormat' && value === 'native') return '원본 날짜·시간';
  return value;
}

/** Only explicit business categories project these native scalar types to text. */
export function categoryTextType(type: string): 'uuid' | 'enum' | undefined {
  if (/^UUID$/i.test(type.trim())) return 'uuid';
  if (/^ENUM(?:\s*\(|$)/i.test(type.trim())) return 'enum';
  return undefined;
}

export const classificationRefKey = (ref?: ClassificationRef | null) =>
  ref == null ? '' : JSON.stringify([ref.organizationId, ref.id, ref.version]);
