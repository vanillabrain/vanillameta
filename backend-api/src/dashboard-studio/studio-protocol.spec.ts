import { readFileSync } from 'fs';
import { resolve } from 'path';
import { applyStudioOperation } from './studio-operations';
const read = (name: string) =>
  JSON.parse(readFileSync(resolve(__dirname, '../../../fixtures/studio', name), 'utf8'));
describe('shared Studio protocol examples', () => {
  for (const item of read('operation-cases.json'))
    it(item.name, () => {
      const input = read('document-v1.json');
      if (item.invalid) expect(() => applyStudioOperation(input, item.operation)).toThrow();
      else expect(applyStudioOperation(input, item.operation)).toMatchObject(item.expected);
      expect(input).toEqual(read('document-v1.json'));
    });
});
