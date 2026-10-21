# Field Selection API Guide

## 개요

Field Selection 기능을 사용하면 API 응답에서 필요한 필드만 선택적으로 받을 수 있습니다. 이를 통해 네트워크 트래픽을 줄이고 API 응답 속도를 개선할 수 있습니다.

## 사용 방법

### 기본 사용법

쿼리 파라미터 `fields`를 사용하여 원하는 필드를 지정합니다:

```
GET /api/v1/dashboard?fields=id,title,description
```

### 중첩된 필드 선택

점(.) 표기법을 사용하여 중첩된 객체의 필드를 선택할 수 있습니다:

```
GET /api/v1/dashboard?fields=id,title,widgets.id,widgets.name,widgets.type
```

## 적용된 엔드포인트

### Dashboard API

- **GET /dashboard** - 대시보드 목록
  - 허용 필드: `id`, `title`, `description`, `createdAt`, `updatedAt`, `widgets.id`, `widgets.name`, `widgets.type`, `widgets.order`
  - 제외 필드: `widgets.config.queries`, `widgets.data`

- **GET /dashboard/:id** - 대시보드 상세
  - 허용 필드: 위 목록 + `widgets.config.xAxis`, `widgets.config.yAxis`, `widgets.config.groupBy`, `widgets.dataset.id`, `widgets.dataset.name`

### User API

- **GET /user/userinfo** - 사용자 정보
  - 허용 필드: `id`, `userId`, `email`, `createdAt`, `updatedAt`
  - 제외 필드: `password`, `jwtId`

- **GET /user/get-dashboard** - 사용자 대시보드 목록
  - 허용 필드: `id`, `title`, `description`, `createdAt`, `updatedAt`

### Widget API

- **GET /widget** - 위젯 목록
  - 허용 필드: `id`, `title`, `description`, `componentId`, `datasetType`, `datasetId`, `option`, `createdAt`, `updatedAt`
  - 제외 필드: `delYn`

- **GET /widget/:id** - 위젯 상세
  - 사전 정의된 필드셋: `widgetWithConfig`

### Dataset API

- **GET /dataset** - 데이터셋 목록
  - 사전 정의된 필드셋: `datasetMeta`

- **GET /dataset/:id** - 데이터셋 상세
  - 허용 필드: `id`, `title`, `databaseId`, `query`, `createdAt`, `updatedAt`

### Database API

- **GET /database** - 데이터베이스 목록
  - 사전 정의된 필드셋: `connectionBasic`

- **GET /database/:id** - 데이터베이스 상세
  - 허용 필드: `id`, `name`, `description`, `engine`, `type`, `timezone`, `createdAt`, `updatedAt`, `tables`, `datasets`
  - 제외 필드: `connectionConfig`

## 사전 정의된 필드셋

다음과 같은 사전 정의된 필드셋을 사용할 수 있습니다:

- `userBasic`: 기본 사용자 정보
- `dashboardMeta`: 대시보드 메타데이터
- `widgetBasic`: 기본 위젯 정보
- `widgetWithConfig`: 설정을 포함한 위젯 정보
- `datasetMeta`: 데이터셋 메타데이터
- `connectionBasic`: 기본 데이터베이스 연결 정보

## 보안 고려사항

- 민감한 필드(password, token, apiKey 등)는 자동으로 제외됩니다
- 허용되지 않은 필드를 요청하면 무시됩니다
- 최대 중첩 깊이는 5로 제한됩니다

## 예제

### 대시보드 목록 조회 (필요한 필드만)
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://api.example.com/dashboard?fields=id,title,createdAt"
```

응답:
```json
[
  {
    "id": 1,
    "title": "Sales Dashboard",
    "createdAt": "2024-01-01T00:00:00Z"
  },
  {
    "id": 2,
    "title": "Marketing Dashboard",
    "createdAt": "2024-01-02T00:00:00Z"
  }
]
```

### 위젯 정보와 함께 대시보드 조회
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://api.example.com/dashboard/1?fields=id,title,widgets.id,widgets.name"
```

응답:
```json
{
  "id": 1,
  "title": "Sales Dashboard",
  "widgets": [
    {
      "id": 101,
      "name": "Revenue Chart"
    },
    {
      "id": 102,
      "name": "Customer Growth"
    }
  ]
}
```

## 성능 최적화

- 필요한 필드만 요청하여 응답 크기를 줄일 수 있습니다
- 데이터베이스 쿼리 최적화와 연동되어 불필요한 JOIN을 줄입니다
- 대용량 목록 조회 시 특히 효과적입니다

## 디버깅

개발 환경에서는 다음 응답 헤더를 통해 필드 선택 정보를 확인할 수 있습니다:

- `X-Field-Selection-Applied`: 필드 선택 적용 여부
- `X-Field-Selection-Fields`: 적용된 필드 목록
- `X-Field-Selection-Reduction`: 데이터 크기 감소율
- `X-Original-Size`: 원본 데이터 크기
- `X-Selected-Size`: 선택된 데이터 크기