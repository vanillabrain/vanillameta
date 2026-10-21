# YOLO Mode 자동화 가이드

## 🚀 개요

YOLO Mode는 VanillaMeta 백엔드 API의 안전한 개발을 위한 자동화된 검증 시스템입니다. 모든 단위 테스트가 통과하는 깨끗한 베이스라인을 바탕으로 빠른 개발과 안정성을 동시에 보장합니다.

## ✅ 베이스라인 테스트 현황

- **전체 단위 테스트**: 109/109 (100% 통과)
- **Controller 테스트**: 10/10 (100% 통과)
- **Service 테스트**: 13/13 (100% 통과)
- **기타 테스트**: 86/86 (100% 통과)

## 🛠️ 사용 가능한 명령어

### 1. 완전한 YOLO Mode 검증
```bash
yarn yolo
```
- 전체 코드 품질 검사 (ESLint + Prettier)
- 모든 단위 테스트 실행
- TypeScript 빌드 검증
- 테스트 커버리지 리포트 생성

### 2. 빠른 검증
```bash
yarn quick
```
- 핵심 린팅 검사
- Controller + Service 테스트만 실행
- 개발 중 빠른 피드백용

### 3. 베이스라인 테스트
```bash
yarn test:baseline
```
- 모든 단위 테스트 실행
- 베이스라인 상태 확인

### 4. 단위 테스트만
```bash
yarn test:unit
```
- Controller + Service 테스트 실행
- 통합 테스트 제외

## 📊 자동화 단계

### YOLO Mode (yarn yolo) 실행 단계:
1. **코드 품질 검사**: ESLint + Prettier
2. **단위 테스트**: Controller 및 Service 테스트
3. **전체 검증**: 모든 단위 테스트
4. **빌드 검증**: TypeScript 컴파일
5. **커버리지**: 테스트 커버리지 리포트

### 빠른 검증 (yarn quick) 실행 단계:
1. **린팅 검사**: 기본 코드 품질
2. **핵심 테스트**: Controller + Service만

## 🎯 사용 시나리오

### 일반 개발 플로우
```bash
# 1. 코드 수정 후 빠른 검증
yarn quick

# 2. 기능 완성 후 전체 검증
yarn yolo

# 3. 커밋 전 최종 확인
yarn test:baseline
```

### 디버깅 플로우
```bash
# 1. 특정 테스트만 실행
yarn test --testPathPattern="user.service"

# 2. 감시 모드로 개발
yarn test:watch

# 3. 수정 완료 후 검증
yarn quick
```

## 🔧 설정 및 확장

### 새로운 테스트 추가 시
1. `*.spec.ts` 파일로 테스트 작성
2. 의존성 주입 모킹 설정
3. `yarn quick`로 검증
4. `yarn yolo`로 전체 확인

### 커스텀 스크립트 추가
`scripts/` 디렉토리에 새로운 스크립트 추가 가능

## 📋 체크리스트

### PR 생성 전 필수 확인사항
- [ ] `yarn yolo` 통과
- [ ] 새로운 테스트 추가 (기능 추가 시)
- [ ] 커버리지 80% 이상 유지
- [ ] ESLint 오류 없음

### 배포 전 필수 확인사항
- [ ] 모든 단위 테스트 통과
- [ ] 빌드 성공
- [ ] 환경별 설정 확인

## 🚨 문제 해결

### 테스트 실패 시
1. 실패한 테스트 로그 확인
2. 의존성 모킹 문제인지 확인
3. 실제 비즈니스 로직 문제인지 확인
4. `yarn test:watch`로 실시간 디버깅

### 빌드 실패 시
1. TypeScript 컴파일 오류 확인
2. import/export 문제 확인
3. 타입 정의 문제 확인

### 린팅 실패 시
```bash
yarn lint  # 자동 수정 시도
yarn format  # 포맷팅 수정
```

## 📈 성능 지표

- **빠른 검증**: ~15초
- **전체 YOLO Mode**: ~2-3분
- **베이스라인 테스트**: ~30초
- **테스트 커버리지**: 목표 80% 이상

## 🤝 기여 가이드

1. 새로운 기능 개발 시 테스트 우선 작성
2. 기존 테스트 깨뜨리지 않기
3. YOLO Mode 통과 후 PR 생성
4. 복잡한 로직은 추가 테스트 케이스 작성

---

**YOLO Mode로 안전하고 빠른 개발을 경험하세요! 🚀**