import { MAX_TARGET_CANDIDATES, resolveBlockTarget } from './block-target';

describe('UC-015 prompt block target resolver', () => {
  const items = [
    { key: 'block-1', title: '월별 매출' },
    { key: 'block-2', title: '월별 비용' },
    { key: 'block-3', title: '건수' },
  ];
  const all = [
    { key: 'block-1', title: '월별 매출', position: 1 },
    { key: 'block-2', title: '월별 비용', position: 2 },
    { key: 'block-3', title: '건수', position: 3 },
  ];

  it('resolves the 1-based current position for 번 and 번째 markers', () => {
    expect(
      resolveBlockTarget({ prompt: '2번 차트의 소수 자릿수를 1자리로 바꿔 줘', items }),
    ).toEqual({ kind: 'resolved', key: 'block-2' });
    expect(resolveBlockTarget({ prompt: '3번째 블록 제목을 바꿔 줘', items })).toEqual({
      kind: 'resolved',
      key: 'block-3',
    });
    expect(resolveBlockTarget({ prompt: '1번째 차트의 단위를 원으로 바꿔 줘', items })).toEqual({
      kind: 'resolved',
      key: 'block-1',
    });
  });

  it('lets a unique explicit reference override the stale selection', () => {
    expect(
      resolveBlockTarget({
        prompt: '2번 차트의 단위를 원으로 바꿔 줘',
        items,
        selectedKey: 'block-1',
      }),
    ).toEqual({ kind: 'resolved', key: 'block-2' });
    expect(
      resolveBlockTarget({
        prompt: '건수 차트의 소수 자릿수를 바꿔 줘',
        items,
        selectedKey: 'block-2',
      }),
    ).toEqual({ kind: 'resolved', key: 'block-3' });
  });

  it('resolves an exact unquoted title that is followed by a block marker', () => {
    expect(resolveBlockTarget({ prompt: '월별 매출 차트의 소수 자릿수를 바꿔 줘', items })).toEqual(
      {
        kind: 'resolved',
        key: 'block-1',
      },
    );
    expect(resolveBlockTarget({ prompt: '건수의 단위를 원으로 바꿔 줘', items })).toEqual({
      kind: 'resolved',
      key: 'block-3',
    });
  });

  it('resolves a quoted exact title that is followed by a block marker', () => {
    expect(resolveBlockTarget({ prompt: '"월별 비용" 차트의 제목을 바꿔 줘', items })).toEqual({
      kind: 'resolved',
      key: 'block-2',
    });
    expect(
      resolveBlockTarget({ prompt: "'월별 비용' 블록의 소수 자릿수를 바꿔 줘", items }),
    ).toEqual({ kind: 'resolved', key: 'block-2' });
  });

  it('never selects a target from a quoted new title', () => {
    expect(
      resolveBlockTarget({
        prompt: '제목을 "새 매출"으로 바꿔 줘',
        items,
        selectedKey: 'block-3',
      }),
    ).toEqual({ kind: 'resolved', key: 'block-3' });
    expect(resolveBlockTarget({ prompt: '제목을 "새 매출"으로 바꿔 줘', items })).toEqual({
      kind: 'ambiguous',
      reason: 'no-selection',
      candidates: all,
    });
  });

  it('clarifies unquoted references in a new-title clause rather than choosing another block', () => {
    for (const prompt of [
      '제목을 2번 차트로 바꿔 줘',
      '제목을 월별 비용의 추세로 바꿔 줘',
      '제목을 "월별 비용" 블록으로 바꿔 줘',
    ]) {
      expect(resolveBlockTarget({ prompt, items, selectedKey: 'block-1' })).toEqual({
        kind: 'ambiguous',
        reason: 'unknown-reference',
        candidates: all,
      });
    }
  });

  it('never treats a title embedded in a longer word as a reference', () => {
    const short = [
      { key: 'metric-1', title: '매출' },
      { key: 'metric-2', title: '비용' },
    ];
    expect(
      resolveBlockTarget({
        prompt: '제목을 "새 매출"으로 바꿔 줘',
        items: short,
        selectedKey: 'metric-2',
      }),
    ).toEqual({ kind: 'resolved', key: 'metric-2' });
    expect(
      resolveBlockTarget({ prompt: '총매출 차트의 소수 자릿수를 바꿔 줘', items: short }),
    ).toEqual({
      kind: 'ambiguous',
      reason: 'unknown-reference',
      candidates: [
        { key: 'metric-1', title: '매출', position: 1 },
        { key: 'metric-2', title: '비용', position: 2 },
      ],
    });
  });

  it('matches title text literally without building a regex from it', () => {
    const meta = [
      { key: 'sum', title: 'a+b' },
      { key: 'group', title: '매출(원)' },
      { key: 'wild', title: '.*' },
    ];
    const everyCandidate = [
      { key: 'sum', title: 'a+b', position: 1 },
      { key: 'group', title: '매출(원)', position: 2 },
      { key: 'wild', title: '.*', position: 3 },
    ];
    expect(resolveBlockTarget({ prompt: 'a+b 차트의 소수 자릿수를 바꿔 줘', items: meta })).toEqual(
      { kind: 'resolved', key: 'sum' },
    );
    expect(
      resolveBlockTarget({ prompt: '매출(원) 차트의 소수 자릿수를 바꿔 줘', items: meta }),
    ).toEqual({ kind: 'resolved', key: 'group' });
    expect(resolveBlockTarget({ prompt: 'aab 차트의 소수 자릿수를 바꿔 줘', items: meta })).toEqual(
      { kind: 'ambiguous', reason: 'unknown-reference', candidates: everyCandidate },
    );
    expect(resolveBlockTarget({ prompt: '전체 매출 차트의 소수 자릿수', items: meta })).toEqual({
      kind: 'ambiguous',
      reason: 'unknown-reference',
      candidates: everyCandidate,
    });
  });

  it('clarifies with every current block for an unknown number or title', () => {
    expect(
      resolveBlockTarget({
        prompt: '9번 차트의 소수 자릿수를 바꿔 줘',
        items,
        selectedKey: 'block-1',
      }),
    ).toEqual({ kind: 'ambiguous', reason: 'unknown-reference', candidates: all });
    expect(resolveBlockTarget({ prompt: '"없는 지표" 차트의 소수 자릿수', items })).toEqual({
      kind: 'ambiguous',
      reason: 'unknown-reference',
      candidates: all,
    });
    expect(resolveBlockTarget({ prompt: '0번째 블록의 제목을 바꿔 줘', items })).toEqual({
      kind: 'ambiguous',
      reason: 'unknown-reference',
      candidates: all,
    });
  });

  it('never falls back to a stale selection for an unknown unquoted block reference', () => {
    expect(
      resolveBlockTarget({
        prompt: '없는 비용이 블록의 소수 자릿수를 바꿔 줘',
        items,
        selectedKey: 'block-1',
      }),
    ).toEqual({ kind: 'ambiguous', reason: 'unknown-reference', candidates: all });
    expect(
      resolveBlockTarget({
        prompt: '없는 지표 블록의 소수 자릿수를 바꿔 줘',
        items,
        selectedKey: 'block-1',
      }),
    ).toEqual({ kind: 'ambiguous', reason: 'unknown-reference', candidates: all });
    expect(
      resolveBlockTarget({
        prompt: '선택한 블록의 소수 자릿수를 바꿔 줘',
        items,
        selectedKey: 'block-1',
      }),
    ).toEqual({ kind: 'resolved', key: 'block-1' });
  });

  it('clarifies for an unsupported ordinal or signed number instead of falling back', () => {
    expect(
      resolveBlockTarget({
        prompt: '두 번째 차트의 소수 자릿수를 바꿔 줘',
        items,
        selectedKey: 'block-1',
      }),
    ).toEqual({ kind: 'ambiguous', reason: 'unknown-reference', candidates: all });
    expect(
      resolveBlockTarget({ prompt: '첫번째 블록의 제목을 바꿔 줘', items, selectedKey: 'block-2' }),
    ).toEqual({ kind: 'ambiguous', reason: 'unknown-reference', candidates: all });
    expect(
      resolveBlockTarget({ prompt: '마지막 차트의 단위를 바꿔 줘', items, selectedKey: 'block-3' }),
    ).toEqual({ kind: 'ambiguous', reason: 'unknown-reference', candidates: all });
    expect(
      resolveBlockTarget({
        prompt: '-1번 차트의 소수 자릿수를 바꿔 줘',
        items,
        selectedKey: 'block-1',
      }),
    ).toEqual({ kind: 'ambiguous', reason: 'unknown-reference', candidates: all });
    expect(
      resolveBlockTarget({ prompt: '- 2번 차트의 소수 자릿수', items, selectedKey: 'block-3' }),
    ).toEqual({ kind: 'ambiguous', reason: 'unknown-reference', candidates: all });
    expect(
      resolveBlockTarget({ prompt: '1.5번 차트의 소수 자릿수', items, selectedKey: 'block-2' }),
    ).toEqual({ kind: 'ambiguous', reason: 'unknown-reference', candidates: all });
  });

  it('clarifies with the duplicated titles instead of guessing one', () => {
    const duplicated = [
      { key: 'block-1', title: '월별 매출' },
      { key: 'block-2', title: '월별 매출' },
      { key: 'block-3', title: '건수' },
    ];
    expect(
      resolveBlockTarget({
        prompt: '월별 매출 차트의 소수 자릿수를 바꿔 줘',
        items: duplicated,
        selectedKey: 'block-3',
      }),
    ).toEqual({
      kind: 'ambiguous',
      reason: 'multiple-references',
      candidates: [
        { key: 'block-1', title: '월별 매출', position: 1 },
        { key: 'block-2', title: '월별 매출', position: 2 },
      ],
    });
  });

  it('clarifies when one question names several different blocks', () => {
    expect(resolveBlockTarget({ prompt: '2번 차트와 3번 차트를 합쳐 줘', items })).toEqual({
      kind: 'ambiguous',
      reason: 'multiple-references',
      candidates: [
        { key: 'block-2', title: '월별 비용', position: 2 },
        { key: 'block-3', title: '건수', position: 3 },
      ],
    });
  });

  it('uses the current selection only when the question has no reference', () => {
    expect(
      resolveBlockTarget({
        prompt: '제목을 매출 현황으로 바꿔 줘',
        items,
        selectedKey: 'block-2',
      }),
    ).toEqual({ kind: 'resolved', key: 'block-2' });
    expect(
      resolveBlockTarget({ prompt: '소수 2번째 자리로 바꿔 줘', items, selectedKey: 'block-2' }),
    ).toEqual({ kind: 'resolved', key: 'block-2' });
    expect(
      resolveBlockTarget({ prompt: '차트 2개를 합쳐 줘', items, selectedKey: 'block-2' }),
    ).toEqual({ kind: 'ambiguous', reason: 'unknown-reference', candidates: all });
    expect(resolveBlockTarget({ prompt: '제목을 바꿔 줘', items })).toEqual({
      kind: 'ambiguous',
      reason: 'no-selection',
      candidates: all,
    });
    expect(resolveBlockTarget({ prompt: '제목을 바꿔 줘', items, selectedKey: 'foreign' })).toEqual(
      { kind: 'ambiguous', reason: 'no-selection', candidates: all },
    );
  });

  it('confirms only inside the recomputed ambiguous candidates', () => {
    const duplicated = [
      { key: 'block-1', title: '월별 매출' },
      { key: 'block-2', title: '월별 매출' },
      { key: 'block-3', title: '건수' },
    ];
    const duplicatedCandidates = [
      { key: 'block-1', title: '월별 매출', position: 1 },
      { key: 'block-2', title: '월별 매출', position: 2 },
    ];
    expect(
      resolveBlockTarget({
        prompt: '월별 매출 차트의 소수 자릿수를 바꿔 줘',
        items: duplicated,
        targetChoiceKey: 'block-2',
      }),
    ).toEqual({ kind: 'resolved', key: 'block-2' });
    expect(
      resolveBlockTarget({
        prompt: '월별 매출 차트의 소수 자릿수를 바꿔 줘',
        items: duplicated,
        targetChoiceKey: 'block-3',
      }),
    ).toEqual({
      kind: 'ambiguous',
      reason: 'multiple-references',
      candidates: duplicatedCandidates,
    });
    expect(
      resolveBlockTarget({ prompt: '9번 차트의 소수 자릿수', items, targetChoiceKey: 'block-3' }),
    ).toEqual({ kind: 'resolved', key: 'block-3' });
    expect(resolveBlockTarget({ prompt: '제목을 바꿔 줘', items, targetChoiceKey: '' })).toEqual({
      kind: 'ambiguous',
      reason: 'no-selection',
      candidates: all,
    });
  });

  it('never lets a confirmation override a unique explicit target', () => {
    expect(
      resolveBlockTarget({
        prompt: '2번 차트의 소수 자릿수를 바꿔 줘',
        items,
        selectedKey: 'block-1',
        targetChoiceKey: 'block-3',
      }),
    ).toEqual({ kind: 'resolved', key: 'block-2' });
    expect(
      resolveBlockTarget({
        prompt: '건수 차트의 소수 자릿수를 바꿔 줘',
        items,
        targetChoiceKey: 'block-1',
      }),
    ).toEqual({ kind: 'resolved', key: 'block-3' });
  });

  it('clarifies when a quoted exact title matches several blocks', () => {
    const duplicated = [
      { key: 'block-1', title: '월별 매출' },
      { key: 'block-2', title: '월별 매출' },
      { key: 'block-3', title: '건수' },
    ];
    expect(
      resolveBlockTarget({
        prompt: '"월별 매출" 차트의 소수 자릿수를 바꿔 줘',
        items: duplicated,
        selectedKey: 'block-3',
      }),
    ).toEqual({
      kind: 'ambiguous',
      reason: 'multiple-references',
      candidates: [
        { key: 'block-1', title: '월별 매출', position: 1 },
        { key: 'block-2', title: '월별 매출', position: 2 },
      ],
    });
  });

  it('ignores a numbered or ordinal reference inside a quoted new title', () => {
    expect(
      resolveBlockTarget({ prompt: '제목을 "2번 차트"로 바꿔 줘', items, selectedKey: 'block-3' }),
    ).toEqual({ kind: 'resolved', key: 'block-3' });
    expect(resolveBlockTarget({ prompt: '제목을 "2번 차트"로 바꿔 줘', items })).toEqual({
      kind: 'ambiguous',
      reason: 'no-selection',
      candidates: all,
    });
    expect(
      resolveBlockTarget({
        prompt: '제목을 "두 번째 차트"로 바꿔 줘',
        items,
        selectedKey: 'block-1',
      }),
    ).toEqual({ kind: 'resolved', key: 'block-1' });
    expect(
      resolveBlockTarget({ prompt: '-"1번 차트"로 바꿔 줘', items, selectedKey: 'block-2' }),
    ).toEqual({ kind: 'resolved', key: 'block-2' });
  });

  it('offers at most six candidates with their current position', () => {
    const many = Array.from({ length: 8 }, (_, index) => ({
      key: `block-${index + 1}`,
      title: `지표 ${index + 1}`,
    }));
    const result = resolveBlockTarget({ prompt: '제목을 바꿔 줘', items: many });
    expect(MAX_TARGET_CANDIDATES).toBe(6);
    expect(result).toEqual({
      kind: 'ambiguous',
      reason: 'no-selection',
      candidates: [
        { key: 'block-1', title: '지표 1', position: 1 },
        { key: 'block-2', title: '지표 2', position: 2 },
        { key: 'block-3', title: '지표 3', position: 3 },
        { key: 'block-4', title: '지표 4', position: 4 },
        { key: 'block-5', title: '지표 5', position: 5 },
        { key: 'block-6', title: '지표 6', position: 6 },
      ],
    });
  });
});
