import { creationMessageAction } from './studio-creation-message';
const blocks = [{ title: 'Revenue' }, { title: 'Refunds' }];
it.each(['저장해줘', '이 생성안을 저장해 줘', '비공개로 저장해줘', 'save this preview'])(
  'allows standalone positive save %s',
  prompt => expect(creationMessageAction(prompt)).toBe('save'),
);
it.each([
  '저장하지마',
  '저장할까?',
  '저장하고 공유해줘',
  '첫 번째 블록을 수정하고 저장해줘',
  '원본 제목 바꿔줘',
  '게시해줘',
  '두 블록을 바꿔줘',
  '11번 블록을 바꿔줘',
  '첫 번째와 두 번째 블록 수정',
])('refuses an ambiguous or non-save authorization %s', prompt =>
  expect(() => creationMessageAction(prompt, blocks)).toThrow(),
);
it.each([
  ['첫 번째 블록 제목 변경', 0],
  ['2번 블록 변경', 1],
  ['Refunds 제목 변경', 1],
  ['새 블록 추가', 'append'],
  ['블록을 하나 추가', 'append'],
])('resolves a single explicit target %s', (prompt, target) =>
  expect(creationMessageAction(String(prompt), blocks)).toBe(target),
);
it('does not infer an ambiguous title but allows an implicit single block', () => {
  expect(() =>
    creationMessageAction('Revenue 변경', [{ title: 'Revenue' }, { title: 'Revenue' }]),
  ).toThrow();
  expect(creationMessageAction('제목을 바꿔 줘', [blocks[0]])).toBe(0);
});

it.each(['0번 블록 변경', '11번 블록 변경', '-1번 블록 변경', '1.5번 블록 변경'])(
  'does not fall back to the only block for an invalid explicit target %s',
  prompt => expect(() => creationMessageAction(prompt, [blocks[0]])).toThrow(),
);
