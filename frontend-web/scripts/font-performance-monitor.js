/**
 * 폰트 로딩 성능 모니터링 및 최적화 스크립트
 * 
 * 실제 브라우저에서 폰트 로딩 성능을 측정하고
 * CLS(Cumulative Layout Shift) 최소화를 위한 최적화를 제공합니다.
 */

class FontPerformanceMonitor {
  constructor() {
    this.fontLoadTimes = new Map();
    this.layoutShifts = [];
    this.performanceEntries = [];
    this.isMonitoring = false;
  }

  /**
   * 폰트 로딩 성능 모니터링 시작
   */
  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    console.log('🔍 폰트 성능 모니터링 시작');

    // Font Loading API 모니터링
    this.monitorFontLoading();

    // Layout Shift 모니터링
    this.monitorLayoutShifts();

    // Performance Observer 설정
    this.setupPerformanceObserver();

    // DOM 폰트 상태 모니터링
    this.monitorDOMFontStatus();
  }

  /**
   * Font Loading API를 통한 폰트 로딩 모니터링
   */
  monitorFontLoading() {
    if (!document.fonts) {
      console.warn('⚠️ Font Loading API가 지원되지 않습니다.');
      return;
    }

    const fontWeights = ['400', '500', '600', '700'];
    const fontFamily = 'Pretendard';

    fontWeights.forEach(weight => {
      const fontFace = new FontFace(fontFamily, `url('assets/fonts/woff2-subset/Pretendard-${this.getWeightName(weight)}.subset.woff2')`, {
        weight,
        display: 'swap'
      });

      const startTime = performance.now();
      
      fontFace.load().then(() => {
        const loadTime = performance.now() - startTime;
        this.fontLoadTimes.set(`${fontFamily}-${weight}`, loadTime);
        
        console.log(`✅ ${fontFamily} ${weight} 로드 완료: ${loadTime.toFixed(2)}ms`);
        
        // 폰트를 document.fonts에 추가
        document.fonts.add(fontFace);
      }).catch(error => {
        console.error(`❌ ${fontFamily} ${weight} 로드 실패:`, error);
      });
    });

    // 모든 폰트 로딩 완료 모니터링
    document.fonts.ready.then(() => {
      const totalLoadTime = performance.now() - this.startTime;
      console.log(`🎉 모든 폰트 로드 완료: ${totalLoadTime.toFixed(2)}ms`);
      this.generateReport();
    });
  }

  /**
   * Layout Shift 모니터링 (CLS 측정)
   */
  monitorLayoutShifts() {
    if (!window.PerformanceObserver) return;

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
            this.layoutShifts.push({
              value: entry.value,
              time: entry.startTime,
              sources: entry.sources || []
            });
          }
        }
      });

      observer.observe({ entryTypes: ['layout-shift'] });
    } catch (error) {
      console.warn('⚠️ Layout Shift 모니터링을 지원하지 않습니다:', error);
    }
  }

  /**
   * Performance Observer 설정
   */
  setupPerformanceObserver() {
    if (!window.PerformanceObserver) return;

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.initiatorType === 'css' && entry.name.includes('font')) {
            this.performanceEntries.push({
              name: entry.name,
              duration: entry.duration,
              transferSize: entry.transferSize,
              encodedBodySize: entry.encodedBodySize,
              decodedBodySize: entry.decodedBodySize
            });
          }
        }
      });

      observer.observe({ entryTypes: ['resource'] });
    } catch (error) {
      console.warn('⚠️ Resource 모니터링을 지원하지 않습니다:', error);
    }
  }

  /**
   * DOM에서 폰트 상태 모니터링
   */
  monitorDOMFontStatus() {
    const testElement = document.createElement('div');
    testElement.style.fontFamily = 'Pretendard, sans-serif';
    testElement.style.fontSize = '16px';
    testElement.style.position = 'absolute';
    testElement.style.visibility = 'hidden';
    testElement.textContent = '한글 테스트 Text';
    document.body.appendChild(testElement);

    const checkFontLoaded = () => {
      const computedStyle = window.getComputedStyle(testElement);
      const actualFontFamily = computedStyle.fontFamily;
      
      if (actualFontFamily.includes('Pretendard')) {
        console.log('✅ Pretendard 폰트가 DOM에 적용되었습니다.');
        document.body.removeChild(testElement);
      } else {
        setTimeout(checkFontLoaded, 100);
      }
    };

    setTimeout(checkFontLoaded, 100);
  }

  /**
   * Weight 번호를 이름으로 변환
   */
  getWeightName(weight) {
    const weightMap = {
      '100': 'Thin',
      '200': 'ExtraLight', 
      '300': 'Light',
      '400': 'Regular',
      '500': 'Medium',
      '600': 'SemiBold',
      '700': 'Bold',
      '800': 'ExtraBold',
      '900': 'Black'
    };
    return weightMap[weight] || 'Regular';
  }

  /**
   * 성능 보고서 생성
   */
  generateReport() {
    const cls = this.calculateCLS();
    const avgFontLoadTime = this.calculateAverageFontLoadTime();
    
    const report = {
      timestamp: new Date().toISOString(),
      metrics: {
        cls: cls,
        avgFontLoadTime: avgFontLoadTime,
        totalLayoutShifts: this.layoutShifts.length,
        fontsLoaded: this.fontLoadTimes.size
      },
      fontLoadTimes: Object.fromEntries(this.fontLoadTimes),
      layoutShifts: this.layoutShifts,
      resourceEntries: this.performanceEntries,
      recommendations: this.generateRecommendations(cls, avgFontLoadTime)
    };

    console.group('📊 폰트 성능 보고서');
    console.log('CLS (Cumulative Layout Shift):', cls.toFixed(4));
    console.log('평균 폰트 로드 시간:', avgFontLoadTime.toFixed(2) + 'ms');
    console.log('레이아웃 시프트 횟수:', this.layoutShifts.length);
    console.log('로드된 폰트 수:', this.fontLoadTimes.size);
    console.groupEnd();

    // 로컬 스토리지에 저장
    localStorage.setItem('fontPerformanceReport', JSON.stringify(report));
    
    return report;
  }

  /**
   * CLS 계산
   */
  calculateCLS() {
    return this.layoutShifts.reduce((sum, shift) => sum + shift.value, 0);
  }

  /**
   * 평균 폰트 로드 시간 계산
   */
  calculateAverageFontLoadTime() {
    if (this.fontLoadTimes.size === 0) return 0;
    
    const times = Array.from(this.fontLoadTimes.values());
    return times.reduce((sum, time) => sum + time, 0) / times.length;
  }

  /**
   * 최적화 권장사항 생성
   */
  generateRecommendations(cls, avgLoadTime) {
    const recommendations = [];

    if (cls > 0.1) {
      recommendations.push({
        type: 'warning',
        metric: 'CLS',
        value: cls,
        suggestion: 'CLS가 0.1을 초과합니다. font-display: swap 대신 font-display: optional 고려하세요.'
      });
    }

    if (avgLoadTime > 1000) {
      recommendations.push({
        type: 'warning', 
        metric: 'loadTime',
        value: avgLoadTime,
        suggestion: '폰트 로드 시간이 1초를 초과합니다. 더 작은 서브셋이나 preload 최적화를 고려하세요.'
      });
    }

    if (this.fontLoadTimes.size > 4) {
      recommendations.push({
        type: 'info',
        metric: 'fontCount',
        value: this.fontLoadTimes.size,
        suggestion: '로드되는 폰트 수가 많습니다. 자주 사용되는 weight만 preload하는 것을 고려하세요.'
      });
    }

    return recommendations;
  }

  /**
   * 실시간 성능 측정 시작
   */
  startRealTimeMonitoring() {
    setInterval(() => {
      const report = this.generateReport();
      
      // 성능이 저하되면 알림
      if (report.metrics.cls > 0.1 || report.metrics.avgFontLoadTime > 1000) {
        console.warn('⚠️ 폰트 성능 저하 감지');
      }
    }, 5000);
  }
}

