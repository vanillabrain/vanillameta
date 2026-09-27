// Vite 환경변수 접근을 한 곳으로 모은다.
// (테스트에서는 jest moduleNameMapper 로 이 모듈을 목으로 대체한다 — import.meta 는 CJS 에서 사용 불가)
export const VITE_API_URL = import.meta.env.VITE_API_URL as string | undefined;
export const VITE_APP_MODE = import.meta.env.VITE_APP_MODE as string | undefined;
export const BASE_URL = import.meta.env.BASE_URL as string;
