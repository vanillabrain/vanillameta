import { BadRequestException } from '@nestjs/common';

export const DATE_FORMATS = {
  'YYYY-MM-DD': '%Y-%m-%d',
  'YYYY/MM/DD': '%Y/%m/%d',
  YYYYMMDD: '%Y%m%d',
} as const;
export type BusinessVariable = {
  businessType: 'auto' | 'number' | 'category' | 'date';
  dateFormat: '' | 'native' | keyof typeof DATE_FORMATS;
  classification: string;
};
export const numericType = (type: string) =>
  /^(U?(BIGINT|INTEGER|SMALLINT|TINYINT)|HUGEINT|UHUGEINT|FLOAT|DOUBLE|DECIMAL)(\b|\()/i.test(type);
export const temporalType = (type: string) =>
  /^(DATE|TIMESTAMP(?:_S|_MS|_NS)?(?: WITH TIME ZONE)?|TIMESTAMPTZ)$/i.test(type);
export const stringType = (type: string) => /^VARCHAR(?:\(\d+\))?$/i.test(type);

/** UC050: omission preserves a previous declaration; explicit auto/empty clears it. */
export function businessVariable(
  input: any,
  previous?: BusinessVariable,
  physicalType?: string,
): BusinessVariable {
  const value = {
    businessType:
      input.businessType === undefined ? previous?.businessType ?? 'auto' : input.businessType,
    dateFormat: input.dateFormat === undefined ? previous?.dateFormat ?? '' : input.dateFormat,
    classification:
      input.classification === undefined ? previous?.classification ?? '' : input.classification,
  };
  if (
    !['auto', 'number', 'category', 'date'].includes(value.businessType) ||
    typeof value.dateFormat !== 'string' ||
    !['', 'native', ...Object.keys(DATE_FORMATS)].includes(value.dateFormat) ||
    typeof value.classification !== 'string' ||
    value.classification.length > 80
  )
    throw new BadRequestException('업무 유형·날짜 형식·분류를 확인해 주세요.');
  value.classification = value.classification.normalize('NFKC').trim();
  if (value.classification.length > 80 || /[\u0000-\u001f\u007f]/.test(value.classification))
    throw new BadRequestException('분류는 제어 문자 없이 80자 이하여야 합니다.');
  if ((value.businessType === 'date') !== (value.dateFormat !== ''))
    throw new BadRequestException(
      '날짜 유형에는 날짜 형식이 필요합니다. 다른 유형의 날짜 형식은 비워 주세요.',
    );
  if (physicalType) {
    const compatible =
      value.businessType === 'auto' ||
      (value.businessType === 'number' &&
        numericType(physicalType) &&
        !/[\[\]]/.test(physicalType)) ||
      (value.businessType === 'category' &&
        /^(?:U?(?:BIGINT|INTEGER|SMALLINT|TINYINT)|HUGEINT|UHUGEINT|FLOAT|DOUBLE|DECIMAL|VARCHAR|BOOLEAN|DATE|TIMESTAMP|UUID|ENUM)(?:\b|\()/i.test(
          physicalType,
        ) &&
        !/\[|\]/.test(physicalType)) ||
      (value.businessType === 'date' &&
        ((temporalType(physicalType) && value.dateFormat === 'native') ||
          (stringType(physicalType) &&
            Object.prototype.hasOwnProperty.call(DATE_FORMATS, value.dateFormat))));
    if (!compatible)
      throw new BadRequestException('업무 유형·날짜 형식이 원본 열 유형과 맞지 않습니다.');
  }
  return value as BusinessVariable;
}
