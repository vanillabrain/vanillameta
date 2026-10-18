jest.mock('./ai.service', () => ({ AiService: class {} }));
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AiDashboardService } from './ai-dashboard.service';

describe('FR015 business validation errors retain current source authority', () => {
  it.each(['revoked', 'replaced', 'unchanged'] as const)(
    '%s while full date validation fails',
    async mode => {
      let revoked = false;
      let file = 'a'.repeat(64);
      const access = {
        assert: jest.fn(async () => {
          if (revoked) throw new ForbiddenException('Denied');
        }),
      };
      const connection = {
        isDuckDB: jest.fn().mockResolvedValue(true),
        duckDBVersion: jest.fn(async () => file),
        withDuckDBSnapshot: jest.fn(async (_id, run) => run()),
        captureDuckDBSnapshot: jest.fn(async () => ({ run: async callback => callback() })),
        queryDuckDB: jest.fn(async () => ({
          datas: [
            { column_name: 'business_day', column_type: 'VARCHAR' },
            { column_name: 'amount', column_type: 'DOUBLE' },
          ],
        })),
      };
      const service = new AiDashboardService(
        {} as any,
        connection as any,
        {} as any,
        access as any,
      );
      const validationError = new BadRequestException({
        code: 'INVALID_BUSINESS_DATES',
        details: [{ invalidCount: '9' }],
      });
      jest.spyOn(service, 'assertConditionSemantics').mockImplementation(async () => {
        if (mode === 'revoked') revoked = true;
        if (mode === 'replaced') file = 'b'.repeat(64);
        throw validationError;
      });
      const request = {
        draft: {
          databaseId: 1,
          title: 'Test',
          explanation: '',
          widgets: [
            {
              title: 'Amount',
              description: '',
              type: 'BOARD_NUMERIC',
              sql: 'SELECT sum(amount) AS value FROM source',
              valueField: 'value',
              decimalPlaces: 0,
            },
          ],
        },
        conditions: {
          sourceRevision: file,
          definition: { include: null, exclude: null },
          semantics: {
            schemaVersion: 1,
            catalogVersion: 1,
            columns: [{ column: 'business_day', businessType: 'date', dateFormat: 'YYYY/MM/DD' }],
          },
        },
      };
      await expect(service.preview(request, 7)).rejects.toMatchObject({
        status: mode === 'revoked' ? 403 : mode === 'replaced' ? 409 : 400,
      });
      expect(access.assert).toHaveBeenCalledTimes(2);
      expect(connection.queryDuckDB).toHaveBeenCalledTimes(1); // DESCRIBE only, no aggregate fallback.
    },
  );
});
