# 테스트 실행 및 일반적인 문제 수정

다음 지침을 탑 다운 방식으로 따르세요.

## 정확히 다음 4개 항목으로 TODO 생성

1. 테스트 스위트 실행
2. 결과 분석 및 문제 식별
3. 발견된 일반적인 문제 수정
4. 테스트 요약 제공

---

## 1 · 테스트 스위트 실행

### 먼저, 프로젝트의 Test Runner 감지:

1. **Python 프로젝트:**
   - `pyproject.toml`이 `[tool.poetry]`와 함께 존재하면: `poetry run pytest` 시도
   - `setup.py` 또는 `requirements.txt`가 있으면: `pytest` 또는 `python -m pytest` 시도
   - 커스텀 테스트 스크립트가 있으면 (예: `run_tests.py`, `run_dev.py`): 그것을 사용
   - 공통 플래그 추가: pytest용 `--tb=short`

2. **JavaScript/TypeScript 프로젝트:**
   - `package.json`이 존재하면: "scripts" 섹션에서 "test" 명령 확인
   - 일반적: `npm test`, `npm run test`, `yarn test`, `pnpm test`
   - 프레임워크 특정: `jest`, `vitest`, `mocha`

3. **기타 언어:**
   - Rust: `cargo test`
   - Go: `go test ./...`
   - Java: `mvn test` 또는 `gradle test`
   - Ruby: `bundle exec rspec` 또는 `rake test`
   - PHP: `composer test` 또는 `phpunit`

### 감지된 테스트 명령 실행:

- RUN: 적절한 테스트 명령 실행
- CAPTURE: 오류를 포함한 전체 출력 캡처
- NOTE: 실행 시간과 테스트 수 메모

**Test Runner가 발견되지 않으면:** 사용자에게 보고하고 올바른 테스트 명령을 요청하세요.

## 2 · 결과 분석 및 문제 식별

다음 순서로 일반적인 문제 확인:

### 언어별 문제:

**Python:**
- 누락된 __init__.py 파일 (임포트 오류, 테스트가 발견되지 않음)
- 임포트 경로 문제
- 픽스처 문제 (pytest)
- 가상 환경 문제

**JavaScript/TypeScript:**
- 모듈 해결 오류
- node_modules에 누락된 의존성
- Jest/Vitest 구성 문제
- TypeScript 컴파일 오류

**언어 공통:**
- 환경 변수 문제 (누락된 구성)
- 데이터베이스/외부 서비스 연결 오류
- 파일 경로 문제 (절대 vs 상대)
- 권한 문제

## 3 · 발견된 일반적인 문제 수정

**오직** 이러한 특정 문제만 자동으로 수정:

### Python 특정 수정:
- 필요한 곳에 빈 `__init__.py` 파일 생성
- 간단한 임포트 경로 문제 수정
- 필요한 경우 Python 경로에 누락된 테스트 디렉토리 추가

### JavaScript/TypeScript 수정:
- node_modules가 누락된 경우 `npm install` 실행
- jest.config.js에서 간단한 모듈 해결 수정
- 누락된 테스트 설정 파일 생성

### 일반적인 수정사항:
- 누락된 테스트 디렉토리를 생성합니다.
- 가능하다면 파일 권한을 수정하세요.
- 누락된 환경 변수를 식별하고 사용자에게 알리십시오.

**DO NOT** fix:
- 실제 테스트 로직 실패
- 비즈니스 로직 버그
- 복잡한 구성 문제
- 데이터베이스 스키마 문제
- 외부 서비스 의존성

## 4 · 테스트 요약 제공

간단한 요약 생성:

```
테스트 결과:
- 총합: X 테스트
- 통과: Y (Z%)
- 실패: A
- 건너뜀: B
- 시간: C 초

수정된 문제:
- [적용된 수정사항 목록]

발견된 문제 (수동 수정 필요):
- [주의가 필요한 문제 목록]

상태: PASSING | FAILING | BLOCKED
```

**IMPORTANT:** 간결하게 작성하세요. 이 명령은 빠르고 자세한 분석보다는 테스트 실행에 집중해야 합니다.