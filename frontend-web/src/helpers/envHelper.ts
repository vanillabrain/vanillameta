/**
 * 환경 변수 헬퍼 함수들
 * React 앱에서 환경 변수를 안전하게 사용하기 위한 유틸리티
 */

/**
 * API URL 가져오기
 * @returns API 서버 URL
 */
export const getApiUrl = (): string => {
  return process.env.REACT_APP_API_URL || 'http://localhost:3000';
};

/**
 * 현재 실행 모드 가져오기
 * @returns 'dev' | 'prod' | 'local'
 */
export const getAppMode = (): string => {
  return process.env.REACT_APP_MODE || 'local';
};

/**
 * 개발 환경인지 확인
 * @returns 개발 환경 여부
 */
export const isDevelopment = (): boolean => {
  return process.env.NODE_ENV === 'development' || getAppMode() === 'dev';
};

/**
 * 프로덕션 환경인지 확인
 * @returns 프로덕션 환경 여부
 */
export const isProduction = (): boolean => {
  return process.env.NODE_ENV === 'production' || getAppMode() === 'prod';
};

/**
 * 로컬 환경인지 확인
 * @returns 로컬 환경 여부
 */
export const isLocal = (): boolean => {
  return getAppMode() === 'local';
};

/**
 * 환경 변수 값 가져오기
 * @param key - 환경 변수 키
 * @param defaultValue - 기본값
 * @returns 환경 변수 값
 */
export const getEnvVar = (key: string, defaultValue = ''): string => {
  return process.env[key] || defaultValue;
};

/**
 * 환경 설정 정보 가져오기
 * @returns 환경 설정 객체
 */
export const getEnvConfig = () => {
  return {
    apiUrl: getApiUrl(),
    mode: getAppMode(),
    isDevelopment: isDevelopment(),
    isProduction: isProduction(),
    isLocal: isLocal(),
    nodeEnv: process.env.NODE_ENV,
    // 추가적인 환경 변수들을 여기에 추가
    googleAnalyticsId: process.env.REACT_APP_GA_ID,
    sentryDsn: process.env.REACT_APP_SENTRY_DSN,
  };
};

/**
 * 디버그 모드 확인
 * @returns 디버그 모드 여부
 */
export const isDebugMode = (): boolean => {
  return process.env.REACT_APP_DEBUG === 'true';
};

/**
 * 환경별 로그 출력 헬퍼
 * @param message - 로그 메시지
 * @param level - 로그 레벨
 */
export const envLog = (message: string, ...args: any[]): void => {
  if (!isProduction() || isDebugMode()) {
    console.log(`[${getAppMode()}] ${message}`, ...args);
  }
};
