import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    // CRA 호환: import { ReactComponent as X } from '*.svg'
    svgr(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  // CRA 환경변수(REACT_APP_*)를 그대로 사용
  envPrefix: 'REACT_APP_',
  server: {
    port: 3000,
  },
  build: {
    outDir: 'build',
    // echarts 등 대용량 차트 라이브러리 번들 경고 임계치
    chunkSizeWarningLimit: 2000,
  },
  css: {
    lightningcss: {
      // react-grid-layout 등 구형 CSS의 IE star hack(*margin 등)을 strip하고 빌드 계속 진행
      errorRecovery: true,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: ['**/node_modules/**', 'e2e/**', 'qa/**'],
  },
});
