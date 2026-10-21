# 커서 기반 페이지네이션 가이드

## 개요

VanillaMeta API는 대용량 데이터셋에서 효율적인 페이지네이션을 위해 커서 기반 페이지네이션을 지원합니다. 이 문서는 커서 기반 페이지네이션의 사용 방법과 이점을 설명합니다.

## 커서 기반 vs 오프셋 기반 페이지네이션

### 오프셋 기반 (기존 방식)
```http
GET /api/widgets?page=50&limit=20
```
- **장점**: 간단하고 직관적, 특정 페이지로 직접 이동 가능
- **단점**: 대용량 데이터셋에서 성능 저하, 실시간 데이터 변경 시 일관성 문제

### 커서 기반 (권장)
```http
GET /api/widgets?nextCursor=eyJpZCI6MTAwLCJzb3J0VmFsdWUiOiIyMDI1LTAxLTE0In0&limit=20
```
- **장점**: 대용량 데이터셋에서도 일정한 성능, 실시간 데이터 변경에도 일관된 결과
- **단점**: 특정 페이지로 직접 이동 불가, 구현이 복잡

## API 사용법

### 1. 첫 페이지 요청

```http
GET /api/widgets?limit=20
```

응답:
```json
{
  "data": [
    { "id": 1, "title": "Widget 1", "createdAt": "2025-01-14T10:00:00Z" },
    { "id": 2, "title": "Widget 2", "createdAt": "2025-01-14T09:00:00Z" },
    // ... 18개 더
  ],
  "meta": {
    "hasNext": true,
    "hasPrevious": false,
    "nextCursor": "eyJpZCI6MjAsInNvcnRWYWx1ZSI6IjIwMjUtMDEtMTNUMTU6MDA6MDBaIn0",
    "count": 20,
    "limit": 20,
    "total": 500
  }
}
```

### 2. 다음 페이지 요청

```http
GET /api/widgets?nextCursor=eyJpZCI6MjAsInNvcnRWYWx1ZSI6IjIwMjUtMDEtMTNUMTU6MDA6MDBaIn0&limit=20
```

### 3. 이전 페이지 요청

```http
GET /api/widgets?previousCursor=eyJpZCI6MjEsInNvcnRWYWx1ZSI6IjIwMjUtMDEtMTNUMTQ6MDA6MDBaIn0&limit=20
```

## 쿼리 파라미터

| 파라미터 | 타입 | 설명 | 기본값 |
|---------|------|------|--------|
| `limit` | number | 페이지당 항목 수 (최대 100) | 20 |
| `nextCursor` | string | 다음 페이지 커서 | - |
| `previousCursor` | string | 이전 페이지 커서 | - |
| `sortField` | string | 정렬 필드 | id |
| `sortDirection` | string | 정렬 방향 (ASC/DESC) | DESC |

## 정렬 옵션

커서 기반 페이지네이션은 정렬 필드를 기준으로 작동합니다:

```http
GET /api/widgets?sortField=createdAt&sortDirection=DESC&limit=20
```

지원되는 정렬 필드:
- `id`: 기본 키 (기본값)
- `createdAt`: 생성 일시
- `updatedAt`: 수정 일시
- `title`: 제목 (문자열 정렬)

## 하위 호환성

기존 오프셋 기반 페이지네이션도 계속 지원됩니다:

```http
GET /api/widgets?page=2&limit=20
```

응답에는 커서 정보도 포함되어 점진적 마이그레이션이 가능합니다:

```json
{
  "data": [...],
  "meta": {
    "page": 2,
    "limit": 20,
    "total": 500,
    "hasNext": true,
    "hasPrevious": true,
    "nextCursor": "eyJpZCI6NDAsInNvcnRWYWx1ZSI6IjIwMjUtMDEtMTNUMTA6MDA6MDBaIn0",
    "previousCursor": "eyJpZCI6MjEsInNvcnRWYWx1ZSI6IjIwMjUtMDEtMTNUMTQ6MDA6MDBaIn0"
  }
}
```

## 구현 예제

### JavaScript/TypeScript

```typescript
// API 클라이언트
class ApiClient {
  async getWidgets(cursor?: string, limit = 20) {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (cursor) {
      params.append('nextCursor', cursor);
    }
    
    const response = await fetch(`/api/widgets?${params}`);
    return response.json();
  }
  
  async getAllWidgets() {
    const widgets = [];
    let cursor;
    
    do {
      const response = await this.getWidgets(cursor);
      widgets.push(...response.data);
      cursor = response.meta.nextCursor;
    } while (cursor && response.meta.hasNext);
    
    return widgets;
  }
}

// 사용 예
const client = new ApiClient();

// 첫 페이지
const firstPage = await client.getWidgets();

// 다음 페이지
const secondPage = await client.getWidgets(firstPage.meta.nextCursor);

// 모든 위젯 가져오기 (주의: 대용량 데이터)
const allWidgets = await client.getAllWidgets();
```

