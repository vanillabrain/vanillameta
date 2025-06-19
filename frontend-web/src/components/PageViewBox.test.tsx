import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import PageViewBox from './PageViewBox';
import { LayoutContext } from '@/contexts/LayoutContext';

// LayoutContext 모킹
const mockChangeFooterBg = jest.fn();
const mockFixLayout = jest.fn();
const mockLayoutContext = {
  changeFooterBg: mockChangeFooterBg,
  footerBg: null,
  fixed: false,
  fixLayout: mockFixLayout,
};

// 테스트를 위한 테마 생성
const theme = createTheme();

// 컴포넌트 렌더링 헬퍼
const renderWithProviders = (component: React.ReactElement, options = {}) => {
  const { isMobile = false } = options as any;

  // 미디어 쿼리 모킹
  (theme.breakpoints.up as jest.Mock) = jest.fn(() => {
    return isMobile ? '(min-width:600px)' : '(min-width:0px)';
  });

  // matchMedia 모킹
  window.matchMedia = jest.fn().mockImplementation(query => ({
    matches: isMobile ? false : true,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(), // 구버전 API 호환성
    removeListener: jest.fn(), // 구버전 API 호환성
    dispatchEvent: jest.fn(),
  }));

  return render(
    <ThemeProvider theme={theme}>
      <LayoutContext.Provider value={mockLayoutContext}>{component}</LayoutContext.Provider>
    </ThemeProvider>,
  );
};

describe('PageViewBox 컴포넌트', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('데스크톱 뷰', () => {
    it('기본 속성으로 렌더링되어야 함', () => {
      renderWithProviders(<PageViewBox title="테스트 제목" />);

      expect(screen.getByText('테스트 제목')).toBeInTheDocument();
    });

    it('아이콘이 표시되어야 함', () => {
      renderWithProviders(<PageViewBox title="테스트 제목" iconName="test-icon.png" />);

      const avatar = screen.getByRole('img');
      expect(avatar).toHaveAttribute('src', '/static/images/test-icon.png');
    });

    it('날짜가 표시되어야 함', () => {
      renderWithProviders(<PageViewBox title="테스트 제목" date="2024-01-01" />);

      expect(screen.getByText('2024-01-01')).toBeInTheDocument();
    });

    it('버튼이 표시되어야 함', () => {
      const TestButton = <button>테스트 버튼</button>;

      renderWithProviders(<PageViewBox title="테스트 제목" button={TestButton} />);

      expect(screen.getByText('테스트 버튼')).toBeInTheDocument();
    });

    it('titleElement가 title보다 우선되어야 함', () => {
      const TitleElement = <h1>커스텀 타이틀</h1>;

      renderWithProviders(<PageViewBox title="테스트 제목" titleElement={TitleElement} />);

      expect(screen.getByText('커스텀 타이틀')).toBeInTheDocument();
      expect(screen.queryByText('테스트 제목')).not.toBeInTheDocument();
    });

    it('자식 컴포넌트가 렌더링되어야 함', () => {
      renderWithProviders(
        <PageViewBox title="테스트 제목">
          <div>자식 컴포넌트</div>
        </PageViewBox>,
      );

      expect(screen.getByText('자식 컴포넌트')).toBeInTheDocument();
    });

    it('커스텀 스타일이 적용되어야 함', () => {
      const customSx = { backgroundColor: 'red' };

      const { container } = renderWithProviders(<PageViewBox title="테스트 제목" sx={customSx} />);

      // 스타일이 적용된 Box 찾기
      const styledBox = container.querySelector('[class*="MuiBox-root"]');
      expect(styledBox).toBeInTheDocument();
    });
  });

  describe('모바일 뷰', () => {
    it('모바일에서 정상적으로 렌더링되어야 함', () => {
      renderWithProviders(<PageViewBox title="테스트 제목" />, { isMobile: true });

      expect(screen.getByText('테스트 제목')).toBeInTheDocument();
    });

    it('모바일에서 수정일 텍스트가 포함되어야 함', () => {
      renderWithProviders(<PageViewBox title="테스트 제목" date="2024-01-01" />, { isMobile: true });

      expect(screen.getByText('수정일: 2024-01-01')).toBeInTheDocument();
    });

    it('모바일에서 changeFooterBg가 호출되어야 함', () => {
      renderWithProviders(<PageViewBox title="테스트 제목" />, { isMobile: true });

      expect(mockChangeFooterBg).toHaveBeenCalledWith('#f9f9fa');
    });

    it('모바일에서 언마운트 시 changeFooterBg가 null로 호출되어야 함', () => {
      const { unmount } = renderWithProviders(<PageViewBox title="테스트 제목" />, { isMobile: true });

      unmount();

      expect(mockChangeFooterBg).toHaveBeenCalledWith(null);
    });

    it('모바일에서 아이콘이 표시되어야 함', () => {
      renderWithProviders(<PageViewBox title="테스트 제목" iconName="mobile-icon.png" />, { isMobile: true });

      const avatar = screen.getByRole('img');
      expect(avatar).toHaveAttribute('src', '/static/images/mobile-icon.png');
    });

    it('모바일에서 긴 제목이 줄바꿈되어야 함', () => {
      const longTitle =
        '매우 긴 제목입니다. 이 제목은 여러 줄에 걸쳐 표시되어야 하며, 최대 3줄까지만 표시되고 나머지는 말줄임표로 처리됩니다.';

      renderWithProviders(<PageViewBox title={longTitle} />, { isMobile: true });

      const titleElement = screen.getByText(longTitle);
      expect(titleElement).toHaveStyle({
        display: '-webkit-box',
        WebkitLineClamp: '3',
        overflow: 'hidden',
      });
    });
  });

  describe('props 전달', () => {
    it('모든 props가 올바르게 전달되어야 함', () => {
      const allProps = {
        iconName: 'icon.png',
        title: '전체 테스트',
        date: '2024-01-01',
        button: <button>버튼</button>,
        sx: { padding: '10px' },
      };

      renderWithProviders(
        <PageViewBox {...allProps}>
          <div>내용</div>
        </PageViewBox>,
      );

      expect(screen.getByText('전체 테스트')).toBeInTheDocument();
      expect(screen.getByText('2024-01-01')).toBeInTheDocument();
      expect(screen.getByText('버튼')).toBeInTheDocument();
      expect(screen.getByText('내용')).toBeInTheDocument();
    });
  });
});
