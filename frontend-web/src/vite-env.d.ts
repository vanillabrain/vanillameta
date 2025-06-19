/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_MODE: string;
  // 더 많은 환경 변수...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// 하위 호환성을 위한 process.env 타입 정의
declare global {
  interface Window {
    process: {
      env: {
        REACT_APP_API_URL?: string;
        REACT_APP_MODE?: string;
        NODE_ENV: string;
      };
    };
  }
}
