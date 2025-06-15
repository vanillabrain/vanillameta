# Chart Rendering Optimization 성능 개선

## 구현 개요

T04_S05에서 구현한 차트 렌더링 성능 최적화 내용을 정리합니다.

## 구현 내용

### 1. ChartContext (차트 인스턴스 관리)

**위치**: `src/contexts/ChartContext.tsx`

**주요 기능**:
- **인스턴스 풀링**: 차트 인스턴스를 재사용하여 메모리 효율성 개선
- **자동 가비지 컬렉션**: 5분 후 미사용 인스턴스 자동 정리
- **Canvas 렌더러 우선**: SVG 대신 Canvas 사용으로 성능 향상
- **스마트 리사이즈**: 디바운싱된 리사이즈 처리
- **옵션 업데이트 최적화**: merge vs replace 전략

**성능 최적화 설정**:
```typescript
echarts.init(container, undefined, {
  renderer: 'canvas',        // Canvas 렌더러 (성능 향상)
  useDirtyRect: true,        // 부분 렌더링 최적화
  useCoarsePointer: true,    // 터치 기기 최적화
});
```

### 2. OptimizedChart 컴포넌트

**위치**: `src/components/OptimizedChart/index.tsx`

**주요 최적화 기능**:

#### 데이터 샘플링
- 10,000개 이상 데이터 포인트 자동 샘플링
- 첫 번째와 마지막 데이터 포인트 보존
- ECharts 내장 샘플링도 활용 (`sampling: 'average'`)

#### 스마트한 옵션 업데이트
- JSON 비교를 통한 변경 감지
- 불필요한 re-render 방지
- notMerge/lazyUpdate 플래그 최적화

#### 리사이즈 최적화
- ResizeObserver 우선 사용
- 100ms 디바운싱 적용
- 하드웨어 가속 활성화 (`willChange: 'transform'`)

#### 메모리 관리
- 컴포넌트 언마운트 시 자동 정리
- StrictMode 대응 중복 dispose 방지
- 인스턴스 상태 추적

### 3. LineChart 컴포넌트 최적화

**변경사항**:
1. **ReactECharts → OptimizedChart**: 성능 최적화된 컴포넌트 사용
2. **useMemo 최적화**: 불필요한 옵션 재계산 방지
3. **Canvas 렌더러**: 기본 렌더러를 Canvas로 변경
4. **데이터 샘플링 활성화**: 대량 데이터 처리 최적화

```typescript
// Before
<ReactECharts 
  option={componentOption} 
  lazyUpdate={true} 
  notMerge={true} 
/>

// After  
<OptimizedChart
  option={componentOption}
  lazyUpdate={true}
  notMerge={true}
  enableDataSampling={true}
  maxDataPoints={10000}
  renderer="canvas"
/>
```

## 성능 최적화 효과

### 1. 메모리 사용량 개선
- **인스턴스 풀링**: 동일 타입 차트 간 인스턴스 재사용
- **자동 정리**: 미사용 인스턴스 5분 후 자동 해제
- **예상 효과**: 메모리 사용량 40-60% 감소

### 2. 렌더링 성능 향상
- **Canvas 렌더러**: SVG 대비 대량 데이터에서 3-5배 빠른 렌더링
- **부분 렌더링**: `useDirtyRect`로 변경된 영역만 렌더링
- **예상 효과**: 차트 렌더링 시간 30-50% 개선

### 3. 리사이즈 성능 개선
- **디바운싱**: 100ms 지연으로 불필요한 리사이즈 방지
- **ResizeObserver**: window resize 이벤트보다 효율적
- **예상 효과**: 리사이즈 시 60fps 유지

### 4. 대량 데이터 처리
- **데이터 샘플링**: 10,000개 이상 데이터 자동 샘플링
- **스마트 샘플링**: 균등 간격 + 첫/마지막 포인트 보존
- **예상 효과**: 100,000개 데이터도 부드러운 렌더링

## 성능 측정 방법

### 1. 차트 렌더링 벤치마크

```javascript
// 브라우저 콘솔에서 실행
const measureChartPerformance = () => {
  const start = performance.now();
  
  // 차트 렌더링 트리거
  // (대량 데이터로 차트 옵션 업데이트)
  
  requestAnimationFrame(() => {
    const end = performance.now();
    console.log(`Chart rendering time: ${end - start}ms`);
  });
};
```

### 2. 메모리 사용량 추적

```javascript
// ChartContext에서 인스턴스 수 확인
const { getInstanceCount } = useChart();
console.log(`Active chart instances: ${getInstanceCount()}`);

// 브라우저 DevTools > Memory 탭
// - Take heap snapshot
// - ECharts 관련 객체 수 확인
```

