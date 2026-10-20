import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import dayjs from 'dayjs';
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
  it('stores a picked day in the saved MM/DD/YYYY format', () => {
    render(<Harness />);
    const input = screen.getByLabelText('share.expiry') as HTMLInputElement;
    expect(input.type).toBe('date');
    expect(input.min).toBe(dayjs().format('YYYY-MM-DD'));
    fireEvent.change(input, { target: { value: '2031-01-05' } });
    expect(screen.getByTestId('saved-date').textContent).toBe('01/05/2031');
    expect(input.value).toBe('2031-01-05');
  });

  it('keeps past days out of the saved state', () => {
    render(<Harness />);
    const input = screen.getByLabelText('share.expiry') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2001-01-05' } });
    expect(screen.getByTestId('saved-date').textContent).toBe('');
  });

  it('clears the saved state when the day is removed', () => {
    render(<Harness initial="12/31/2030" />);
    const input = screen.getByLabelText('share.expiry') as HTMLInputElement;
    expect(input.value).toBe('2030-12-31');
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByTestId('saved-date').textContent).toBe('');
  });

  it('loads the dotted date returned by dashboard reload', () => {
    render(<Harness initial="2030.12.31" />);
    expect((screen.getByLabelText('share.expiry') as HTMLInputElement).value).toBe('2030-12-31');
  });
});
