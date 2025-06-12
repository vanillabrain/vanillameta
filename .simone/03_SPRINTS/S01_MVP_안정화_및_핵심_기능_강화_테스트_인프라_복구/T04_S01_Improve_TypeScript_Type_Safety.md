---
task_id: T04_S01
sprint_id: S01
task_name: Improve_TypeScript_Type_Safety
status: completed
priority: medium
last_updated: 2025-06-12T17:38:00Z
---

# T04_S01_Improve_TypeScript_Type_Safety

## 태스크 개요

VanillaMeta 프로젝트의 TypeScript 타입 안전성을 강화하여 런타임 오류를 줄이고 개발 생산성을 향상시킵니다. 주로 `Promise<any>` 사용을 제거하고 정확한 타입 정의를 구현합니다.

### 해결할 문제점
- API 서비스에서 `Promise<any>` 반환 타입 사용으로 인한 타입 안전성 부족
- 백엔드 서비스에서 `any` 타입 사용으로 인한 타입 체크 우회
- 프론트엔드-백엔드 간 타입 불일치 가능성
- TypeScript의 타입 추론 기능을 충분히 활용하지 못함

## 기술적 요구사항

### 1. 프론트엔드 API 서비스 타입 정의
**대상 파일**: `/workspace/vanillameta/frontend-web/src/api/`
- `authService.ts` - 11개 Promise<any> 사용
- `componentService.ts` - 4개 Promise<any> 사용
- `dashboardService.ts` - 5개 Promise<any> 사용
- `databaseService.ts` - 5개 Promise<any> 사용
- `datasetService.ts` - 7개 Promise<any> 사용
- `shareService.ts` - 3개 Promise<any> 사용
- `templateService.ts` - 3개 Promise<any> 사용
- `widgetService.ts` - 5개 Promise<any> 사용

### 2. 백엔드 서비스 타입 정의 강화
**대상 파일**: `/workspace/vanillameta/backend-api/src/`
- `auth/auth.service.ts` - payload: any 타입
- `database/database.service.ts` - Promise<any> 사용
- `connection/connection.service.ts` - any[] 반환 타입
- `dataset/dataset.service.ts` - any 타입 사용

### 3. 공통 타입 인터페이스 정의
**생성 필요**: `/workspace/vanillameta/frontend-web/src/types/`
- API 응답 타입 정의
- 엔티티 타입 정의
- 공통 인터페이스 정의

## 구현 계획

### Phase 1: 기본 타입 인터페이스 정의 (1-2일)

#### 1.1 API 응답 공통 타입 정의
```typescript
// /workspace/vanillameta/frontend-web/src/types/api.ts
export interface ApiResponse<T = any> {
  status: 'SUCCESS' | 'ERROR';
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  totalCount: number;
  page: number;
  limit: number;
}
```

#### 1.2 엔티티 타입 정의
```typescript
// /workspace/vanillameta/frontend-web/src/types/entities.ts
export interface User {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface Dashboard {
  id: string;
  title: string;
  description: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Database {
  id: string;
  name: string;
  engine: string;
  connectionConfig: Record<string, any>;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Dataset {
  id: string;
  name: string;
  query: string;
  databaseId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Widget {
  id: string;
  title: string;
  componentId: string;
  datasetId: string;
  option: string;
  createdAt: string;
  updatedAt: string;
}
```

#### 1.3 인덱스 파일 생성
```typescript
// /workspace/vanillameta/frontend-web/src/types/index.ts
export * from './api';
export * from './entities';
export * from './requests';
export * from './responses';
```

### Phase 2: API 서비스 타입 적용 (2-3일)

#### 2.1 Auth Service 타입 정의
```typescript
// /workspace/vanillameta/frontend-web/src/types/requests.ts
export interface SignInRequest {
  email: string;
  password: string;
}

export interface SignUpRequest {
  email: string;
  password: string;
  confirmPassword: string;
}

export interface UpdateUserRequest {
  email?: string;
  currentPassword?: string;
  newPassword?: string;
}
```

