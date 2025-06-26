/** @type {import('next').NextConfig} */
const nextConfig = {
  // React Strict Mode 활성화
  reactStrictMode: true,
  
  // SWC 컴파일러 사용 (기본값)
  swcMinify: true,
  
  // 이미지 최적화 설정
  images: {
    domains: ['localhost', 'vanillameta.com'],
    formats: ['image/avif', 'image/webp'],
  },
  
  // 환경 변수 설정
  env: {
    // 클라이언트 사이드에서 사용할 환경 변수
  },
  
  // 웹팩 설정 커스터마이징
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // SVG 파일을 React 컴포넌트로 import
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });
    
    return config;
  },
  
  // 실험적 기능
  experimental: {
    // 서버 액션 활성화
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
  
  // 리다이렉트 설정
  async redirects() {
    return [
      // 필요한 리다이렉트 규칙 추가
    ];
  },
  
  // 리라이트 설정 (API 프록시)
  async rewrites() {
    return [
      // API 프록시 설정
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/:path*`,
      },
    ];
  },
  
  // 헤더 설정
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
  
  // 빌드 출력 디렉토리
  distDir: '.next',
  
  // TypeScript 설정
  typescript: {
    // 빌드 시 TypeScript 에러 무시 (개발 중에만 사용)
    ignoreBuildErrors: false,
  },
  
  // ESLint 설정
  eslint: {
    // 빌드 시 ESLint 에러 무시 (개발 중에만 사용)
    ignoreDuringBuilds: false,
  },
};

module.exports = nextConfig;