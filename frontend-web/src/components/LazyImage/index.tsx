import React, { useState, useRef } from 'react';
import { useInView } from 'react-intersection-observer';
import { Box, Skeleton } from '@mui/material';
import { styled } from '@mui/material/styles';

interface LazyImageProps {
  src: string;
  alt: string;
  width?: string | number;
  height?: string | number;
  placeholder?: string;
  fallbackSrc?: string;
  style?: React.CSSProperties;
  className?: string;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  borderRadius?: string | number;
  onLoad?: () => void;
  onError?: () => void;
  threshold?: number;
  rootMargin?: string;
}

const ImageContainer = styled(Box)(() => ({
  position: 'relative',
  overflow: 'hidden',
  display: 'inline-block',
}));

const Image = styled('img')(() => ({
  transition: 'opacity 0.3s ease-in-out',
  maxWidth: '100%',
  height: 'auto',
}));

const PlaceholderContainer = styled(Box)(() => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#f5f5f5',
}));

/**
 * LazyImage 컴포넌트
 *
 * Intersection Observer API를 활용하여 뷰포트에 진입할 때만 이미지를 로드합니다.
 * 로딩 중에는 스켈레톤 UI를 표시하고, 에러 시에는 fallback 이미지를 보여줍니다.
 *
 * @param src - 이미지 소스 URL
 * @param alt - 이미지 대체 텍스트
 * @param width - 이미지 너비
 * @param height - 이미지 높이
 * @param placeholder - 로딩 중 표시할 placeholder 이미지
 * @param fallbackSrc - 로드 실패 시 표시할 fallback 이미지
 * @param style - 추가 스타일
 * @param className - CSS 클래스명
 * @param objectFit - 이미지 object-fit 속성
 * @param borderRadius - 테두리 둥글기
 * @param onLoad - 이미지 로드 완료 콜백
 * @param onError - 이미지 로드 실패 콜백
 * @param threshold - Intersection Observer 임계값 (기본값: 0.1)
 * @param rootMargin - Intersection Observer 루트 마진 (기본값: '50px')
 */
const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  width = 'auto',
  height = 'auto',
  placeholder,
  fallbackSrc,
  style,
  className,
  objectFit = 'contain',
  borderRadius = 0,
  onLoad,
  onError,
  threshold = 0.1,
  rootMargin = '50px',
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageSrc, setImageSrc] = useState<string>('');
  const imageRef = useRef<HTMLImageElement>(null);

  // Intersection Observer로 뷰포트 진입 감지
  const { ref, inView } = useInView({
    threshold,
    rootMargin,
    triggerOnce: true, // 한 번만 실행
  });

  // 뷰포트에 진입했을 때 이미지 소스 설정
  React.useEffect(() => {
    if (inView && !imageSrc && !imageError) {
      setImageSrc(src);
    }
  }, [inView, src, imageSrc, imageError]);

  // 이미지 로드 완료 핸들러
  const handleImageLoad = () => {
    setImageLoaded(true);
    onLoad?.();
  };

  // 이미지 로드 실패 핸들러
  const handleImageError = () => {
    setImageError(true);
    if (fallbackSrc) {
      setImageSrc(fallbackSrc);
      setImageError(false); // fallback 이미지 시도
    }
    onError?.();
  };

  const containerStyle: React.CSSProperties = {
    width,
    height,
    borderRadius,
    ...style,
  };

  const imageStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit,
    opacity: imageLoaded ? 1 : 0,
  };

  return (
    <ImageContainer ref={ref} className={className} sx={containerStyle}>
      {/* 이미지가 로드되면 표시 */}
      {imageSrc && (
        <Image
          ref={imageRef}
          src={imageSrc}
          alt={alt}
          style={imageStyle}
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
      )}

      {/* 로딩 중이거나 뷰포트에 진입하지 않았을 때 스켈레톤 표시 */}
      {(!inView || (!imageLoaded && !imageError)) && (
        <PlaceholderContainer>
          {placeholder ? (
            <img
              src={placeholder}
              alt={`${alt} placeholder`}
              style={{
                width: '100%',
                height: '100%',
                objectFit,
                filter: 'blur(5px)',
                opacity: 0.6,
              }}
            />
          ) : (
            <Skeleton variant="rectangular" width="100%" height="100%" sx={{ borderRadius }} />
          )}
        </PlaceholderContainer>
      )}
    </ImageContainer>
  );
};

export default LazyImage;
