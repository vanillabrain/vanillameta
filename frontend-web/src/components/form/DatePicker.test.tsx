import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DatePicker from './DatePicker';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

function Harness({ initial = null }: { initial?: string | null }) {
  const [date, setDate] = React.useState(initial);
  return (
    <>
      <DatePicker shareLimitDate={date} setShareLimitDate={setDate} />
      <output data-testid="saved-date">{date}</output>
    </>
  );
}

afterEach(cleanup);

describe('share expiry picker', () => {
  it('selects a calendar date without crashing when saved string state rerenders', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'share.openCalendar' }));
    const today = new Date().getDate().toString();
    const selectedDay = screen
      .getAllByRole('gridcell')
      .find(cell => cell.textContent === today && !cell.hasAttribute('disabled'));
    expect(selectedDay).toBeDefined();
    if (!selectedDay) throw new Error('Current calendar day is missing');
    fireEvent.click(selectedDay);
    expect(screen.getByTestId('saved-date').textContent).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it('loads the dotted date returned by dashboard reload', () => {
    render(<Harness initial="2030.12.31" />);
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('2030.12.31.');
  });
});
