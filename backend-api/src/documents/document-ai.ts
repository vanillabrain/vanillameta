import { ModuleRef } from '@nestjs/core';
import type { LlmRequest } from '../ai/llm-gateway.service';

export interface DocumentSummaryAi {
  generate(request: LlmRequest): Promise<string>;
}
export const DOCUMENT_SUMMARY_AI = Symbol.for('vanillameta.document-summary-ai');
export const documentSummaryAiProvider = {
  provide: DOCUMENT_SUMMARY_AI,
  inject: [ModuleRef],
  useFactory: (moduleRef: ModuleRef): DocumentSummaryAi => ({
    async generate(request) {
      const { LlmGateway } = await import('../ai/llm-gateway.service');
      return moduleRef.get(LlmGateway, { strict: false }).generate(request);
    },
  }),
};
