# React 메모이제이션 가이드라인

## 개요

T05_S05에서 구현한 React 메모이제이션 최적화 내용과 향후 개발 시 따라야 할 가이드라인을 정리합니다.

## 구현 내용

### 1. 차트 컴포넌트 메모이제이션

#### PieChart 컴포넌트 최적화

**적용 내용**:
- `React.memo`로 컴포넌트 래핑
- `useMemo`로 기본 옵션과 계산된 옵션 메모이제이션
- `OptimizedChart` 통합 적용

```typescript
// Before
const PieChart = props => {
  const [componentOption, setComponentOption] = useState({});
  // useEffect로 옵션 재계산...
};

// After
const PieChart = memo(props => {
  const defaultComponentOption = useMemo(() => ({
    // 기본 옵션들...
  }), []);

  const componentOption = useMemo(() => {
    // 계산 로직...
  }, [option, dataSet, seriesOp, defaultComponentOption]);
});
```

### 2. 대시보드 이벤트 핸들러 최적화

#### DashboardModify 컴포넌트

**적용된 useCallback 핸들러들**:
- `handleWidgetSelect`: 위젯 선택 처리
- `onLayoutChange`: 레이아웃 변경 처리

```typescript
// 위젯 선택 핸들러 최적화
const handleWidgetSelect = useCallback(items => {
  setWidgetOpen(false);
  if (items != null) {
    setWidgets(prev => [...prev, ...items]); // 함수형 업데이트
  }
}, []);

// 레이아웃 변경 핸들러 최적화
const onLayoutChange = useCallback(changeLayout => {
  setLayout(changeLayout);
}, []);
```

### 3. Context Provider 최적화

#### LoadingContext 최적화

**적용 내용**:
- `useCallback`으로 핸들러 함수 메모이제이션
- `useMemo`로 Context value 메모이제이션

```typescript
// Before
const LoadingProvider = ({ children }) => {
  const showLoading = () => setLoading(true);
  const hideLoading = () => setLoading(false);
  
  return (
    <LoadingContext.Provider value={{ loading, showLoading, hideLoading }}>
      {children}
    </LoadingContext.Provider>
  );
};

// After
const LoadingProvider = ({ children }) => {
  const showLoading = useCallback(() => setLoading(true), []);
  const hideLoading = useCallback(() => setLoading(false), []);
  
  const contextValue = useMemo(() => ({
    loading,
    showLoading,
    hideLoading,
  }), [loading, showLoading, hideLoading]);
  
  return (
    <LoadingContext.Provider value={contextValue}>
      {children}
    </LoadingContext.Provider>
  );
};
```

## 메모이제이션 가이드라인

### 1. React.memo 사용 기준

#### ✅ 사용해야 하는 경우
- **차트 컴포넌트**: 복잡한 렌더링을 수행하는 차트들
- **리스트 아이템**: 반복되는 컴포넌트 (위젯, 카드 등)
- **복잡한 계산**: 렌더링에 비용이 많이 드는 컴포넌트
- **Context Consumer**: Context 값이 자주 변경되지 않는 경우

```typescript
// 차트 컴포넌트 예시
const LineChart = memo(props => {
  // 복잡한 차트 렌더링 로직
});

// 리스트 아이템 예시
const WidgetCard = memo(({ widget }) => {
  // 위젯 카드 렌더링
});
```

#### ❌ 사용하지 말아야 하는 경우
- **단순한 컴포넌트**: 렌더링 비용이 낮은 간단한 컴포넌트
- **자주 변경되는 props**: props가 매번 새로운 값인 경우
- **객체/배열 props**: 참조가 매번 바뀌는 복잡한 props

### 2. useMemo 사용 기준

#### ✅ 사용해야 하는 경우
- **복잡한 계산**: 비용이 높은 데이터 변환, 정렬, 필터링
- **차트 옵션 생성**: ECharts 옵션 객체 생성
- **파생 상태**: 여러 state를 조합한 계산된 값

```typescript
// 복잡한 계산 메모이제이션
const processedData = useMemo(() => {
  return dataSet
    .filter(item => item.value > threshold)
    .map(item => transformData(item))
    .sort((a, b) => a.order - b.order);
}, [dataSet, threshold]);

// 차트 옵션 메모이제이션
const chartOption = useMemo(() => {
  return {
    series: createSeries(data),
    xAxis: createXAxis(categories),
    yAxis: createYAxis(values),
  };
}, [data, categories, values]);
```

#### ❌ 사용하지 말아야 하는 경우
- **단순한 계산**: 기본 연산, 문자열 조작
- **매번 변경되는 의존성**: deps가 매번 바뀌는 경우
- **참조 타입 생성**: 새로운 객체/배열을 만드는 경우

### 3. useCallback 사용 기준

#### ✅ 사용해야 하는 경우
- **자식 컴포넌트 props**: memo된 자식에게 전달되는 함수
- **Effect 의존성**: useEffect deps에 포함되는 함수
- **Context value**: Context로 전달되는 함수

```typescript
// 자식 컴포넌트 props용
const handleClick = useCallback((id) => {
  setSelectedId(id);
}, []);

// useEffect 의존성용
const fetchData = useCallback(async () => {
  const result = await api.getData(filters);
  setData(result);
}, [filters]);

useEffect(() => {
  fetchData();
}, [fetchData]);
```