/**
 * 폰트 최적화 유틸리티
 */
class FontOptimizer {
  /**
   * 폰트 preload 최적화
   */
  static optimizePreload() {
    // 중요한 폰트만 preload (Regular, Medium, SemiBold)
    const criticalFonts = [
      'assets/fonts/woff2-subset/Pretendard-Regular.subset.woff2',
      'assets/fonts/woff2-subset/Pretendard-Medium.subset.woff2',
      'assets/fonts/woff2-subset/Pretendard-SemiBold.subset.woff2'
    ];

    criticalFonts.forEach(fontUrl => {
      if (!document.querySelector(`link[href="${fontUrl}"]`)) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = fontUrl;
        link.as = 'font';
        link.type = 'font/woff2';
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
      }
    });
  }

  /**
   * 폰트 폴백 스택 최적화
   */
  static optimizeFallbackStack() {
    const style = document.createElement('style');
    style.textContent = `
      /* 최적화된 폰트 폴백 스택 */
      .font-pretendard {
        font-family: 'Pretendard', 
                     -apple-system, 
                     BlinkMacSystemFont, 
                     'Segoe UI', 
                     Roboto, 
                     'Helvetica Neue', 
                     Arial, 
                     'Noto Sans', 
                     'Noto Sans KR', 
                     sans-serif;
        font-feature-settings: 'kern' 1;
        font-optical-sizing: auto;
      }

      /* 로딩 중 FOUT 최소화 */
      @media (prefers-reduced-motion: reduce) {
        .font-pretendard {
          font-display: block;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * 적응형 폰트 로딩
   */
  static adaptiveFontLoading() {
    // 연결 속도에 따른 적응형 로딩
    if ('connection' in navigator) {
      const connection = navigator.connection;
      
      if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
        // 느린 연결에서는 최소한의 폰트만 로드
        console.log('🐌 느린 연결 감지 - 최소 폰트 로딩');
        this.loadMinimalFonts();
      } else {
        // 빠른 연결에서는 전체 폰트 로드
        console.log('🚀 빠른 연결 감지 - 전체 폰트 로딩');
        this.loadAllFonts();
      }
    }
  }

  static loadMinimalFonts() {
    // Regular weight만 로드
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = 'assets/fonts/woff2-subset/Pretendard-Regular.subset.woff2';
    link.as = 'font';
    link.type = 'font/woff2';
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  }

  static loadAllFonts() {
    this.optimizePreload();
  }
}

// 전역에서 사용할 수 있도록 export
window.FontPerformanceMonitor = FontPerformanceMonitor;
window.FontOptimizer = FontOptimizer;

// 자동 초기화 (프로덕션에서는 제거)
if (process.env.NODE_ENV === 'development') {
  document.addEventListener('DOMContentLoaded', () => {
    const monitor = new FontPerformanceMonitor();
    monitor.startMonitoring();
    
    FontOptimizer.optimizePreload();
    FontOptimizer.optimizeFallbackStack();
    FontOptimizer.adaptiveFontLoading();
  });
}

export { FontPerformanceMonitor, FontOptimizer };