---
task_id: T06_S04
title: Lambda Layer 패키지 크기 최적화
status: planned
sprint_id: S04
type: performance
assigned_to: unassigned
last_updated: 2025-06-13T11:00:00Z
---

# Task: Lambda Layer 패키지 크기 최적화 (T06_S04)

## Task Description
Lambda Layer의 node_modules 크기를 최적화하여 배포 시간을 단축하고 콜드 스타트 성능을 개선한다. 불필요한 개발 의존성과 사용하지 않는 파일을 제거하여 패키지 크기를 최소화한다.

## Acceptance Criteria
- [ ] Lambda Layer 크기 30% 이상 감소
- [ ] 프로덕션 의존성만 포함하도록 최적화
- [ ] 불필요한 파일 제거 (문서, 테스트, 소스맵 등)
- [ ] Tree shaking 적용
- [ ] 배포 시간 50% 단축
- [ ] 최적화 스크립트 자동화

## Technical Notes
### 현재 상태
- Layer 크기: ~150MB
- 포함된 패키지: 모든 dependencies + devDependencies
- 콜드 스타트 시간: 3-5초

### 최적화 전략
1. Production 빌드 설정
   ```json
   // package.json
   {
     "scripts": {
       "build:layer": "npm ci --production",
       "optimize:layer": "node scripts/optimize-layer.js"
     }
   }
   ```

2. 불필요한 파일 제거 스크립트
   ```javascript
   // scripts/optimize-layer.js
   const patterns = [
     '**/*.md',
     '**/*.txt',
     '**/test/**',
     '**/tests/**',
     '**/*.map',
     '**/docs/**',
     '**/example/**',
     '**/examples/**',
     '**/.github/**'
   ];
   ```

3. Webpack 번들링 검토
   - 공통 모듈 추출
   - Tree shaking 설정
   - 압축 최적화

4. 패키지별 최적화
   - lodash → lodash-es
   - moment → dayjs
   - 사용하지 않는 locale 파일 제거

## Dependencies
- webpack (선택적)
- node-prune 또는 modclean
- 배포 스크립트 수정

## Risk & Mitigation
- **리스크**: 필요한 파일 삭제로 인한 런타임 오류
- **완화**: 철저한 테스트 및 단계적 적용
- **리스크**: 버전 불일치 문제
- **완화**: package-lock.json 엄격한 관리