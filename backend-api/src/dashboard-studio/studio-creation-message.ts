import { BadRequestException } from '@nestjs/common';

/** UC036: only explicit standalone positive commands authorize a write. */
export function creationMessageAction(
  prompt: string,
  blocks?: { title: string }[],
): 'save' | number | 'append' {
  const compact = prompt
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[.!。]$/, '');
  if (
    [
      '저장',
      '저장해줘',
      '저장해주세요',
      '이생성안저장해줘',
      '이생성안을저장해줘',
      '이제안을저장해줘',
      '미리보기를저장해줘',
      '이대로저장해줘',
      '비공개로저장해줘',
      'save',
      'savethispreview',
      'savethisproposal',
    ].includes(compact)
  )
    return 'save';
  if (/저장|save|게시|공유|publish|share|복제|원본|캔버스|새\s*대시보드/i.test(prompt))
    throw new BadRequestException(
      '생성안 수정과 저장은 나누어 요청해 주세요. 원본 편집은 대상 복귀 버튼을 사용하고, 게시·공유는 저장 후 확인해 주세요.',
    );
  if (!blocks?.length)
    throw new BadRequestException('카드에서 소스와 계산 기준을 먼저 확인해 주세요.');
  const numericTargets = [...prompt.matchAll(/(-?\d+(?:\.\d+)?)\s*(?:번(?:째)?|번째)/g)];
  if (
    numericTargets.some(
      match =>
        !Number.isInteger(Number(match[1])) ||
        Number(match[1]) < 1 ||
        Number(match[1]) > blocks.length,
    )
  )
    throw new BadRequestException('생성안에 있는 블록 번호를 지정해 주세요.');
  const ordinals = [
    /(?:첫\s*번째|첫째|(?<!\d)1\s*(?:번(?:째)?|번째))\s*(?:블록|차트)?/,
    /(?:두\s*번째|둘째|(?<!\d)2\s*(?:번(?:째)?|번째))\s*(?:블록|차트)?/,
    /(?:세\s*번째|셋째|(?<!\d)3\s*(?:번(?:째)?|번째))\s*(?:블록|차트)?/,
    /(?:네\s*번째|넷째|(?<!\d)4\s*(?:번(?:째)?|번째))\s*(?:블록|차트)?/,
    /(?:다섯\s*번째|다섯째|(?<!\d)5\s*(?:번(?:째)?|번째))\s*(?:블록|차트)?/,
    /(?:여섯\s*번째|여섯째|(?<!\d)6\s*(?:번(?:째)?|번째))\s*(?:블록|차트)?/,
  ];
  const numbered = ordinals.flatMap((test, index) => (test.test(prompt) ? [index] : []));
  const append =
    /새\s*블록(?:을)?\s*추가|블록(?:을)?\s*(?:하나|한\s*개)\s*추가|add\s+(?:a\s+)?(?:new\s+)?block/i.test(
      prompt,
    );
  if (append && !numbered.length) return 'append';
  if (!append && numbered.length === 1 && numbered[0] < blocks.length) return numbered[0];
  if (!append && !numbered.length) {
    const named = blocks.flatMap((block, index) =>
      block.title && prompt.includes(block.title) ? [index] : [],
    );
    if (named.length === 1) return named[0];
    if (!named.length && blocks.length === 1) return 0;
  }
  throw new BadRequestException(
    '수정할 블록을 하나만 지정해 주세요. 예: 첫 번째 블록의 제목을 바꿔 줘 / 새 블록 추가.',
  );
}
