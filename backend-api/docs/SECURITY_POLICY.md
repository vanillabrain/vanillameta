# VanillaMeta 보안 정책

## 목차
1. [개요](#개요)
2. [인증 및 권한 부여](#인증-및-권한-부여)
3. [데이터 보안](#데이터-보안)
4. [API 보안](#api-보안)
5. [감사 및 모니터링](#감사-및-모니터링)
6. [보안 취약점 대응](#보안-취약점-대응)
7. [보안 체크리스트](#보안-체크리스트)
8. [인시던트 대응](#인시던트-대응)

## 개요

이 문서는 VanillaMeta 플랫폼의 보안 정책과 가이드라인을 정의합니다. 모든 개발자와 운영자는 이 정책을 준수해야 합니다.

## 인증 및 권한 부여

### JWT 토큰 관리

#### 토큰 생성
- **알고리즘**: HS256 (HMAC with SHA-256)
- **액세스 토큰 만료**: 1시간
- **리프레시 토큰 만료**: 7일
- **시크릿 키**: 환경 변수로 관리, 최소 256비트

```typescript
// 토큰 페이로드 구조
interface TokenPayload {
  id: number;
  email: string;
  roles: string[];
  permissions: string[];
  iat: number;
  exp: number;
}
```

#### 토큰 보안 규칙
1. 토큰은 HTTPS를 통해서만 전송
2. 토큰은 localStorage가 아닌 httpOnly 쿠키에 저장 (XSS 방지)
3. 민감한 정보는 토큰에 포함하지 않음
4. 토큰 서명 검증은 모든 요청에서 수행

### 비밀번호 정책

#### 비밀번호 요구사항
- 최소 8자 이상
- 대문자, 소문자, 숫자, 특수문자 중 3가지 이상 포함
- 일반적인 비밀번호 사전 검사
- 이전 비밀번호 재사용 금지 (최근 5개)

#### 비밀번호 저장
- SHA-512 해싱 사용
- Salt 없음 (레거시 호환성)
- 향후 bcrypt 또는 Argon2로 마이그레이션 계획

### 계정 보안

#### 로그인 보안
- 5회 연속 실패 시 15분간 계정 잠금
- 비정상적인 로그인 패턴 감지 및 알림
- 2단계 인증 지원 (계획 중)

#### 세션 관리
- 동시 세션 제한 (사용자당 최대 5개)
- 유휴 시간 초과 (30분)
- 로그아웃 시 토큰 무효화

## 데이터 보안

### 데이터 암호화

#### 전송 중 암호화
- 모든 API 통신은 TLS 1.2 이상 사용
- HSTS (HTTP Strict Transport Security) 활성화
- 인증서 피닝 구현 (모바일 앱)

#### 저장 시 암호화
- 민감한 데이터는 AES-256으로 암호화
- 데이터베이스 암호화 (AWS RDS 암호화 사용)
- 백업 데이터 암호화

### 데이터 접근 제어

#### 최소 권한 원칙
```typescript
// 데이터 접근 레벨
enum DataAccessLevel {
  PUBLIC = 'public',        // 모든 사용자
  AUTHENTICATED = 'auth',   // 로그인한 사용자
  OWNER = 'owner',         // 데이터 소유자
  ADMIN = 'admin',         // 관리자
}
```

#### 데이터 마스킹
- PII (개인식별정보) 자동 마스킹
- 로그 및 감사 기록에서 민감 정보 제거
- API 응답에서 불필요한 필드 제거

## API 보안

### 입력 검증

#### 검증 규칙
```typescript
// DTO 검증 예시
export class CreateUserDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  userId: string;

  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  password: string;
}
```

#### SQL 인젝션 방지
- 모든 쿼리는 파라미터화된 쿼리 사용
- ORM (TypeORM) 사용으로 자동 이스케이핑
- Raw 쿼리 사용 최소화

```typescript
// 안전한 쿼리 예시
const users = await this.userRepository
  .createQueryBuilder('user')
  .where('user.email = :email', { email: userInput })
  .getMany();
```

### Rate Limiting

#### API 제한 정책
| 엔드포인트 타입 | 제한 | 윈도우 |
|---------------|------|--------|
| 인증 API | 5 요청 | 1분 |
| 일반 API | 100 요청 | 1분 |
| 데이터 조회 API | 1000 요청 | 1시간 |
| 파일 업로드 | 10 요청 | 1시간 |

#### 구현 예시
```typescript
@UseGuards(RateLimitGuard)
@RateLimit({ points: 5, duration: 60 })
@Post('login')
async login(@Body() loginDto: LoginDto) {
  // 로그인 로직
}
```

### CORS 정책

```typescript
// CORS 설정
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      'https://app.vanillameta.com',
      'https://admin.vanillameta.com',
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
```

## 감사 및 모니터링

### 감사 로그

#### 로깅 대상
- 모든 인증 시도 (성공/실패)
- 권한 변경
- 데이터 생성/수정/삭제
- 시스템 설정 변경
- 비정상적인 접근 패턴

#### 로그 보존
- 일반 로그: 90일
- 보안 관련 로그: 1년
- 규정 준수 로그: 7년

### 실시간 모니터링

#### 모니터링 메트릭
- 실패한 로그인 시도
- 비정상적인 API 호출 패턴
- 권한 상승 시도
- 대량 데이터 접근
- 시스템 리소스 사용량

#### 알림 규칙
```typescript
// 보안 알림 트리거
const securityAlerts = {
  failedLogins: {
    threshold: 10,
    window: '5m',
    action: 'notify-security-team',
  },
  suspiciousActivity: {
    patterns: ['bulk-download', 'permission-escalation'],
    action: 'block-and-notify',
  },
};
```

## 보안 취약점 대응

### 취약점 스캔

#### 자동화된 스캔
- 의존성 취약점 스캔 (npm audit, Snyk)
- 코드 정적 분석 (SonarQube)
- 컨테이너 이미지 스캔
- 인프라 설정 검사

#### 수동 보안 검토
- 코드 리뷰 시 보안 체크리스트 확인
- 정기적인 침투 테스트
- 보안 감사

### 패치 관리

#### 패치 우선순위
| 심각도 | 대응 시간 | 조치 |
|--------|----------|------|
| Critical | 24시간 | 즉시 패치 및 배포 |
| High | 7일 | 다음 릴리스에 포함 |
| Medium | 30일 | 계획된 유지보수 |
| Low | 90일 | 정기 업데이트 |

## 보안 체크리스트

### 개발 단계
- [ ] 입력 검증 구현
- [ ] 출력 인코딩 적용
- [ ] 인증/권한 검사
- [ ] 민감 정보 로깅 방지
- [ ] 보안 헤더 설정
- [ ] HTTPS 강제
- [ ] 에러 메시지 검토

### 배포 전
- [ ] 의존성 취약점 검사
- [ ] 환경 변수 확인
- [ ] 데이터베이스 권한 검토
- [ ] API 권한 테스트
- [ ] 보안 설정 검증
- [ ] 백업 절차 확인

### 운영 중
- [ ] 로그 모니터링
- [ ] 보안 패치 적용
- [ ] 접근 권한 검토
- [ ] 보안 알림 확인
- [ ] 백업 무결성 검증

## 인시던트 대응

### 대응 절차

#### 1. 탐지 및 분석
- 인시던트 유형 파악
- 영향 범위 평가
- 증거 수집 및 보존

#### 2. 차단 및 격리
- 영향받은 시스템 격리
- 추가 피해 방지
- 임시 해결책 적용

#### 3. 제거 및 복구
- 악성 코드/설정 제거
- 시스템 복구
- 정상 운영 재개

#### 4. 사후 분석
- 근본 원인 분석
- 재발 방지 대책 수립
- 프로세스 개선

### 연락처

#### 보안 팀
- Email: security@vanillameta.com
- 긴급 연락처: +82-10-XXXX-XXXX
- Slack: #security-incident

#### 외부 지원
- 보안 컨설팅: [컨설팅사 정보]
- 법률 자문: [법무법인 정보]
- 포렌식: [포렌식 업체 정보]

## 규정 준수

### 준수 규정
- 개인정보보호법 (PIPA)
- 정보통신망법
- GDPR (EU 고객 대상)
- SOC 2 Type II (계획 중)

### 정기 감사
- 내부 보안 감사: 분기별
- 외부 보안 감사: 연간
- 침투 테스트: 반기별

---

**마지막 업데이트**: 2025-06-24
**다음 검토일**: 2025-09-24
**문서 버전**: 1.0