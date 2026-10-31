import { ValueTransformer } from 'typeorm';

/** PostgreSQL returns bigint as text; every product column currently stores a JS-safe count. */
export const numberFromBigInt: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | number | null) =>
    value === null || value === undefined ? value : Number(value),
};
