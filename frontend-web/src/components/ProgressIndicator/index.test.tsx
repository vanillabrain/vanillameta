import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProgressIndicator from './index';

describe('ProgressIndicator', () => {
  const defaultProps = {
    current: 1000,
    isStreaming: true,
  };

  it('스트리밍 중일 때 적절한 메시지를 표시해야 함', () => {
    render(<ProgressIndicator {...defaultProps} />);

    expect(screen.getByText('데이터 로딩 중...')).toBeInTheDocument();
    expect(screen.getByText('1,000 행 로드됨')).toBeInTheDocument();
  });

  it('스트리밍이 완료되었을 때 완료 메시지를 표시해야 함', () => {
    render(<ProgressIndicator {...defaultProps} isStreaming={false} />);

    expect(screen.getByText('로딩 완료')).toBeInTheDocument();
  });

  it('전체 개수가 있을 때 진행률을 표시해야 함', () => {
    render(<ProgressIndicator {...defaultProps} total={10000} />);

    expect(screen.getByText('1,000 행 로드됨 / 10,000 행')).toBeInTheDocument();
    expect(screen.getByText('10.0%')).toBeInTheDocument();
  });

  it('percentage가 제공되면 계산된 값 대신 해당 값을 사용해야 함', () => {
    render(<ProgressIndicator {...defaultProps} total={10000} percentage={25} />);

    expect(screen.getByText('25.0%')).toBeInTheDocument();
  });

  it('중지 버튼이 있고 클릭 시 onStop 콜백이 호출되어야 함', () => {
    const onStopMock = jest.fn();
    render(<ProgressIndicator {...defaultProps} onStop={onStopMock} />);

    const stopButton = screen.getByRole('button');
    fireEvent.click(stopButton);

    expect(onStopMock).toHaveBeenCalled();
  });

  it('스트리밍 중이 아닐 때는 중지 버튼이 표시되지 않아야 함', () => {
    const onStopMock = jest.fn();
    render(<ProgressIndicator {...defaultProps} isStreaming={false} onStop={onStopMock} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('메시지가 제공되면 추가 메시지를 표시해야 함', () => {
    render(<ProgressIndicator {...defaultProps} message="처리 중: 50%" />);

    expect(screen.getByText('처리 중: 50%')).toBeInTheDocument();
  });

  it('전체 개수가 없을 때 indeterminate 프로그레스바를 표시해야 함', () => {
    const { container } = render(<ProgressIndicator {...defaultProps} />);

    const progressBar = container.querySelector('.MuiLinearProgress-indeterminate');
    expect(progressBar).toBeInTheDocument();
  });

  it('전체 개수가 있을 때 determinate 프로그레스바를 표시해야 함', () => {
    const { container } = render(<ProgressIndicator {...defaultProps} total={10000} />);

    const progressBar = container.querySelector('.MuiLinearProgress-determinate');
    expect(progressBar).toBeInTheDocument();
  });

  it('진행률이 100%를 초과하지 않아야 함', () => {
    const { container } = render(<ProgressIndicator current={11000} total={10000} isStreaming={true} />);

    // Progress bar should be at 100%
    const progressBar = container.querySelector('[aria-valuenow="100"]');
    expect(progressBar).toBeInTheDocument();

    // But text should show actual value
    expect(screen.getByText('11,000 행 로드됨 / 10,000 행')).toBeInTheDocument();
  });
});
