import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import LazyImage from './index';

// react-intersection-observer 모킹
const mockInView = jest.fn();
jest.mock('react-intersection-observer', () => ({
  useInView: () => ({
    ref: jest.fn(),
    inView: mockInView(),
  }),
}));

describe('LazyImage 컴포넌트', () => {
  const defaultProps = {
    src: 'https://example.com/image.jpg',
    alt: '테스트 이미지',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockInView.mockReturnValue(false); // 기본값: 뷰포트 밖
  });

  it('컴포넌트가 정상적으로 렌더링되어야 함', () => {
    const { container } = render(<LazyImage {...defaultProps} />);
    
    // 컨테이너가 렌더링되어야 함
    expect(container.firstChild).toBeInTheDocument();
  });

  it('뷰포트에 진입하면 이미지를 로드해야 함', async () => {
    mockInView.mockReturnValue(true); // 뷰포트 진입
    
    render(<LazyImage {...defaultProps} />);
    
    // 이미지가 렌더링되어야 함
    const image = screen.getByAltText('테스트 이미지');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', defaultProps.src);
  });

  it('이미지 로드 완료 시 onLoad 콜백이 호출되어야 함', async () => {
    mockInView.mockReturnValue(true);
    const onLoadMock = jest.fn();
    
    render(<LazyImage {...defaultProps} onLoad={onLoadMock} />);
    
    const image = screen.getByAltText('테스트 이미지');
    
    // 이미지 로드 이벤트 발생
    fireEvent.load(image);
    
    await waitFor(() => {
      expect(onLoadMock).toHaveBeenCalledTimes(1);
    });
  });

  it('이미지 로드 실패 시 fallback 이미지를 표시해야 함', async () => {
    mockInView.mockReturnValue(true);
    const fallbackSrc = 'https://example.com/fallback.jpg';
    const onErrorMock = jest.fn();
    
    render(
      <LazyImage 
        {...defaultProps} 
        fallbackSrc={fallbackSrc}
        onError={onErrorMock}
      />
    );
    
    const image = screen.getByAltText('테스트 이미지');
    
    // 이미지 로드 에러 이벤트 발생
    fireEvent.error(image);
    
    await waitFor(() => {
      expect(onErrorMock).toHaveBeenCalledTimes(1);
      expect(image).toHaveAttribute('src', fallbackSrc);
    });
  });

  it('placeholder 이미지가 제공되면 스켈레톤 대신 표시되어야 함', () => {
    const placeholderSrc = 'https://example.com/placeholder.jpg';
    
    render(<LazyImage {...defaultProps} placeholder={placeholderSrc} />);
    
    const placeholder = screen.getByAltText('테스트 이미지 placeholder');
    expect(placeholder).toBeInTheDocument();
    expect(placeholder).toHaveAttribute('src', placeholderSrc);
  });

  it('커스텀 스타일이 적용되어야 함', () => {
    const customStyle = {
      border: '2px solid red',
    };
    
    const { container } = render(
      <LazyImage 
        {...defaultProps} 
        style={customStyle}
        width={300}
        height={200}
        borderRadius={8}
      />
    );
    
    const imageContainer = container.firstChild;
    expect(imageContainer).toHaveStyle({
      width: '300px',
      height: '200px',
      borderRadius: '8px',
    });
  });

  it('objectFit 속성이 올바르게 적용되어야 함', () => {
    mockInView.mockReturnValue(true);
    
    render(<LazyImage {...defaultProps} objectFit="cover" />);
    
    const image = screen.getByAltText('테스트 이미지');
    expect(image).toHaveStyle({ objectFit: 'cover' });
  });

  it('className이 컨테이너에 적용되어야 함', () => {
    const className = 'custom-image-class';
    
    const { container } = render(
      <LazyImage {...defaultProps} className={className} />
    );
    
    const imageContainer = container.firstChild;
    expect(imageContainer).toHaveClass(className);
  });

  it('threshold와 rootMargin이 설정되어야 함', () => {
    const useInViewSpy = jest.requireMock('react-intersection-observer').useInView;
    
    render(
      <LazyImage 
        {...defaultProps} 
        threshold={0.5}
        rootMargin="100px"
      />
    );
    
    expect(useInViewSpy).toHaveBeenCalledWith({
      threshold: 0.5,
      rootMargin: '100px',
      triggerOnce: true,
    });
  });
});