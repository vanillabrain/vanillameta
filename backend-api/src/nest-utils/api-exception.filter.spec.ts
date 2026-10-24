import { BadRequestException, HttpException } from '@nestjs/common';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ApiExceptionFilter } from './api-exception.filter';
import { HttpExceptionFilter } from './http-exception.filter';

describe('ApiExceptionFilter', () => {
  const host: any = {};
  const setup = () => {
    const httpFilter = { catch: jest.fn() };
    const filter = new ApiExceptionFilter({} as any, httpFilter);
    jest.spyOn((filter as any).log, 'error').mockImplementation(() => undefined);
    const base = jest.spyOn(Object.getPrototypeOf(ApiExceptionFilter.prototype), 'catch');
    base.mockImplementation(() => undefined);
    return { filter, httpFilter, base };
  };
  afterEach(() => jest.restoreAllMocks());

  it('answers an HttpException through the existing filter, unchanged', () => {
    const { filter, httpFilter, base } = setup();
    const exception = new BadRequestException('bad');
    filter.catch(exception, host);
    expect(httpFilter.catch).toHaveBeenCalledWith(exception, host);
    expect(base).not.toHaveBeenCalled();
  });

  it.each([
    ['AI_NOT_CONFIGURED', 503, 'AI_NOT_CONFIGURED'],
    ['LLM_TIMEOUT', 504, 'LLM_TIMEOUT'],
    ['LLM_OUTPUT_TRUNCATED', 502, 'LLM_OUTPUT_TRUNCATED'],
    ['LLM_API_ERROR_429', 502, 'LLM_UNAVAILABLE'],
  ])(
    'answers the gateway’s %s as %s in the HttpException shape, not a 500',
    (code, status, error) => {
      const { filter, httpFilter } = setup();
      filter.catch(new Error(code), host);
      const [exception] = httpFilter.catch.mock.calls[0];
      expect(exception).toBeInstanceOf(HttpException);
      expect(exception.getStatus()).toBe(status);
      expect(exception.getResponse()).toMatchObject({ error, message: expect.any(String) });
    },
  );

  it('keeps the original error for the operator: logged with its message, attached as the cause', () => {
    const { filter, httpFilter } = setup();
    const log = jest.spyOn((filter as any).log, 'error').mockImplementation(() => undefined);
    const original = new Error('LLM_API_ERROR_401');
    filter.catch(original, host);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('LLM_API_ERROR_401'), original.stack);
    expect(httpFilter.catch.mock.calls[0][0].cause).toBe(original);
  });

  it('leaves any other error to Nest’s default handling', () => {
    const { filter, httpFilter, base } = setup();
    const exception = new Error('LLM_SOMETHING_NEW');
    filter.catch(exception, host);
    expect(httpFilter.catch).not.toHaveBeenCalled();
    expect(base).toHaveBeenCalledWith(exception, host);
  });

  it('answers through the real HttpExceptionFilter body shape', () => {
    const json = jest.fn();
    const response = { setHeader: jest.fn(), status: jest.fn().mockReturnValue({ json }) };
    const real: any = {
      switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => response }),
    };
    new ApiExceptionFilter({} as any, new HttpExceptionFilter()).catch(
      new Error('LLM_TIMEOUT'),
      real,
    );
    expect(response.status).toHaveBeenCalledWith(504);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: 504,
        data: expect.objectContaining({ error: 'LLM_TIMEOUT' }),
      }),
    );
  });

  it('is the filter main.ts registers, so a gateway failure cannot fall through to a 500 again', () => {
    const main = readFileSync(resolve(__dirname, '../main.ts'), 'utf8');
    expect(main).toMatch(/useGlobalFilters\(\s*new ApiExceptionFilter\(/);
  });
});
