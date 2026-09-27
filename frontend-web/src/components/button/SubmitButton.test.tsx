import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import SubmitButton from './SubmitButton';

describe('SubmitButton', () => {
  it('label 을 렌더링한다', () => {
    render(<SubmitButton label="저장" />);
    expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument();
  });

  it('클릭 시 onClick 을 호출한다', () => {
    const onClick = jest.fn();
    render(<SubmitButton label="저장" onClick={onClick} />);

    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
