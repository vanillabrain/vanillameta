import { describe, expect, it } from 'vitest';
import fixture from '../../../../../fixtures/studio/document-v1.json';
import cases from '../../../../../fixtures/studio/operation-cases.json';
import { applyStudioOperation } from './studioReducer';
import { StudioDocumentV1, StudioOperation } from './studioTypes';
describe('shared Studio protocol examples', () => {
  for (const item of cases)
    it(item.name, () => {
      const input = structuredClone(fixture) as StudioDocumentV1;
      if (item.invalid) expect(() => applyStudioOperation(input, item.operation as StudioOperation)).toThrow();
      else expect(applyStudioOperation(input, item.operation as StudioOperation)).toMatchObject(item.expected);
      expect(input).toEqual(fixture);
    });
});
