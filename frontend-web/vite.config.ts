import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 기본 mode가 'local'인 경우 'development'로 변경
  const actualMode = mode === 'local' ? 'development' : mode;
  
  // 환경 변수 로드
  const env = loadEnv(actualMode, process.cwd(), '');
  
  return {
    plugins: [
      react({
        // React Fast Refresh 설정
        fastRefresh: true,
        // emotion 사용을 위한 설정
        jsxImportSource: '@emotion/react',
        babel: {
          plugins: ['@emotion/babel-plugin']
        }
      }),
      // SVG를 React 컴포넌트로 import
      svgr(),
      // tsconfig.json의 paths 설정 사용
      tsconfigPaths(),
      // 번들 분석 (build 시에만)
      mode === 'production' && visualizer({
        filename: './dist/stats.html',
        open: true,
        gzipSize: true
      })
    ].filter(Boolean),
    
    // 절대 경로 설정
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@components': path.resolve(__dirname, 'src/components'),
        '@pages': path.resolve(__dirname, 'src/pages'),
        '@api': path.resolve(__dirname, 'src/api'),
        '@utils': path.resolve(__dirname, 'src/utils'),
        '@hooks': path.resolve(__dirname, 'src/hooks'),
        '@assets': path.resolve(__dirname, 'src/assets'),
        '@theme': path.resolve(__dirname, 'src/theme'),
        '@contexts': path.resolve(__dirname, 'src/contexts'),
        '@router': path.resolve(__dirname, 'src/router'),
        '@layouts': path.resolve(__dirname, 'src/layouts'),
        '@helpers': path.resolve(__dirname, 'src/helpers'),
        '@widget': path.resolve(__dirname, 'src/widget'),
        '@data': path.resolve(__dirname, 'src/data'),
        '@types': path.resolve(__dirname, 'src/types'),
        '@seo': path.resolve(__dirname, 'src/seo'),
        '@constant': path.resolve(__dirname, 'src/constant')
      }
    },
    
    // 개발 서버 설정
    server: {
      port: 3000,
      open: true,
      cors: true,
      // 프록시 설정 (API 서버로의 요청 프록시)
      proxy: {
        '/api': {
          target: env.VITE_API_URL || env.REACT_APP_API_URL || 'http://localhost:4000',
          changeOrigin: true,
          secure: false
        }
      }
    },
    
    // 환경 변수 설정
    define: {
      // process.env를 import.meta.env로 변환
      'process.env.REACT_APP_API_URL': JSON.stringify(env.VITE_API_URL || env.REACT_APP_API_URL),
      'process.env.REACT_APP_MODE': JSON.stringify(env.VITE_MODE || env.REACT_APP_MODE || actualMode),
      'process.env.NODE_ENV': JSON.stringify(actualMode)
    },
    
    // Public 디렉토리 설정
    publicDir: 'public',
    
    // 빌드 설정
    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
      // 트리 쉐이킹 최적화
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
          drop_debugger: mode === 'production'
        }
      },
      // 코드 스플리팅 설정
      rollupOptions: {
        output: {
          manualChunks: {
            // 핵심 라이브러리
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'mui-vendor': ['@mui/material', '@mui/icons-material', '@mui/lab'],
            // Radix UI 컴포넌트 (shadcn/ui)
            'radix-ui': [
              '@radix-ui/react-alert-dialog',
              '@radix-ui/react-avatar',
              '@radix-ui/react-checkbox',
              '@radix-ui/react-collapsible',
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-label',
              '@radix-ui/react-popover',
              '@radix-ui/react-progress',
              '@radix-ui/react-radio-group',
              '@radix-ui/react-scroll-area',
              '@radix-ui/react-select',
              '@radix-ui/react-separator',
              '@radix-ui/react-slot',
              '@radix-ui/react-switch',
              '@radix-ui/react-tabs',
              '@radix-ui/react-toggle',
              '@radix-ui/react-tooltip'
            ],
            // ECharts 기본과 3D 분리
            'echarts-core': ['echarts', 'echarts-for-react'],
            'echarts-gl': ['echarts-gl'],
            // 코드 에디터 분리 (대용량)
            'ace-editor': ['ace-builds', 'react-ace'],
            // 레이아웃 관련
            'grid-layout': ['react-grid-layout'],
            // 국제화
            'i18n': ['i18next', 'i18next-browser-languagedetector', 'i18next-http-backend', 'react-i18next'],
            // 수학 유틸리티 (특정 차트에서만 사용)
            'math-utils': ['mathjs'],
            // 기타 유틸리티
            'utils': ['lodash', 'lodash-es', 'axios', 'dayjs'],
            // Tanstack Query
            'tanstack-query': ['@tanstack/react-query']
          }
        }
      },
      // 청크 크기 경고 임계값 감소
      chunkSizeWarningLimit: 500
    },
    
    // 최적화 설정
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@mui/material',
        '@mui/icons-material',
        'echarts',
        'echarts-for-react',
        'axios',
        'lodash',
        'dayjs',
        'i18next',
        'react-i18next',
        'mathjs',
        'complex.js'
      ],
      // 대용량 라이브러리는 제외 (레이지 로드를 위해)
      exclude: ['ace-builds', 'echarts-gl']
    },
    
    // CSS 설정
    css: {
      modules: {
        localsConvention: 'camelCase'
      }
    }
  };
});