### 3. 리사이즈 성능 테스트

```javascript
// 리사이즈 성능 측정
let frameCount = 0;
let startTime = performance.now();

const measureFPS = () => {
  frameCount++;
  requestAnimationFrame(measureFPS);
  
  if (frameCount % 60 === 0) {
    const currentTime = performance.now();
    const fps = 60000 / (currentTime - startTime);
    console.log(`FPS: ${fps.toFixed(2)}`);
    startTime = currentTime;
  }
};

// 리사이즈 시작 전 측정 시작
measureFPS();
```

### 4. 실제 사용자 환경 테스트

**테스트 시나리오**:
1. **대량 데이터 차트**: 50,000개 데이터 포인트로 라인 차트 생성
2. **다중 차트 대시보드**: 10개 차트가 포함된 대시보드 로드
3. **리사이즈 테스트**: 브라우저 창 크기 연속 변경
4. **데이터 업데이트**: 실시간 데이터 스트림 시뮬레이션

**측정 지표**:
- 초기 렌더링 시간
- 리사이즈 반응 시간
- 메모리 사용량 (heap size)
- CPU 사용률
- 프레임 드롭 발생 여부

## 모니터링 및 디버깅

### 1. 성능 모니터링 도구

```typescript
// 차트 성능 추적용 커스텀 훅
const useChartPerformance = (chartId: string) => {
  useEffect(() => {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name.includes('chart-render')) {
          console.log(`Chart ${chartId} render time: ${entry.duration}ms`);
        }
      }
    });
    
    observer.observe({ entryTypes: ['measure'] });
    
    return () => observer.disconnect();
  }, [chartId]);
};
```

### 2. 메모리 누수 감지

```javascript
// 정기적으로 인스턴스 수 체크
setInterval(() => {
  const count = chartContext.getInstanceCount();
  if (count > 20) {
    console.warn(`Too many chart instances: ${count}`);
  }
}, 30000);
```

### 3. 개발자 도구 활용

```bash
# Chrome DevTools 설정
1. Performance 탭 > Start profiling
2. 차트 interaction 수행
3. Stop profiling
4. Frame rate, CPU usage 분석

# Memory 탭
1. Heap snapshot 촬영
2. ECharts, Canvas 관련 객체 검색
3. 메모리 누수 패턴 확인
```

## 추가 최적화 방향

### 1. 가상화 (Virtualization)
```typescript
// 대시보드에서 보이지 않는 차트 비활성화
const useChartVirtualization = () => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // 차트 활성화
      } else {
        // 차트 비활성화 (dispose X, pause)
      }
    });
  });
};
```

### 2. Web Worker 활용
```typescript
// 복잡한 데이터 처리를 Web Worker로 이동
const processChartData = async (rawData) => {
  const worker = new Worker('/workers/chart-data-processor.js');
  return new Promise((resolve) => {
    worker.postMessage(rawData);
    worker.onmessage = (e) => resolve(e.data);
  });
};
```

### 3. Progressive Loading
```typescript
// 차트를 단계적으로 로드
const useProgressiveChart = (data) => {
  const [displayData, setDisplayData] = useState([]);
  
  useEffect(() => {
    const loadChunks = async () => {
      const chunkSize = 1000;
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        setDisplayData(prev => [...prev, ...chunk]);
        await new Promise(resolve => setTimeout(resolve, 16)); // 60fps
      }
    };
    
    loadChunks();
  }, [data]);
};
```

## 검증 체크리스트

- [x] ChartContext 구현 완료
- [x] OptimizedChart 컴포넌트 구현 완료
- [x] LineChart 최적화 적용 완료
- [x] 인스턴스 풀링 시스템 구현 완료
- [x] 데이터 샘플링 로직 구현 완료
- [x] 리사이즈 디바운싱 적용 완료
- [ ] 성능 벤치마크 측정
- [ ] 메모리 사용량 비교 측정
- [ ] 다른 차트 타입에 적용
- [ ] 실제 대량 데이터 환경 테스트

## 결론

차트 렌더링 최적화 구현으로 다음과 같은 성능 개선을 기대할 수 있습니다:

1. **메모리 효율성**: 인스턴스 풀링으로 메모리 사용량 40-60% 감소
2. **렌더링 성능**: Canvas 렌더러와 최적화로 30-50% 속도 향상  
3. **대량 데이터 처리**: 100,000개 데이터도 부드러운 렌더링
4. **리사이즈 반응성**: 60fps 유지로 사용자 경험 개선

특히 대시보드에 여러 차트가 있는 환경에서 큰 성능 개선 효과를 보일 것으로 예상됩니다.