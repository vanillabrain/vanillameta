import { BadRequestException } from '@nestjs/common';

export const DATE_FORMATS = {
  'YYYY-MM-DD': '%Y-%m-%d',
  'YYYY/MM/DD': '%Y/%m/%d',
  YYYYMMDD: '%Y%m%d',
} as const;
export type ClassificationRef = { organizationId: number; id: number; version: number };

/** History validation only: never resolve a saved reference against today's registry. */
export function classificationRef(value: unknown): ClassificationRef | null {
  if (value === null) return null;
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Reflect.ownKeys(value).length !== 3 ||
    Reflect.ownKeys(value).some(
      key => typeof key !== 'string' || !['organizationId', 'id', 'version'].includes(key),
    ) ||
    ['organizationId', 'id', 'version'].some(key => {
      const field = Object.getOwnPropertyDescriptor(value, key);
      return (
        !field ||
        !('value' in field) ||
        !Number.isSafeInteger(field.value) ||
        field.value <= 0 ||
        field.value > 2147483647
      );
    })
  )
    throw new BadRequestException('분류 연결 기준을 확인해 주세요.');
  const ref = value as ClassificationRef;
  return { organizationId: ref.organizationId, id: ref.id, version: ref.version };
}

export const sameClassificationRef = (a?: ClassificationRef | null, b?: ClassificationRef | null) =>
  a?.organizationId === b?.organizationId && a?.id === b?.id && a?.version === b?.version;

export type BusinessVariable = {
  businessType: 'auto' | 'number' | 'category' | 'date';
  dateFormat: '' | 'native' | keyof typeof DATE_FORMATS;
  classification: string;
  classificationRef?: ClassificationRef | null;
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
  const previousRef =
    previous?.classificationRef === undefined
      ? undefined
      : classificationRef(previous.classificationRef);
  const ref =
    input.classificationRef === undefined
      ? previousRef
      : classificationRef(input.classificationRef);
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
  if (
    previousRef &&
    (ref === null || sameClassificationRef(ref, previousRef)) &&
    value.classification !== previous.classification
  )
    throw new BadRequestException('연결된 분류 이름은 선택한 기준으로 유지해야 합니다.');
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
  return { ...value, ...(ref === undefined ? {} : { classificationRef: ref }) } as BusinessVariable;
}
