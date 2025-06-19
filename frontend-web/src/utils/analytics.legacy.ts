// Google Analytics 설정 및 초기화

interface GtagConfig {
  page_path?: string;
  [key: string]: any;
}

// Google Analytics 초기화
export const initializeGA = (measurementId: string) => {
  if (!measurementId || typeof window === 'undefined') {
    console.warn('Google Analytics measurement ID not provided or not in browser environment');
    return;
  }

  // gtag 스크립트 동적 로드
  const script1 = document.createElement('script');
  script1.async = true;
  script1.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script1);

  // gtag 초기화
  const script2 = document.createElement('script');
  script2.innerHTML = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${measurementId}', {
      send_page_view: false,
      anonymize_ip: true
    });
  `;
  document.head.appendChild(script2);

  console.log('Google Analytics initialized with ID:', measurementId);
};

// 페이지뷰 추적
export const trackPageView = (url: string) => {
  if (!window.gtag) return;

  window.gtag('config', process.env.REACT_APP_GA_MEASUREMENT_ID!, {
    page_path: url,
  });
};

// 이벤트 추적
export const trackEvent = (action: string, category: string, label?: string, value?: number) => {
  if (!window.gtag) return;

  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
  });
};

// 사용자 타이밍 추적
export const trackTiming = (name: string, value: number, category = 'performance', label?: string) => {
  if (!window.gtag) return;

  window.gtag('event', 'timing_complete', {
    name,
    value: Math.round(value),
    event_category: category,
    event_label: label,
  });
};

// 예외 추적
export const trackException = (description: string, fatal = false) => {
  if (!window.gtag) return;

  window.gtag('event', 'exception', {
    description,
    fatal,
  });
};

// 커스텀 차원 설정
export const setCustomDimension = (dimensionName: string, value: string) => {
  if (!window.gtag) return;

  window.gtag('config', process.env.REACT_APP_GA_MEASUREMENT_ID!, {
    custom_map: {
      [dimensionName]: value,
    },
  });
};

// 성능 메트릭 배치 전송
export const sendPerformanceMetrics = (
  metrics: Array<{
    name: string;
    value: number;
    category?: string;
  }>,
) => {
  if (!window.gtag || metrics.length === 0) return;

  // 배치로 이벤트 전송
  metrics.forEach(metric => {
    window.gtag('event', 'performance_metric', {
      metric_name: metric.name,
      value: Math.round(metric.value),
      event_category: metric.category || 'performance',
    });
  });
};

// 타입 선언
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}
