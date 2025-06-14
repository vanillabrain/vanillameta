---
task_id: T06_S06
sprint_sequence_id: S06
status: open
complexity: Medium
last_updated: 2025-06-14T19:00:00Z
---

# Task: 프로그레시브 데이터 로딩 UI 구현

## Description
대용량 데이터를 점진적으로 로드하고 렌더링하는 프론트엔드 UI를 구현합니다. 현재는 모든 데이터를 한 번에 받아 렌더링하려고 하여 브라우저가 멈추거나 메모리 부족이 발생합니다. 사용자 경험을 개선하기 위해 데이터를 점진적으로 표시하는 UI가 필요합니다.

## Goal / Objectives
- 스트리밍 데이터를 실시간으로 렌더링하는 UI 구현
- 가상 스크롤링으로 대용량 데이터 효율적 표시
- 로딩 진행상황을 시각적으로 표현

## Acceptance Criteria
- [ ] 스트리밍 응답(NDJSON/SSE)을 처리하는 클라이언트 구현
- [ ] React Virtual 또는 유사 라이브러리로 가상 스크롤링 구현
- [ ] 데이터 로딩 진행률 표시 (프로그레스 바)
- [ ] 10만 건 데이터도 브라우저 멈춤 없이 표시
- [ ] 차트의 경우 샘플링 또는 집계된 데이터로 점진적 업데이트

## Subtasks
- [ ] 스트리밍 API 클라이언트 구현 (fetch API 또는 EventSource)
- [ ] 가상 스크롤링 컴포넌트 통합
- [ ] 프로그레스 인디케이터 컴포넌트 개발
- [ ] 차트 컴포넌트의 점진적 업데이트 로직
- [ ] 에러 처리 및 재시도 UI

## Technical Guidance

### Key Interfaces and Integration Points
- `src/api/datasetService.ts` - 데이터셋 API 서비스
- `src/widget/wrapper/WidgetWrapper.tsx` - 위젯 래퍼
- `src/components/datagrid/index.tsx` - 데이터 그리드 컴포넌트
- `src/contexts/LoadingContext.tsx` - 로딩 상태 관리

### Specific Imports and Module References
```typescript
// Streaming fetch
import { fetchEventSource } from '@microsoft/fetch-event-source';
// Virtual scrolling
import { VariableSizeList } from 'react-window';
// Progress indicators
import { LinearProgress } from '@mui/material';
// Chart updates
import * as echarts from 'echarts';
```

### Existing Patterns to Follow
- API 서비스는 src/api/ 패턴 따름
- 컴포넌트는 Material-UI 테마 사용
- 상태 관리는 Context API 활용
- 로딩 상태는 LoadingContext 통합

### Database Models and API Contracts
- 스트리밍 엔드포인트: `/api/v1/dataset/stream/:id`
- 프로그레스 응답: `{ progress: number, total: number }`
- 데이터 청크: NDJSON 형식

## Implementation Notes

### Step-by-Step Implementation Approach
1. datasetService에 스트리밍 메서드 추가
2. 스트리밍 데이터 버퍼링 및 상태 관리 훅 개발
3. 데이터 그리드에 가상 스크롤링 적용
4. 프로그레스 컴포넌트 개발 및 통합
5. 차트 위젯에 점진적 업데이트 적용
6. 에러 및 중단 처리 UI 구현

### Key Architectural Decisions
- 스트리밍은 EventSource(SSE) 또는 fetch stream 사용
- 데이터는 청크 단위로 상태에 추가 (immutable update)
- 가상 스크롤링은 react-window 라이브러리 활용
- 차트는 일정 간격으로 배치 업데이트

### Testing Approach
- 단위 테스트: 스트리밍 파서, 데이터 버퍼링 로직
- 통합 테스트: 전체 스트리밍 플로우 테스트
- 성능 테스트: 대용량 데이터 렌더링 성능 측정
- E2E 테스트: 사용자 시나리오 테스트

### Performance Considerations
- 청크 크기와 업데이트 주기 최적화
- 불필요한 리렌더링 방지 (React.memo, useMemo)
- 메모리 사용량 모니터링 및 제한
- 백프레셔 처리 (데이터 수신 속도 조절)

## Output Log
*(This section is populated as work progresses on the task)*