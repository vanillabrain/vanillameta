/** A model step the server refused or could not start. Trying the same step again will not help. */
export const AI_BLOCK_MESSAGES: Record<string, string> = {
  AI_QUOTA_EXCEEDED:
    '오늘 사용할 수 있는 AI 호출을 모두 썼습니다. 한도는 매일 초기화됩니다. 아무것도 저장하거나 공유하지 않았고 초안은 그대로입니다. 초기화된 뒤 새 요청으로 시작해 주세요.',
  AI_BUDGET_EXHAUSTED:
    '이번 달 서비스 전체의 AI 사용량이 한도에 도달해 지금은 AI를 쓸 수 없습니다. 아무것도 저장하거나 공유하지 않았고 초안은 그대로입니다. 다음 달에 다시 사용할 수 있습니다.',
  AI_NOT_CONFIGURED: 'AI 기능이 아직 연결되지 않았습니다. 초안은 그대로입니다. 운영자에게 문의해 주세요.',
  AI_INPUT_TOO_LARGE: 'AI에 보낼 내용이 너무 큽니다. 초안은 그대로입니다. 범위를 줄여 다시 시도해 주세요.',
};
