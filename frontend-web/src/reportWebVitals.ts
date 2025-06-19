import { onCLS, onFCP, onLCP, onTTFB, onINP, Metric } from 'web-vitals';

interface PerformanceData {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  id: string;
  navigationType: string;
  timestamp: number;
}

// 성능 데이터를 수집하는 배열
const performanceBuffer: PerformanceData[] = [];
const BUFFER_SIZE = 20; // 배치 전송할 데이터 개수
const FLUSH_INTERVAL = 30000; // 30초마다 전송

// 프로덕션 환경인지 확인
const isProduction = process.env.NODE_ENV === 'production';

// 성능 데이터를 외부 서비스로 전송하는 함수
const sendToAnalytics = async (metrics: PerformanceData[]) => {
  if (metrics.length === 0) return;

  try {
    // Google Analytics로 전송 (GA4 이벤트 형식)
    if (window.gtag && isProduction) {
      metrics.forEach(metric => {
        window.gtag('event', 'web_vitals', {
          name: metric.name,
          value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
          metric_rating: metric.rating,
          metric_id: metric.id,
          navigation_type: metric.navigationType
        });
      });
    }

    // 커스텀 분석 엔드포인트로 전송 (옵션)
    if (process.env.REACT_APP_ANALYTICS_ENDPOINT && isProduction) {
      await fetch(process.env.REACT_APP_ANALYTICS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metrics,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        }),
      });
    }

    // 개발 환경에서는 콘솔에 출력
    if (!isProduction) {
      console.log('🎯 Web Vitals:', metrics);
    }
  } catch (error) {
    console.warn('Failed to send analytics:', error);
  }
};

// 버퍼를 플러시하는 함수
const flushBuffer = () => {
  if (performanceBuffer.length > 0) {
    sendToAnalytics([...performanceBuffer]);
    performanceBuffer.length = 0; // 버퍼 초기화
  }
};

// 주기적으로 버퍼를 플러시
setInterval(flushBuffer, FLUSH_INTERVAL);

// 페이지 언로드 시 남은 데이터 전송
window.addEventListener('beforeunload', flushBuffer);

// 메트릭 처리 함수
const handleMetric = (metric: Metric) => {
  const performanceData: PerformanceData = {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    id: metric.id,
    navigationType: metric.navigationType,
    timestamp: Date.now(),
  };

  performanceBuffer.push(performanceData);

  // 버퍼가 가득 차면 전송
  if (performanceBuffer.length >= BUFFER_SIZE) {
    flushBuffer();
  }
};

// Web Vitals 보고 함수
const reportWebVitals = (onPerfEntry?: (metric: Metric) => void) => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    // Core Web Vitals
    onCLS((metric) => {
      handleMetric(metric);
      onPerfEntry(metric);
    });
    
    onLCP((metric) => {
      handleMetric(metric);
      onPerfEntry(metric);
    });
    
    onINP((metric) => {
      handleMetric(metric);
      onPerfEntry(metric);
    });
    
    // Other Web Vitals
    onFCP((metric) => {
      handleMetric(metric);
      onPerfEntry(metric);
    });
    
    onTTFB((metric) => {
      handleMetric(metric);
      onPerfEntry(metric);
    });
  }
};

// 타입 선언 (window.gtag 사용을 위함)
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}

export default reportWebVitals;