import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common';
import { AbstractHttpAdapter, BaseExceptionFilter } from '@nestjs/core';
import { llmFailure } from '../ai/ai-caller';

/**
 * The one global exception filter. An `HttpException` is answered exactly as before. The AI gateway's own
 * failures are plain errors whose message is a code (`LLM_TIMEOUT`, `AI_NOT_CONFIGURED` …); a call site
 * with no answer of its own lets them go up, and they are answered here in the same shape instead of as a
 * 500. Anything else gets Nest's default handling.
 */
@Catch()
export class ApiExceptionFilter extends BaseExceptionFilter {
  private readonly log = new Logger(ApiExceptionFilter.name);

  constructor(
    httpAdapter: AbstractHttpAdapter,
    private readonly httpFilter: { catch(exception: HttpException, host: ArgumentsHost): unknown },
  ) {
    super(httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    if (exception instanceof HttpException) return this.httpFilter.catch(exception, host);
    const failure = llmFailure(exception);
    if (failure) {
      // The client gets a fixed message; the operator needs the real code (a 401 from the provider is
      // a bad key) and the original stack, which the rewritten exception would otherwise hide.
      this.log.error(
        `${failure.errorCode}: ${(exception as Error).message}`,
        (exception as Error).stack,
      );
      return this.httpFilter.catch(
        new HttpException({ error: failure.errorCode, message: failure.message }, failure.status, {
          cause: exception,
        }),
        host,
      );
    }
    return super.catch(exception, host);
  }
}
