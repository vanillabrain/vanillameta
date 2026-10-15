import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { defineConfig } from 'vite';

// 랜딩 페이지는 frontend-web이 소유한 실제 shadcn 프리미티브와 의존성을 그대로 공유한다.
// npm ci로 선언된 의존성을 설치하며 src/components/ui, src/lib/utils를 공유한다.
const frontendWebSrc = path.resolve(import.meta.dirname, '../frontend-web/src');

export default defineConfig({
  root: import.meta.dirname,
  // 앱과 별도로 최적화 캐시를 관리한다.
  cacheDir: path.resolve(import.meta.dirname, '.vite'),
  plugins: [react(), tailwindcss()],
  resolve: {
    // 공유 소스의 React도 랜딩의 단일 React 인스턴스로 해석한다.
    preserveSymlinks: true,
    dedupe: ['react', 'react-dom'],
    alias: {
      '@/components/ui': path.resolve(frontendWebSrc, 'components/ui'),
      '@/lib/utils': path.resolve(frontendWebSrc, 'lib/utils'),
    },
  },
  server: {
    port: 3100,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
