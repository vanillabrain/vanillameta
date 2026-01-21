# VanillaMeta 권한 관리 가이드

## 목차
1. [개요](#개요)
2. [역할 기반 접근 제어 (RBAC)](#역할-기반-접근-제어-rbac)
3. [시스템 역할](#시스템-역할)
4. [권한 구조](#권한-구조)
5. [API 엔드포인트 권한](#api-엔드포인트-권한)
6. [프론트엔드 권한 제어](#프론트엔드-권한-제어)
7. [권한 테스트](#권한-테스트)
8. [보안 정책](#보안-정책)
9. [트러블슈팅](#트러블슈팅)

## 개요

VanillaMeta는 역할 기반 접근 제어(RBAC) 시스템을 사용하여 사용자의 권한을 관리합니다. 각 사용자는 하나 이상의 역할을 가질 수 있으며, 각 역할은 특정 권한 집합을 포함합니다.

## 역할 기반 접근 제어 (RBAC)

### 핵심 개념

- **사용자 (User)**: 시스템에 로그인할 수 있는 개인
- **역할 (Role)**: 권한의 논리적 그룹
- **권한 (Permission)**: 특정 작업을 수행할 수 있는 권한
- **역할 레벨 (Role Level)**: 역할의 계층적 순서 (높을수록 더 많은 권한)

### 권한 상속

- 상위 레벨 역할은 하위 레벨 역할의 모든 권한을 상속받습니다
- Super Admin (레벨 100)은 모든 권한을 가집니다

## 시스템 역할

### 1. Super Admin (레벨: 100)
- **권한**: `*` (모든 권한)
- **설명**: 시스템의 모든 기능에 대한 완전한 접근 권한
- **주요 기능**:
  - 역할 생성/수정/삭제
  - 모든 사용자 관리
  - 시스템 설정 변경
  - 감사 로그 접근

### 2. Admin (레벨: 80)
- **권한**:
  - `admin.users.*` - 사용자 관리
  - `admin.roles.view` - 역할 조회
  - `admin.audit.view` - 감사 로그 조회
- **주요 기능**:
  - 사용자 생성/수정/삭제
  - 사용자 역할 할당
  - 감사 로그 조회

### 3. Manager (레벨: 60)
- **권한**:
  - `dashboard.*` - 대시보드 전체 권한
  - `reports.*` - 리포트 전체 권한
  - `datasource.view` - 데이터소스 조회
- **주요 기능**:
  - 대시보드 생성/수정/삭제
  - 리포트 생성/실행
  - 데이터소스 조회

### 4. Editor (레벨: 40)
- **권한**:
  - `dashboard.view` - 대시보드 조회
  - `dashboard.edit` - 대시보드 편집
  - `reports.view` - 리포트 조회
- **주요 기능**:
  - 대시보드 편집
  - 리포트 조회

### 5. Viewer (레벨: 20)
- **권한**:
  - `dashboard.view` - 대시보드 조회
  - `reports.view` - 리포트 조회
- **주요 기능**:
  - 대시보드 조회
  - 리포트 조회

## 권한 구조

### 권한 네이밍 컨벤션

권한은 점(.)으로 구분된 계층 구조를 따릅니다:

```
<module>.<resource>.<action>
```

예시:
- `admin.users.view` - Admin 모듈의 사용자 조회 권한
- `dashboard.widget.create` - 대시보드 위젯 생성 권한
- `reports.export.csv` - 리포트 CSV 내보내기 권한

### 와일드카드 권한

- `admin.*` - Admin 모듈의 모든 권한
- `admin.users.*` - 사용자 관리의 모든 권한
- `*` - 모든 권한 (Super Admin 전용)

## API 엔드포인트 권한

### Admin API

| 엔드포인트 | 메서드 | 필요 권한 | 설명 |
|-----------|--------|----------|------|
| `/admin/users` | GET | `admin.users.view` | 사용자 목록 조회 |
| `/admin/users` | POST | `admin.users.create` | 사용자 생성 |
| `/admin/users/:id` | PUT | `admin.users.update` | 사용자 수정 |
| `/admin/users/:id` | DELETE | `admin.users.delete` | 사용자 삭제 |
| `/admin/roles` | GET | `admin.roles.view` | 역할 목록 조회 |
| `/admin/roles` | POST | Super Admin only | 역할 생성 |
| `/admin/audit-logs` | GET | `admin.audit.view` | 감사 로그 조회 |
| `/admin/audit-logs/export` | GET | `admin.audit.export` | 감사 로그 내보내기 |

### Dashboard API

| 엔드포인트 | 메서드 | 필요 권한 | 설명 |
|-----------|--------|----------|------|
| `/dashboards` | GET | `dashboard.view` | 대시보드 목록 조회 |
| `/dashboards` | POST | `dashboard.create` | 대시보드 생성 |
| `/dashboards/:id` | PUT | `dashboard.edit` | 대시보드 수정 |
| `/dashboards/:id` | DELETE | `dashboard.delete` | 대시보드 삭제 |

### Report API

| 엔드포인트 | 메서드 | 필요 권한 | 설명 |
|-----------|--------|----------|------|
| `/reports` | GET | `reports.view` | 리포트 목록 조회 |
| `/reports` | POST | `reports.create` | 리포트 생성 |
| `/reports/:id/execute` | POST | `reports.execute` | 리포트 실행 |
| `/reports/:id/export` | GET | `reports.export` | 리포트 내보내기 |

## 프론트엔드 권한 제어

### 메뉴 권한

```typescript
// 권한 기반 메뉴 표시
const AdminMenu = () => {
  const { hasPermission } = usePermissions();
  
  if (!hasPermission('admin.*')) {
    return null;
  }
  
  return (
    <Menu>
      {hasPermission('admin.users.view') && (
        <MenuItem href="/admin/users">사용자 관리</MenuItem>
      )}
      {hasPermission('admin.roles.view') && (
        <MenuItem href="/admin/roles">역할 관리</MenuItem>
      )}
    </Menu>
  );
};
```

### 버튼 권한

```typescript
// 권한 기반 버튼 표시
const UserActions = ({ user }) => {
  const { hasPermission } = usePermissions();
  
  return (
    <ButtonGroup>
      {hasPermission('admin.users.update') && (
        <Button onClick={() => editUser(user)}>수정</Button>
      )}
      {hasPermission('admin.users.delete') && (
        <Button onClick={() => deleteUser(user)}>삭제</Button>
      )}
    </ButtonGroup>
  );
};
```

### 페이지 접근 제어

```typescript
// 권한 기반 라우트 보호
const ProtectedRoute = ({ permission, children }) => {
  const { hasPermission } = usePermissions();
  
  if (!hasPermission(permission)) {
    return <AccessDenied />;
  }
  
  return children;
};
```

## 권한 테스트

### 테스트 실행

```bash
# 모든 권한 테스트 실행
yarn test:permissions:all

# API 권한 테스트만 실행
yarn test:permissions

# 보안 취약점 테스트 실행
yarn test:security

# 권한 매트릭스 생성
yarn generate:permission-matrix
```

### 테스트 결과

테스트 결과는 `test/reports` 디렉토리에 생성됩니다:
- `permission-matrix.html` - 권한 매트릭스 HTML 리포트
- `permission-matrix.csv` - 권한 매트릭스 CSV 파일
- `test-report.html` - 테스트 결과 HTML 리포트
- `test-report.json` - 테스트 결과 JSON 데이터

## 보안 정책

### 1. 최소 권한 원칙
- 사용자에게는 작업 수행에 필요한 최소한의 권한만 부여
- 기본적으로 모든 접근은 거부되며, 명시적으로 허용된 권한만 사용 가능

### 2. 권한 분리
- 중요한 작업은 여러 권한으로 분리
- 예: 사용자 생성과 역할 할당은 별도 권한

### 3. 감사 로깅
- 모든 권한 관련 작업은 감사 로그에 기록
- 로그인/로그아웃, 권한 변경, 실패한 접근 시도 등

### 4. 토큰 보안
- JWT 토큰은 안전하게 서명되고 검증됨
- 토큰 만료 시간 설정
- Refresh 토큰을 통한 안전한 토큰 갱신

### 5. 입력 검증
- 모든 API 입력은 검증됨
- SQL/NoSQL 인젝션 방지
- XSS 공격 방지

## 트러블슈팅

### 권한 없음 오류 (403 Forbidden)

**문제**: API 호출 시 403 오류 발생

**해결 방법**:
1. 사용자의 현재 역할 확인
2. 해당 엔드포인트에 필요한 권한 확인
3. 역할에 필요한 권한이 있는지 확인
4. 토큰이 유효한지 확인

### 인증 실패 (401 Unauthorized)

**문제**: API 호출 시 401 오류 발생

**해결 방법**:
1. 토큰이 만료되지 않았는지 확인
2. 토큰이 올바른 형식인지 확인
3. Authorization 헤더가 올바르게 설정되었는지 확인

### 권한 변경이 반영되지 않음

**문제**: 권한 변경 후에도 이전 권한이 적용됨

**해결 방법**:
1. 토큰 갱신 (로그아웃 후 재로그인)
2. 캐시 초기화
3. 프론트엔드에서 권한 새로고침

### 권한 테스트 실패

**문제**: 권한 테스트 실행 시 실패

**해결 방법**:
1. 테스트 데이터베이스 초기화
2. 테스트 역할이 올바르게 생성되었는지 확인
3. 테스트 환경 변수 확인

## 권한 관리 모범 사례

1. **정기적인 권한 검토**: 주기적으로 사용자 권한을 검토하고 불필요한 권한 제거
2. **역할 기반 할당**: 개별 권한보다는 역할을 통해 권한 관리
3. **권한 문서화**: 새로운 권한 추가 시 문서 업데이트
4. **테스트 자동화**: 권한 변경 시 자동화된 테스트 실행
5. **감사 로그 모니터링**: 비정상적인 권한 사용 패턴 감지