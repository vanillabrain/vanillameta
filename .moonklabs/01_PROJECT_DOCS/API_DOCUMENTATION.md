# VanillaMeta API 문서

## 목차
1. [개요](#개요)
2. [인증 방식](#인증-방식)
3. [주요 엔드포인트](#주요-엔드포인트)
4. [에러 코드 정의](#에러-코드-정의)
5. [API 사용 예시](#api-사용-예시)

## 개요

### 기본 정보
- **Base URL**: `https://api.vanillameta.com/v1`
- **개발 서버**: `https://dev-api.vanillameta.com/v1`
- **로컬 서버**: `http://localhost:3000/v1`
- **인증 방식**: JWT Bearer Token
- **응답 형식**: JSON
- **문자 인코딩**: UTF-8

### API 규칙
- RESTful 원칙 준수
- 모든 날짜/시간은 ISO 8601 형식
- 페이지네이션은 cursor 기반
- 요청 제한: 분당 100회

## 인증 방식

### 1. 로그인 및 토큰 발급

#### POST /auth/login
사용자 인증 후 JWT 토큰을 발급합니다.

**요청**
```http
POST /v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**응답**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "name": "사용자명"
  }
}
```

### 2. 토큰 갱신

#### POST /auth/refresh
리프레시 토큰을 사용하여 새로운 액세스 토큰을 발급받습니다.

**요청**
```http
POST /v1/auth/refresh
Content-Type: application/json

{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**응답**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 3. 인증 헤더 사용법

모든 보호된 엔드포인트는 Authorization 헤더에 Bearer 토큰이 필요합니다.

```http
GET /v1/dashboard
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 주요 엔드포인트

### 사용자 관리

#### GET /user/profile
현재 로그인한 사용자 정보 조회

**응답**
```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "name": "사용자명",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### PUT /user/profile
사용자 정보 수정

**요청**
```json
{
  "name": "새로운 이름",
  "phone": "010-1234-5678"
}
```

### 데이터베이스 연결 관리

#### GET /database
등록된 데이터베이스 목록 조회

**쿼리 파라미터**
- `page`: 페이지 번호 (기본값: 1)
- `limit`: 페이지당 항목 수 (기본값: 20, 최대: 100)
- `search`: 검색어

**응답**
```json
{
  "data": [
    {
      "id": "db-uuid",
      "name": "Production DB",
      "type": "mysql",
      "host": "masked-host",
      "port": 3306,
      "database": "mydb",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "total": 10,
    "page": 1,
    "limit": 20,
    "total_pages": 1
  }
}
```

#### POST /database
새 데이터베이스 연결 등록

**요청**
```json
{
  "name": "New Database",
  "type": "mysql",
  "host": "db.example.com",
  "port": 3306,
  "username": "dbuser",
  "password": "dbpassword",
  "database": "mydb"
}
```

**지원 데이터베이스 타입**
- `mysql`: MySQL/MariaDB
- `postgresql`: PostgreSQL
- `oracle`: Oracle
- `sqlserver`: Microsoft SQL Server
- `sqlite`: SQLite
- `bigquery`: Google BigQuery
- `snowflake`: Snowflake
- `cockroachdb`: CockroachDB
- `redshift`: Amazon Redshift

#### POST /database/test
데이터베이스 연결 테스트

**요청**
```json
{
  "type": "mysql",
  "host": "db.example.com",
  "port": 3306,
  "username": "dbuser",
  "password": "dbpassword",
  "database": "mydb"
}
```

**응답**
```json
{
  "success": true,
  "message": "연결 성공"
}
```

#### POST /database/:id/query
SQL 쿼리 실행

**요청**
```json
{
  "sql": "SELECT * FROM users LIMIT 10",
  "timeout": 30000
}
```

**응답**
```json
{
  "data": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com"
    }
  ],
  "meta": {
    "rows": 10,
    "fields": [
      {
        "name": "id",
        "type": "int"
      },
      {
        "name": "name",
        "type": "varchar"
      },
      {
        "name": "email",
        "type": "varchar"
      }
    ],
    "execution_time": 123
  }
}
```

### 데이터셋 관리

#### GET /dataset
데이터셋 목록 조회

**응답**
```json
{
  "data": [
    {
      "id": "dataset-uuid",
      "name": "사용자 통계",
      "database_id": "db-uuid",
      "sql": "SELECT COUNT(*) as total FROM users",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### POST /dataset
새 데이터셋 생성

**요청**
```json
{
  "name": "월별 매출",
  "database_id": "db-uuid",
  "sql": "SELECT DATE_FORMAT(created_at, '%Y-%m') as month, SUM(amount) as total FROM sales GROUP BY month",
  "description": "월별 매출 집계 데이터"
}
```

### 대시보드 관리

#### GET /dashboard
대시보드 목록 조회

**응답**
```json
{
  "data": [
    {
      "id": "dashboard-uuid",
      "name": "메인 대시보드",
      "description": "주요 지표 모니터링",
      "is_public": false,
      "widget_count": 5,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### POST /dashboard
새 대시보드 생성

**요청**
```json
{
  "name": "신규 대시보드",
  "description": "설명",
  "is_public": false,
  "layout": {
    "widgets": []
  }
}
```

#### GET /dashboard/:id
대시보드 상세 조회

**응답**
```json
{
  "id": "dashboard-uuid",
  "name": "메인 대시보드",
  "description": "주요 지표 모니터링",
  "is_public": false,
  "layout": {
    "widgets": [
      {
        "id": "widget-uuid",
        "x": 0,
        "y": 0,
        "w": 6,
        "h": 4
      }
    ]
  },
  "widgets": [
    {
      "id": "widget-uuid",
      "name": "사용자 통계",
      "type": "line",
      "dataset_id": "dataset-uuid",
      "options": {}
    }
  ]
}
```

### 위젯 관리

#### POST /widget
새 위젯 생성

**요청**
```json
{
  "name": "매출 차트",
  "type": "line",
  "dataset_id": "dataset-uuid",
  "options": {
    "title": {
      "text": "월별 매출 추이"
    },
    "xAxis": {
      "type": "category",
      "data": ["month"]
    },
    "yAxis": {
      "type": "value"
    },
    "series": [{
      "data": ["total"],
      "type": "line"
    }]
  }
}
```

**지원 차트 타입**
- 기본 차트: `line`, `bar`, `pie`, `scatter`, `area`
- 고급 차트: `heatmap`, `treemap`, `sunburst`, `sankey`, `radar`
- 특수 차트: `gauge`, `liquidFill`, `wordCloud`, `candlestick`
- 3D 차트: `line3D`, `bar3D`, `scatter3D`

#### PUT /widget/:id
위젯 수정

**요청**
```json
{
  "name": "수정된 이름",
  "options": {
    "title": {
      "text": "새로운 제목"
    }
  }
}
```

### 공유 기능

#### POST /share-url
대시보드 공유 URL 생성

**요청**
```json
{
  "dashboard_id": "dashboard-uuid",
  "expires_at": "2024-12-31T23:59:59Z",
  "password": "optional-password"
}
```

**응답**
```json
{
  "id": "share-uuid",
  "url": "https://app.vanillameta.com/share/share-uuid",
  "expires_at": "2024-12-31T23:59:59Z",
  "has_password": true
}
```

### 템플릿 관리

#### GET /template
템플릿 목록 조회

**응답**
```json
{
  "data": [
    {
      "id": "template-uuid",
      "name": "판매 분석 템플릿",
      "description": "이커머스 판매 데이터 분석용",
      "category": "ecommerce",
      "thumbnail": "https://...",
      "widget_count": 8
    }
  ]
}
```

#### POST /dashboard/from-template
템플릿으로부터 대시보드 생성

**요청**
```json
{
  "template_id": "template-uuid",
  "name": "내 판매 분석 대시보드",
  "database_id": "db-uuid"
}
```

## 에러 코드 정의

### HTTP 상태 코드

| 코드 | 의미 | 설명 |
|------|------|------|
| 200 | OK | 요청 성공 |
| 201 | Created | 리소스 생성 성공 |
| 204 | No Content | 요청 성공 (응답 본문 없음) |
| 400 | Bad Request | 잘못된 요청 |
| 401 | Unauthorized | 인증 필요 |
| 403 | Forbidden | 권한 없음 |
| 404 | Not Found | 리소스를 찾을 수 없음 |
| 409 | Conflict | 리소스 충돌 |
| 422 | Unprocessable Entity | 유효성 검사 실패 |
| 429 | Too Many Requests | 요청 한도 초과 |
| 500 | Internal Server Error | 서버 오류 |
| 503 | Service Unavailable | 서비스 일시 중단 |

### 에러 응답 형식

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "유효성 검사 실패",
    "details": [
      {
        "field": "email",
        "message": "올바른 이메일 형식이 아닙니다"
      }
    ]
  },
  "timestamp": "2024-01-01T00:00:00Z",
  "path": "/v1/auth/login"
}
```

### 비즈니스 에러 코드

| 코드 | 설명 |
|------|------|
| AUTH_INVALID_CREDENTIALS | 잘못된 인증 정보 |
| AUTH_TOKEN_EXPIRED | 토큰 만료 |
| AUTH_TOKEN_INVALID | 유효하지 않은 토큰 |
| AUTH_REFRESH_TOKEN_EXPIRED | 리프레시 토큰 만료 |
| DB_CONNECTION_FAILED | 데이터베이스 연결 실패 |
| DB_QUERY_TIMEOUT | 쿼리 타임아웃 |
| DB_QUERY_ERROR | 쿼리 실행 오류 |
| DATASET_NOT_FOUND | 데이터셋을 찾을 수 없음 |
| DASHBOARD_NOT_FOUND | 대시보드를 찾을 수 없음 |
| WIDGET_NOT_FOUND | 위젯을 찾을 수 없음 |
| SHARE_URL_EXPIRED | 공유 URL 만료 |
| SHARE_URL_PASSWORD_REQUIRED | 비밀번호 필요 |
| QUOTA_EXCEEDED | 사용 한도 초과 |

## API 사용 예시

### 1. 완전한 인증 플로우

```javascript
// 로그인
const loginResponse = await fetch('https://api.vanillameta.com/v1/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});

const { access_token, refresh_token } = await loginResponse.json();

// API 호출
const dashboardsResponse = await fetch('https://api.vanillameta.com/v1/dashboard', {
  headers: {
    'Authorization': `Bearer ${access_token}`
  }
});

const dashboards = await dashboardsResponse.json();

// 토큰 갱신
const refreshResponse = await fetch('https://api.vanillameta.com/v1/auth/refresh', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    refresh_token: refresh_token
  })
});

const { access_token: new_access_token } = await refreshResponse.json();
```

### 2. 대시보드 생성 플로우

```javascript
// 1. 데이터베이스 연결 생성
const dbResponse = await fetch('https://api.vanillameta.com/v1/database', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Production DB',
    type: 'mysql',
    host: 'db.example.com',
    port: 3306,
    username: 'user',
    password: 'password',
    database: 'mydb'
  })
});

const { id: database_id } = await dbResponse.json();

// 2. 데이터셋 생성
const datasetResponse = await fetch('https://api.vanillameta.com/v1/dataset', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: '일별 매출',
    database_id: database_id,
    sql: 'SELECT DATE(created_at) as date, SUM(amount) as revenue FROM sales GROUP BY date'
  })
});

const { id: dataset_id } = await datasetResponse.json();

// 3. 위젯 생성
const widgetResponse = await fetch('https://api.vanillameta.com/v1/widget', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: '일별 매출 차트',
    type: 'line',
    dataset_id: dataset_id,
    options: {
      xAxis: { type: 'category', data: ['date'] },
      yAxis: { type: 'value' },
      series: [{ data: ['revenue'], type: 'line' }]
    }
  })
});

const { id: widget_id } = await widgetResponse.json();

// 4. 대시보드 생성
const dashboardResponse = await fetch('https://api.vanillameta.com/v1/dashboard', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: '매출 대시보드',
    widgets: [widget_id],
    layout: {
      widgets: [{
        id: widget_id,
        x: 0,
        y: 0,
        w: 12,
        h: 6
      }]
    }
  })
});
```

### 3. 페이지네이션 예시

```javascript
// Cursor 기반 페이지네이션
let hasMore = true;
let cursor = null;
const allDashboards = [];

while (hasMore) {
  const url = new URL('https://api.vanillameta.com/v1/dashboard');
  url.searchParams.append('limit', '20');
  if (cursor) {
    url.searchParams.append('cursor', cursor);
  }

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${access_token}`
    }
  });

  const { data, meta } = await response.json();
  allDashboards.push(...data);
  
  cursor = meta.next_cursor;
  hasMore = !!cursor;
}
```

### 4. 에러 처리 예시

```javascript
try {
  const response = await fetch('https://api.vanillameta.com/v1/database/test', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(connectionInfo)
  });

  if (!response.ok) {
    const error = await response.json();
    
    switch (error.error.code) {
      case 'DB_CONNECTION_FAILED':
        console.error('데이터베이스 연결 실패:', error.error.message);
        break;
      case 'AUTH_TOKEN_EXPIRED':
        // 토큰 갱신 로직
        break;
      default:
        console.error('알 수 없는 오류:', error);
    }
  }
} catch (err) {
  console.error('네트워크 오류:', err);
}
```

### 5. 스트리밍 응답 처리

```javascript
// 대용량 쿼리 결과 스트리밍
const response = await fetch('https://api.vanillameta.com/v1/database/123/query', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/x-ndjson'  // 스트리밍 응답 요청
  },
  body: JSON.stringify({
    sql: 'SELECT * FROM large_table',
    streaming: true
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    const row = JSON.parse(line);
    processRow(row);
  }
}
```