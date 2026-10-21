# VanillaMeta 사용자 행동 분석 개인정보 처리 정책

## 1. 개요

VanillaMeta는 사용자에게 더 나은 서비스를 제공하기 위해 사용자 행동 데이터를 수집하고 분석합니다. 이 문서는 어떤 데이터를 수집하고, 어떻게 처리하며, 어떻게 보호하는지에 대한 정책을 설명합니다.

## 2. 수집하는 데이터

### 2.1 자동 수집 데이터

#### 사용 정보
- 페이지 방문 기록 및 체류 시간
- 클릭한 버튼 및 링크
- 스크롤 깊이
- 검색어 (개인정보 제외)

#### 기술 정보
- 브라우저 종류 및 버전
- 운영체제
- 화면 해상도
- 언어 설정
- IP 주소 (익명화됨)

#### 성능 메트릭
- 페이지 로딩 시간
- API 응답 시간
- 차트 렌더링 시간
- 오류 발생 정보

### 2.2 사용자 제공 데이터
- 계정 생성 시 제공한 정보
- 대시보드 및 위젯 생성 정보
- 데이터베이스 연결 정보 (자격증명 제외)

### 2.3 수집하지 않는 데이터
- 데이터베이스 자격증명
- 실제 쿼리 결과 데이터
- 개인 식별 가능 정보 (PII)
- 민감한 비즈니스 데이터

## 3. 데이터 사용 목적

수집된 데이터는 다음 목적으로만 사용됩니다:

1. **서비스 개선**
   - 사용자 경험 최적화
   - 기능 사용 패턴 분석
   - 버그 및 성능 문제 해결

2. **맞춤형 기능 제공**
   - 자주 사용하는 기능 추천
   - 개인화된 대시보드 템플릿

3. **통계 및 연구**
   - 집계된 사용 통계
   - 익명화된 사용 패턴 연구

## 4. 데이터 처리 방식

### 4.1 익명화 및 가명화

```javascript
// IP 주소 익명화 예시
function anonymizeIP(ip) {
  // IPv4: 마지막 옥텟 제거
  // 192.168.1.100 → 192.168.1.0
  
  // IPv6: 하위 64비트 제거
  // 2001:db8:85a3::8a2e:370:7334 → 2001:db8:85a3::
}

// 이메일 가명화 예시
function pseudonymizeEmail(email) {
  // user@example.com → u***@e***.com
}
```

### 4.2 데이터 암호화
- 전송 중 암호화: TLS 1.2 이상
- 저장 시 암호화: AWS KMS 사용
- 세션 ID: SHA-256 해싱

### 4.3 데이터 집계
- 개별 사용자 데이터는 집계하여 저장
- 최소 5명 이상의 데이터만 통계에 포함

## 5. 데이터 보존 정책

| 데이터 유형 | 보존 기간 | 삭제 방법 |
|------------|----------|-----------|
| 실시간 이벤트 | 24시간 | 자동 삭제 |
| 집계된 일일 통계 | 90일 | 자동 아카이빙 |
| 월간 요약 | 1년 | 수동 검토 후 삭제 |
| 성능 메트릭 | 30일 | 자동 삭제 |
| 오류 로그 | 7일 | 자동 삭제 |

### 5.1 데이터 삭제 프로세스

```sql
-- 90일 이상된 상세 이벤트 삭제
DELETE FROM analytics_events 
WHERE created_at < NOW() - INTERVAL '90 days';

-- 집계 데이터로 변환
INSERT INTO analytics_summary (date, metric, value)
SELECT 
  DATE(created_at),
  event_type,
  COUNT(*)
FROM analytics_events
WHERE created_at < NOW() - INTERVAL '90 days'
GROUP BY DATE(created_at), event_type;
```

## 6. 사용자 권리

### 6.1 열람권
사용자는 수집된 자신의 데이터를 열람할 수 있습니다.

### 6.2 정정권
잘못된 정보의 수정을 요청할 수 있습니다.

### 6.3 삭제권
데이터 삭제를 요청할 수 있습니다.

### 6.4 처리정지권
데이터 처리 중단을 요청할 수 있습니다.

### 6.5 동의 철회권
언제든지 데이터 수집 동의를 철회할 수 있습니다.

## 7. 동의 관리

### 7.1 동의 유형

```typescript
interface ConsentTypes {
  functional: boolean;    // 필수 기능 (항상 true)
  analytics: boolean;     // 사용 분석
  performance: boolean;   // 성능 모니터링
}
```

### 7.2 동의 철회 방법
1. 설정 페이지에서 변경
2. 브라우저 쿠키 삭제
3. 고객지원 요청

## 8. 데이터 보안

### 8.1 접근 제어
- 역할 기반 접근 제어 (RBAC)
- 최소 권한 원칙
- 정기적인 접근 권한 검토

### 8.2 감사 로그
- 모든 데이터 접근 기록
- 변경 사항 추적
- 이상 행동 감지

### 8.3 보안 조치
- 정기적인 보안 패치
- 침입 탐지 시스템
- DDoS 방어

## 9. 제3자 공유

### 9.1 공유하지 않는 원칙
개인 데이터는 제3자와 공유하지 않습니다.

### 9.2 예외 사항
- 법적 요구사항
- 사용자 명시적 동의
- 익명화된 집계 데이터

## 10. 국제 데이터 전송

### 10.1 데이터 위치
- 주 데이터센터: AWS 서울 리전
- 백업: AWS 도쿄 리전

### 10.2 전송 시 보호
- 암호화된 채널 사용
- 적절성 평가 실시

## 11. 아동 개인정보 보호

- 14세 미만 아동의 서비스 이용 제한
- 부모 동의 없이 아동 정보 수집 금지

## 12. 개인정보 보호 책임자

- 담당자: [이름]
- 이메일: privacy@vanillameta.com
- 전화: 02-XXXX-XXXX

## 13. 정책 변경

### 13.1 변경 통지
- 중요 변경 시 30일 전 통지
- 이메일 및 서비스 내 알림

### 13.2 변경 이력
- 2025-06-15: 초안 작성
- [날짜]: [변경 내용]

## 14. 기술적 구현

### 14.1 PII 자동 제거

```typescript
class PIISanitizer {
  private patterns = {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    phone: /\d{2,4}-\d{3,4}-\d{4}/g,
    ssn: /\d{6}-\d{7}/g,
    creditCard: /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g,
  };

  sanitize(text: string): string {
    let sanitized = text;
    
    for (const [type, pattern] of Object.entries(this.patterns)) {
      sanitized = sanitized.replace(pattern, `[${type.toUpperCase()}_REMOVED]`);
    }
    
    return sanitized;
  }
}
```

### 14.2 데이터 최소화

```typescript
class DataMinimizer {
  minimizeUserData(user: User): MinimizedUser {
    return {
      id: hash(user.id),
      createdAt: user.createdAt,
      // 이름, 이메일 등 개인정보 제외
    };
  }
  
  minimizeEventData(event: Event): MinimizedEvent {
    return {
      type: event.type,
      timestamp: event.timestamp,
      // URL 파라미터, 폼 데이터 등 제외
    };
  }
}
```

## 15. 준수 사항

- 개인정보보호법 (한국)
- GDPR (유럽 사용자)
- CCPA (캘리포니아 사용자)

## 16. 연락처

### 개인정보 관련 문의
- 이메일: privacy@vanillameta.com
- 우편: 서울특별시 [주소]

### 일반 문의
- 이메일: support@vanillameta.com
- 전화: 1588-XXXX

---

이 정책은 2025년 6월 15일부터 시행됩니다.