```typescript
// /workspace/vanillameta/frontend-web/src/types/responses.ts
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface UserInfoResponse {
  user: User;
}
```

```typescript
// 수정 예시: /workspace/vanillameta/frontend-web/src/api/authService.ts
import { ApiResponse, AuthResponse, UserInfoResponse } from '@/types';
import { SignInRequest, SignUpRequest, UpdateUserRequest } from '@/types';

const signin = (data: SignInRequest): Promise<ApiResponse<AuthResponse>> => 
  post(URL_LOGIN + URL_SIGN_IN, data);

const signout = (): Promise<ApiResponse<null>> => 
  post(URL_LOGIN + URL_SIGN_OUT);

const signup = (data: SignUpRequest): Promise<ApiResponse<AuthResponse>> => 
  post(URL_LOGIN + URL_SIGN_UP, data);

const updateUser = (data: UpdateUserRequest): Promise<ApiResponse<User>> => 
  patch(URL_USER + URL_CHANGE_USERINFO, data);

const getUserInfo = (): Promise<ApiResponse<UserInfoResponse>> => 
  get(URL_USER + URL_USER_INFO);

const refreshAccessToken = (): Promise<ApiResponse<AuthResponse>> => 
  post(URL_USER + URL_ACCESS_TOKEN);
```

#### 2.2 Dashboard Service 타입 정의
```typescript
// 수정 예시: /workspace/vanillameta/frontend-web/src/api/dashboardService.ts
import { ApiResponse, Dashboard } from '@/types';

export interface CreateDashboardRequest {
  title: string;
  description?: string;
}

export interface UpdateDashboardRequest {
  title?: string;
  description?: string;
}

const selectDashboardList = (): Promise<ApiResponse<Dashboard[]>> => 
  get(URL_DASHBOARD);

const selectDashboard = (id: string): Promise<ApiResponse<Dashboard>> => 
  get(URL_DASHBOARD + '/' + id);

const createDashboard = (data: CreateDashboardRequest): Promise<ApiResponse<Dashboard>> => 
  post(URL_DASHBOARD, data);

const updateDashboard = (id: string, data: UpdateDashboardRequest): Promise<ApiResponse<Dashboard>> => 
  put(URL_DASHBOARD + '/' + id, data);

const deleteDashboard = (id: string): Promise<ApiResponse<null>> => 
  del(URL_DASHBOARD + '/' + id);
```

### Phase 3: 백엔드 타입 안전성 강화 (2-3일)

#### 3.1 Auth Service 페이로드 타입 정의
```typescript
// /workspace/vanillameta/backend-api/src/auth/interfaces/jwt-payload.interface.ts
export interface JwtPayload {
  userId: string;
  email: string;
  id: string;
}

export interface AccessTokenPayload {
  accessKeyData: JwtPayload;
}
```

```typescript
// 수정 예시: /workspace/vanillameta/backend-api/src/auth/auth.service.ts
import { JwtPayload } from './interfaces/jwt-payload.interface';

async generateAccessToken(payload: JwtPayload): Promise<string> {
  const accessKeyData: JwtPayload = {
    userId: payload.userId,
    email: payload.email,
    id: payload.id,
  };
  
  const accessToken = await this.jwtService.sign(
    { accessKeyData },
    {
      secret: process.env.ACCESS_SECRET,
      expiresIn: `21600s`,
    },
  );
  return accessToken;
}
```

#### 3.2 Database Service 반환 타입 정의
```typescript
// /workspace/vanillameta/backend-api/src/database/interfaces/database-response.interface.ts
export interface DatabaseTypeResponse {
  status: ResponseStatus;
  data: DatabaseType[];
}

export interface QueryResult {
  columns: string[];
  rows: any[][];
  totalCount: number;
}

export interface QueryExecuteResponse {
  status: ResponseStatus;
  data: QueryResult;
}
```