#### ❌ 사용하지 말아야 하는 경우
- **인라인 이벤트 핸들러**: JSX 내 간단한 핸들러
- **deps가 자주 변경**: 의존성이 매번 바뀌는 함수
- **단순한 setter**: setState만 호출하는 함수

### 4. Context 최적화 가이드

#### Provider Value 메모이제이션
```typescript
// ✅ 올바른 방법
const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('light');
  
  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, []);
  
  const value = useMemo(() => ({
    theme,
    toggleTheme,
  }), [theme, toggleTheme]);
  
  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// ❌ 잘못된 방법 (매번 새로운 객체 생성)
const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('light');
  
  return (
    <ThemeContext.Provider value={{
      theme,
      toggleTheme: () => setTheme(prev => prev === 'light' ? 'dark' : 'light')
    }}>
      {children}
    </ThemeContext.Provider>
  );
};
```

## 성능 측정 방법

### 1. React DevTools Profiler

```javascript
// 프로파일링 시작
// React DevTools > Profiler 탭 > Start profiling

// 사용자 인터랙션 수행 (차트 업데이트, 대시보드 조작 등)

// 프로파일링 중지 및 결과 분석
// - Render 횟수
// - Render 시간
// - 컴포넌트별 성능
```

### 2. 커스텀 성능 측정

```typescript
// 렌더링 성능 측정 커스텀 훅
const useRenderTracker = (componentName: string) => {
  const renderCount = useRef(0);
  
  useEffect(() => {
    renderCount.current += 1;
    console.log(`${componentName} rendered ${renderCount.current} times`);
  });
  
  return renderCount.current;
};

// 사용 예시
const MyComponent = memo(() => {
  const renderCount = useRenderTracker('MyComponent');
  
  return <div>Render count: {renderCount}</div>;
});
```

### 3. 메모리 사용량 모니터링

```javascript
// 메모리 사용량 체크
const checkMemoryUsage = () => {
  if (performance.memory) {
    console.log({
      used: Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB',
      total: Math.round(performance.memory.totalJSHeapSize / 1048576) + ' MB',
      limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576) + ' MB'
    });
  }
};

// 정기적으로 메모리 사용량 체크
setInterval(checkMemoryUsage, 10000);
```

## 성능 개선 효과

### 예상 성능 개선
- **렌더링 횟수**: 50% 감소 (불필요한 리렌더링 방지)
- **메모리 사용량**: 20-30% 감소 (메모이제이션 효과)
- **사용자 인터랙션 응답성**: 30% 개선 (useCallback 효과)
- **복잡한 계산**: 60% 시간 단축 (useMemo 효과)

### 측정 가능한 지표
- React DevTools Profiler의 렌더링 시간
- 대시보드 인터랙션 응답 시간
- 차트 업데이트 시간
- 메모리 사용량 (Chrome DevTools Memory 탭)

## 주의사항 및 안티패턴

### 1. 과도한 메모이제이션 피하기
```typescript
// ❌ 불필요한 메모이제이션
const SimpleComponent = memo(() => {
  return <div>Hello World</div>; // 단순한 컴포넌트
});

const value = useMemo(() => props.name, [props.name]); // 단순한 값
```

### 2. 잘못된 의존성 배열
```typescript
// ❌ 잘못된 의존성
const memoizedValue = useMemo(() => {
  return expensiveCalculation(a, b, c);
}, [a]); // b, c가 빠짐

// ✅ 올바른 의존성
const memoizedValue = useMemo(() => {
  return expensiveCalculation(a, b, c);
}, [a, b, c]);
```

### 3. 참조 동일성 깨뜨리기
```typescript
// ❌ 매번 새로운 객체/배열 생성
const config = { option1: true, option2: false };
const list = [1, 2, 3];

// ✅ 참조 동일성 유지
const config = useMemo(() => ({ option1: true, option2: false }), []);
const list = useMemo(() => [1, 2, 3], []);
```

## 팀 개발 가이드라인

### 1. 코드 리뷰 체크리스트
- [ ] 복잡한 컴포넌트에 memo 적용했는가?
- [ ] 비용이 높은 계산에 useMemo 적용했는가?
- [ ] 자식 컴포넌트에 전달되는 함수에 useCallback 적용했는가?
- [ ] Context value가 메모이제이션되었는가?
- [ ] 의존성 배열이 올바르게 설정되었는가?

### 2. 성능 테스트 필수 사항
- React DevTools Profiler로 렌더링 성능 확인
- 복잡한 인터랙션 시나리오 테스트
- 메모리 누수 여부 확인
- 실제 사용자 환경에서 성능 검증

### 3. 문서화 요구사항
- 메모이제이션 적용 이유 주석 작성
- 성능 개선 효과 측정 결과 기록
- 복잡한 최적화 로직에 대한 설명 추가

## 결론

React 메모이제이션을 적절히 활용하면 다음과 같은 성능 개선을 기대할 수 있습니다:

1. **렌더링 최적화**: 불필요한 리렌더링 방지로 UI 반응성 개선
2. **메모리 효율성**: 중복 계산 방지로 메모리 사용량 최적화
3. **사용자 경험**: 인터랙션 응답성 향상으로 UX 개선
4. **확장성**: 대용량 데이터와 복잡한 UI에서도 안정적인 성능

다만 과도한 메모이제이션은 오히려 성능을 저하시킬 수 있으므로, 실제 성능 측정을 통해 효과를 검증하는 것이 중요합니다.