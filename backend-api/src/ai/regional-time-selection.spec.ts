import { buildTimeSelection } from './dashboard-time-selection';
it.each([
  ['Asia/Seoul', '2026-01-01', '2025-12-31T15:00:00Z', '2026-01-01T15:00:00Z'],
  ['America/New_York', '2026-03-08', '2026-03-08T05:00:00Z', '2026-03-09T04:00:00Z'],
  ['America/New_York', '2026-11-01', '2026-11-01T04:00:00Z', '2026-11-02T05:00:00Z'],
])('selects %s civil day %s with true duration', (timeZone, day, start, end) => {
  expect(
    buildTimeSelection(
      [start],
      { column: 'time', grain: 'day', format: 'timestamp' },
      { column: 'time', start: day, end: day, timeZone },
    )?.ranges,
  ).toEqual([{ column: 'time', start, end, precision: 'timestamp', timeZone }]);
});
it.each(['week', 'month'] as const)('clips regional %s to applied period', grain => {
  const time = grain === 'week' ? '2025-12-28T15:00:00Z' : '2025-12-31T15:00:00Z';
  expect(
    buildTimeSelection(
      [time],
      { column: 'time', grain, format: 'timestamp' },
      { column: 'time', start: '2026-01-01', end: '2026-01-01', timeZone: 'Asia/Seoul' },
    )?.ranges[0],
  ).toEqual({
    column: 'time',
    start: '2025-12-31T15:00:00Z',
    end: '2026-01-01T15:00:00Z',
    precision: 'timestamp',
    timeZone: 'Asia/Seoul',
  });
});
it('refuses UTC midnight posing as KST bucket start', () => {
  expect(
    buildTimeSelection(
      ['2026-01-01T00:00:00Z'],
      { column: 'time', grain: 'day', format: 'timestamp' },
      { column: 'time', start: '2026-01-01', end: '2026-01-01', timeZone: 'Asia/Seoul' },
    )?.ranges,
  ).toEqual([null]);
});

it('accepts the first instant of a day whose midnight is skipped', () => {
  expect(
    buildTimeSelection(
      ['2018-11-04T03:00:00Z'],
      { column: 'time', grain: 'day', format: 'timestamp' },
      { column: 'time', start: '2018-11-04', end: '2018-11-04', timeZone: 'America/Sao_Paulo' },
    )?.ranges[0],
  ).toEqual({
    column: 'time',
    start: '2018-11-04T03:00:00Z',
    end: '2018-11-05T02:00:00Z',
    precision: 'timestamp',
    timeZone: 'America/Sao_Paulo',
  });
});
it('keeps a regional timestamp selection absolute and clipped', () => {
  expect(
    buildTimeSelection(
      ['2025-12-31T15:00:00Z'],
      { column: 'time', grain: 'day', format: 'timestamp' },
      {
        column: 'time',
        start: '2025-12-31T16:00:00Z',
        end: '2026-01-01T14:00:00Z',
        precision: 'timestamp',
        timeZone: 'Asia/Seoul',
      },
    )?.ranges[0],
  ).toEqual({
    column: 'time',
    start: '2025-12-31T16:00:00Z',
    end: '2026-01-01T14:00:00Z',
    precision: 'timestamp',
    timeZone: 'Asia/Seoul',
  });
});
