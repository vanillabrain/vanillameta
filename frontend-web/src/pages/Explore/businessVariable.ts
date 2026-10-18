export type BusinessSemantics = {
  businessType?: 'auto' | 'number' | 'category' | 'date';
  dateFormat?: '' | 'native' | 'YYYY-MM-DD' | 'YYYY/MM/DD' | 'YYYYMMDD';
  classification?: string;
};
export const businessTypeLabels = { auto: '원본 유형 따름', number: '수치', category: '범주', date: '날짜' };
export const variableFields = ['businessType', 'dateFormat', 'classification'];
export function validBusinessSemantics(value: BusinessSemantics) {
  const kind = value.businessType ?? 'auto',
    format = value.dateFormat ?? '';
  return (
    (value.businessType === undefined || Object.prototype.hasOwnProperty.call(businessTypeLabels, value.businessType)) &&
    (value.dateFormat === undefined || ['', 'native', 'YYYY-MM-DD', 'YYYY/MM/DD', 'YYYYMMDD'].includes(value.dateFormat)) &&
    (value.classification === undefined ||
      (typeof value.classification === 'string' && value.classification.length <= 80)) &&
    (kind === 'date') === (format !== '')
  );
}
export function variableText(field: string, value: string) {
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