### React 예제

```tsx
import { useState, useEffect } from 'react';

function WidgetList() {
  const [widgets, setWidgets] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasNext, setHasNext] = useState(true);
  const [loading, setLoading] = useState(false);

  const loadMore = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '20' });
      if (cursor) params.append('nextCursor', cursor);
      
      const response = await fetch(`/api/widgets?${params}`);
      const data = await response.json();
      
      setWidgets(prev => [...prev, ...data.data]);
      setCursor(data.meta.nextCursor);
      setHasNext(data.meta.hasNext);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMore();
  }, []);

  return (
    <div>
      {widgets.map(widget => (
        <div key={widget.id}>{widget.title}</div>
      ))}
      {hasNext && (
        <button onClick={loadMore} disabled={loading}>
          {loading ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  );
}
```

## 성능 최적화 팁

### 1. 적절한 인덱스 설정

정렬 필드에 인덱스가 있어야 최적의 성능을 발휘합니다:

```sql
-- 단일 필드 인덱스
CREATE INDEX idx_widgets_created_at ON widgets(created_at DESC);

-- 복합 인덱스 (정렬 필드 + ID)
CREATE INDEX idx_widgets_created_at_id ON widgets(created_at DESC, id);
```

### 2. 커서 캐싱

커서는 상태를 유지하지 않으므로 클라이언트에서 캐싱 가능:

```typescript
const cursorCache = new Map();

async function getPageWithCache(pageKey: string, cursor?: string) {
  const cacheKey = `${pageKey}-${cursor || 'first'}`;
  
  if (cursorCache.has(cacheKey)) {
    return cursorCache.get(cacheKey);
  }
  
  const result = await fetchPage(cursor);
  cursorCache.set(cacheKey, result);
  
  return result;
}
```

### 3. 병렬 로딩

여러 데이터셋을 동시에 로드할 때:

```typescript
const [widgets, dashboards, datasets] = await Promise.all([
  apiClient.getWidgets(),
  apiClient.getDashboards(),
  apiClient.getDatasets(),
]);
```

## 제한 사항

1. **특정 페이지로 직접 이동 불가**: 커서 기반은 순차적 탐색만 가능
2. **전체 페이지 수 계산 비용**: `total` 필드는 선택적으로 제공
3. **커서 만료**: 커서는 영구적이지 않으며, 데이터 변경 시 무효화될 수 있음

## 마이그레이션 가이드

### 단계 1: 하이브리드 모드 사용

```typescript
// 기존 코드
const response = await fetch(`/api/widgets?page=${page}&limit=20`);

// 수정된 코드 (커서 우선, 오프셋 폴백)
let url = '/api/widgets?limit=20';
if (cursor) {
  url += `&nextCursor=${cursor}`;
} else if (page > 1) {
  url += `&page=${page}`;
}
const response = await fetch(url);

// 커서 저장
const nextCursor = response.meta.nextCursor;
```

### 단계 2: 점진적 전환

1. 새로운 기능은 커서 기반으로 구현
2. 기존 기능은 점진적으로 마이그레이션
3. 사용자 인터페이스는 "더 보기" 방식으로 전환

### 단계 3: 완전 전환

모든 클라이언트가 커서를 지원하면 오프셋 기반 제거 고려

## 문제 해결

### 유효하지 않은 커서 오류

```json
{
  "statusCode": 400,
  "message": "유효하지 않은 커서",
  "error": "Bad Request"
}
```

**해결 방법**: 
- 커서가 손상되었거나 만료됨
- 첫 페이지부터 다시 시작

### 정렬 필드 변경 시

정렬 필드를 변경하면 기존 커서는 무효화됩니다:

```typescript
// 잘못된 예
let cursor = firstPage.meta.nextCursor; // createdAt 기준
const secondPage = await fetch(`/api/widgets?nextCursor=${cursor}&sortField=title`); // 오류!

// 올바른 예
const firstPage = await fetch('/api/widgets?sortField=title');
const secondPage = await fetch(`/api/widgets?nextCursor=${firstPage.meta.nextCursor}&sortField=title`);
```

## 지원 엔드포인트

다음 엔드포인트에서 커서 기반 페이지네이션을 지원합니다:

- `GET /api/widgets` - 위젯 목록
- `GET /api/dashboards` - 대시보드 목록
- `GET /api/datasets` - 데이터셋 목록
- `GET /api/components` - 컴포넌트 목록
- `GET /api/templates` - 템플릿 목록

## 추가 리소스

- [페이지네이션 모범 사례](https://www.apollographql.com/blog/graphql/pagination/understanding-pagination-rest-graphql-and-relay/)
- [커서 기반 페이지네이션의 이점](https://slack.engineering/evolving-api-pagination-at-slack/)
- [TypeORM 쿼리 빌더 문서](https://typeorm.io/select-query-builder)