### Phase 4: 타입 가드 및 유틸리티 함수 (1일)

#### 4.1 타입 가드 함수 생성
```typescript
// /workspace/vanillameta/frontend-web/src/utils/typeGuards.ts
import { ApiResponse } from '@/types';

export function isApiResponse<T>(obj: any): obj is ApiResponse<T> {
  return obj && typeof obj === 'object' && 'status' in obj && 'data' in obj;
}

export function isSuccessResponse<T>(response: ApiResponse<T>): boolean {
  return response.status === 'SUCCESS';
}
```

#### 4.2 타입 변환 유틸리티
```typescript
// /workspace/vanillameta/frontend-web/src/utils/typeConverters.ts
export function parseApiResponse<T>(response: any): ApiResponse<T> {
  if (!isApiResponse<T>(response)) {
    throw new Error('Invalid API response format');
  }
  return response;
}
```

### Phase 5: 기존 코드 마이그레이션 (3-4일)

#### 5.1 우선순위별 파일 수정
1. **High Priority**: 자주 사용되는 API 서비스
   - `authService.ts`
   - `dashboardService.ts`
   - `widgetService.ts`

2. **Medium Priority**: 핵심 기능 서비스
   - `databaseService.ts`
   - `datasetService.ts`

3. **Low Priority**: 기타 서비스
   - `componentService.ts`
   - `shareService.ts`
   - `templateService.ts`

## 검증 계획

### 1. 컴파일 타임 검증
```bash
# TypeScript 컴파일 오류 확인
cd /workspace/vanillameta/frontend-web
yarn build

cd /workspace/vanillameta/backend-api
yarn build
```

### 2. 타입 커버리지 확인
```bash
# 타입 안전성 검증 도구 실행 (필요시 추가)
npx type-coverage --strict
```

### 3. 런타임 검증
- API 호출 시 타입 검증 로직 추가
- 개발 환경에서 타입 불일치 감지

## 예상 효과

### 개발 생산성 향상
- IDE의 타입 추론 및 자동완성 기능 향상
- 컴파일 타임에 타입 관련 오류 사전 발견
- 리팩토링 시 안전성 확보

### 코드 품질 향상
- 런타임 오류 감소
- API 문서화 효과 (타입 정의가 문서 역할)
- 코드 가독성 및 유지보수성 향상

## 주의사항

### 1. 점진적 마이그레이션
- 한 번에 모든 파일을 수정하지 말고 점진적으로 적용
- 각 단계별로 테스트 실행하여 안정성 확인

### 2. 기존 코드 호환성
- 기존 컴포넌트에서 API 서비스 사용 부분 확인
- 타입 변경으로 인한 사이드 이펙트 최소화

### 3. 백엔드-프론트엔드 동기화
- 백엔드 엔티티 변경 시 프론트엔드 타입 정의도 함께 업데이트
- API 스펙 변경 시 양쪽 모두 반영

## 완료 기준

### 1. 필수 완료 사항
- [ ] 모든 API 서비스에서 `Promise<any>` 제거
- [ ] 백엔드 주요 서비스에서 `any` 타입 사용 최소화
- [ ] 공통 타입 인터페이스 정의 완료
- [ ] 타입 안전성 검증 통과

### 2. 부가 완료 사항
- [ ] 타입 가드 함수 구현
- [ ] 타입 변환 유틸리티 구현
- [ ] 개발 문서 업데이트

## 관련 문서 및 리소스

- [TypeScript 공식 문서](https://www.typescriptlang.org/docs/)
- [TypeScript Best Practices](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)
- VanillaMeta 프로젝트 구조 문서
- API 스펙 문서 (생성 예정)

---

**작성일**: 2025-01-06  
**예상 소요 시간**: 7-10일  
**우선순위**: Medium  
**의존성**: 없음