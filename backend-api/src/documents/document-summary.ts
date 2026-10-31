export const SUMMARY_CONSENT_REQUIRED = 'SUMMARY_CONSENT_REQUIRED';
export class SummaryConsentRequired extends Error {
  readonly code = SUMMARY_CONSENT_REQUIRED;
  constructor() {
    super('AI 요약은 호출 비용이 발생합니다. confirmAiCost=true로 명시 동의한 뒤 다시 요청하세요.');
  }
}
export function summaryPrompt(title: string, markdown: string) {
  return [
    '문서 제목: ' + title,
    '본문:',
    markdown.slice(0, 24000),
    '',
    '위 문서를 한국어 5문장 이내로 요약하세요. 문서에 없는 내용은 추가하지 마세요.',
  ].join('\n');
}
export async function summarizeDocument(input: {
  confirmAiCost: boolean;
  title: string;
  markdown: string;
  generate: (prompt: string) => Promise<string>;
}) {
  if (input.confirmAiCost !== true) throw new SummaryConsentRequired();
  const summary = (await input.generate(summaryPrompt(input.title, input.markdown))).trim();
  if (!summary) throw new Error('EMPTY_SUMMARY');
  return { summary: summary.slice(0, 4000) };
}
