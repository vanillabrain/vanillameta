import { ModuleRef } from '@nestjs/core';
import type { LlmRequest } from '../ai/llm-gateway.service';

/** Kept free of the AI SDK import so unit tests can load the reports module. */
export interface ReportBodyAi {
  generate(request: LlmRequest): Promise<string>;
}
export const REPORT_BODY_AI = Symbol.for('vanillameta.report-body-ai');
export const reportBodyAiProvider = {
  provide: REPORT_BODY_AI,
  inject: [ModuleRef],
  useFactory: (moduleRef: ModuleRef): ReportBodyAi => ({
    async generate(request) {
      const { LlmGateway } = await import('../ai/llm-gateway.service');
      return moduleRef.get(LlmGateway, { strict: false }).generate(request);
    },
  }),
};
