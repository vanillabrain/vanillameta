import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import GlobalErrorBoundary from '../GlobalErrorBoundary';
import { ErrorProvider } from '@/contexts/ErrorContext';
import { AlertProvider } from '@/contexts/AlertContext';

// 테스트용 에러를 발생시키는 컴포넌트
const ErrorThrowingComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

// 테스트용 Provider 래퍼
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <BrowserRouter>
      <AlertProvider>
        <ErrorProvider>{children}</ErrorProvider>
      </AlertProvider>
    </BrowserRouter>
  );
};

describe('ErrorBoundary Tests', () => {
  // 콘솔 에러를 억제하기 위한 설정
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalError;
  });

  test('에러가 발생하지 않을 때 정상적으로 children을 렌더링해야 한다', () => {
    render(
      <TestWrapper>
        <GlobalErrorBoundary>
          <ErrorThrowingComponent shouldThrow={false} />
        </GlobalErrorBoundary>
      </TestWrapper>,
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  test('에러가 발생했을 때 에러 UI를 표시해야 한다', () => {
    render(
      <TestWrapper>
        <GlobalErrorBoundary>
          <ErrorThrowingComponent shouldThrow={true} />
        </GlobalErrorBoundary>
      </TestWrapper>,
    );

    expect(screen.getByText(/예상치 못한 오류/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /다시 시도/ })).toBeInTheDocument();
  });

  test('다시 시도 버튼을 클릭했을 때 에러 상태가 리셋되어야 한다', () => {
    const { rerender } = render(
      <TestWrapper>
        <GlobalErrorBoundary>
          <ErrorThrowingComponent shouldThrow={true} />
        </GlobalErrorBoundary>
      </TestWrapper>,
    );

    // 에러 UI가 표시되는지 확인
    expect(screen.getByText(/예상치 못한 오류/)).toBeInTheDocument();

    // 다시 시도 버튼 클릭
    const retryButton = screen.getByRole('button', { name: /다시 시도/ });
    fireEvent.click(retryButton);

    // 에러를 발생시키지 않는 컴포넌트로 다시 렌더링
    rerender(
      <TestWrapper>
        <GlobalErrorBoundary>
          <ErrorThrowingComponent shouldThrow={false} />
        </GlobalErrorBoundary>
      </TestWrapper>,
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  test('청크 로딩 에러 타입을 올바르게 인식해야 한다', () => {
    const ChunkErrorComponent = () => {
      throw new Error('Loading chunk 123 failed');
    };

    render(
      <TestWrapper>
        <GlobalErrorBoundary>
          <ChunkErrorComponent />
        </GlobalErrorBoundary>
      </TestWrapper>,
    );

    expect(screen.getByText(/페이지 로딩 오류/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /페이지 새로고침/ })).toBeInTheDocument();
  });

  test('기술적 세부사항을 토글할 수 있어야 한다', () => {
    render(
      <TestWrapper>
        <GlobalErrorBoundary>
          <ErrorThrowingComponent shouldThrow={true} />
        </GlobalErrorBoundary>
      </TestWrapper>,
    );

    // 기술적 세부사항 버튼 찾기
    const detailsButton = screen.getByRole('button', { name: /기술적 세부사항/ });
    expect(detailsButton).toBeInTheDocument();

    // 클릭하여 세부사항 표시
    fireEvent.click(detailsButton);

    // 세부사항이 표시되는지 확인
    expect(screen.getByText(/오류 정보:/)).toBeInTheDocument();
    expect(screen.getByText(/Test error/)).toBeInTheDocument();
  });

  test('커스텀 fallback이 제공되었을 때 해당 fallback을 표시해야 한다', () => {
    const customFallback = <div>Custom error fallback</div>;

    render(
      <TestWrapper>
        <GlobalErrorBoundary fallback={customFallback}>
          <ErrorThrowingComponent shouldThrow={true} />
        </GlobalErrorBoundary>
      </TestWrapper>,
    );

    expect(screen.getByText('Custom error fallback')).toBeInTheDocument();
  });
});
