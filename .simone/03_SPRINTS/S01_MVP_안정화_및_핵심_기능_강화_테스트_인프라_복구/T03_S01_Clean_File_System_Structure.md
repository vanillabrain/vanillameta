---
task_id: T03_S01
sprint_id: S01
task_name: Clean_File_System_Structure
title: 파일 시스템 구조 정리 및 디렉토리명 오타 수정
status: pending
priority: high
estimated_effort: 3 hours
assigned_to: developer
created_date: 2025-06-12T12:00:00Z
updated_date: 2025-06-12T12:00:00Z
---

# Task: 파일 시스템 구조 정리 및 디렉토리명 오타 수정 (T03_S01)

## 📋 Task Overview

### Description
프로젝트의 파일 시스템 구조를 정리하고 디렉토리명 오타를 수정하여 일관성 있는 코드베이스를 구축합니다. 특히 `entites` → `entities`, `tabel-query` → `table-query` 수정과 루트 디렉토리 정리를 진행합니다.

### Business Value
- 코드베이스의 가독성과 유지보수성 향상
- 일관된 네이밍 컨벤션 적용
- 개발자 경험 개선 및 혼란 방지
- 파일 시스템 오염 제거로 프로젝트 정리

### Acceptance Criteria
- [ ] 모든 디렉토리명 오타 수정 완료
- [ ] 관련 import 구문 모두 업데이트
- [ ] 루트 디렉토리 오염 파일 제거
- [ ] .gitignore 업데이트
- [ ] IDE 설정 파일 제거
- [ ] 테스트 실행 시 경로 오류 없음

## 🎯 Sprint Context

### Sprint Goal Alignment
테스트 인프라 복구를 위한 선행 작업으로, 올바른 파일 경로가 설정되어야 테스트가 정상적으로 실행됩니다.

### Dependencies
- 이 작업은 T01 (테스트 설정 복구) 및 T02 (테스트 의존성 주입) 작업의 기반이 됩니다
- 파일 경로 수정 후 모든 테스트가 재실행되어야 합니다

## 🔧 Technical Analysis

### 현재 상태 분석

#### 1. 디렉토리명 오타 현황
```
❌ 잘못된 경로:
- src/auth/entites/ → src/auth/entities/
- src/widget/tabel-query/ → src/widget/table-query/

✅ 올바른 경로:
- src/auth/entities/
- src/widget/table-query/
```

#### 2. 영향받는 파일 목록

**`entites` → `entities` 수정 영향**
```typescript
// 영향받는 파일들:
- src/auth/auth.module.ts
- src/auth/auth.service.ts
- src/dashboard/dashboard.module.ts
- src/login/login.module.ts
- src/login/login.service.ts
- src/share-url/share-url.module.ts
- src/user/user.module.ts
```

**`tabel-query` → `table-query` 수정 영향**
```typescript
// 영향받는 파일들:
- src/widget/widget.module.ts
- src/widget/widget.service.ts
- src/database/database.module.ts
- src/database/database.service.ts
- test/QTT-001/QTT-001-01.spec.ts
- test/QTT-002/QTT-002-01.spec.ts
- test/QTT-003/QTT-003-01.spec.ts
- test/QTT-006/QTT-006.spec.ts
```

#### 3. 루트 디렉토리 오염 파일
```
❌ 제거 대상:
- /workspace/vanillameta/identifier.sqlite
- /workspace/vanillameta/package-lock.json
- *.iml 파일들 (IDE 설정)
```

### 작업 계획

#### Phase 1: 디렉토리명 수정
1. **`entites` → `entities` 수정**
   ```bash
   # 안전한 디렉토리 이름 변경
   cd /workspace/vanillameta/backend-api/src/auth
   mv entites entities
   ```

2. **`tabel-query` → `table-query` 수정**
   ```bash
   # 안전한 디렉토리 이름 변경
   cd /workspace/vanillameta/backend-api/src/widget
   mv tabel-query table-query
   ```

#### Phase 2: Import 구문 업데이트
1. **`entites` 관련 import 수정**
   ```typescript
   // 변경 전
   import { RefreshToken } from './entites/refresh_token.entity';
   
   // 변경 후
   import { RefreshToken } from './entities/refresh_token.entity';
   ```

2. **`tabel-query` 관련 import 수정**
   ```typescript
   // 변경 전
   import { TableQueryService } from './tabel-query/table-query.service';
   import { TableQuery } from './tabel-query/entity/table-query.entity';
   
   // 변경 후
   import { TableQueryService } from './table-query/table-query.service';
   import { TableQuery } from './table-query/entity/table-query.entity';
   ```

#### Phase 3: 루트 디렉토리 정리
1. **오염 파일 제거**
   ```bash
   # 루트 디렉토리의 불필요한 파일 제거
   rm /workspace/vanillameta/identifier.sqlite
   rm /workspace/vanillameta/package-lock.json
   
   # IDE 설정 파일 제거
   find /workspace/vanillameta -name "*.iml" -delete
   ```

2. **`.gitignore` 업데이트**
   ```gitignore
   # IDE 파일
   *.iml
   .idea/
   
   # 데이터베이스 파일
   *.sqlite
   *.db
   
   # 패키지 파일 (하위 디렉토리에만)
   /package-lock.json
   /node_modules
   ```

## 🚨 Risk Assessment

### High Risk
- **Import 경로 누락**: 모든 import 구문이 정확히 업데이트되지 않으면 빌드 실패
- **테스트 경로 오류**: 테스트 파일의 import 경로도 함께 수정 필요

### Medium Risk
- **Git 히스토리**: 파일 이동으로 인한 히스토리 손실 가능성
- **IDE 캐시**: 일부 IDE에서 캐시 문제로 인한 오류 발생 가능

### Mitigation Strategies
1. **단계별 검증**: 각 단계 완료 후 빌드 및 테스트 실행
2. **백업 생성**: 작업 전 현재 상태 커밋
3. **전체 검색**: 모든 파일에서 경로 검색하여 누락 방지

## 📝 Implementation Steps

### Step 1: 백업 및 준비
```bash
# 현재 상태 커밋
git add .
git commit -m "백업: 파일 시스템 정리 작업 전 상태"

# 작업 브랜치 생성
git checkout -b develop-refactor-clean-filesystem
```

### Step 2: 디렉토리 이름 변경
```bash
# entites → entities
cd /workspace/vanillameta/backend-api/src/auth
mv entites entities

# tabel-query → table-query  
cd /workspace/vanillameta/backend-api/src/widget
mv tabel-query table-query
```

### Step 3: Import 구문 업데이트
```typescript
// 파일별 import 경로 수정
// 1. entites → entities 관련 파일들 수정
// 2. tabel-query → table-query 관련 파일들 수정
```

### Step 4: 루트 디렉토리 정리
```bash
# 오염 파일 제거
rm /workspace/vanillameta/identifier.sqlite
rm /workspace/vanillameta/package-lock.json

# IDE 파일 제거
find /workspace/vanillameta -name "*.iml" -delete
```

### Step 5: .gitignore 업데이트
```gitignore
# 추가할 항목들
*.iml
.idea/
*.sqlite
*.db
/package-lock.json
/node_modules
```

### Step 6: 검증 및 테스트
```bash
# 빌드 테스트
cd /workspace/vanillameta/backend-api
yarn build

# 테스트 실행
yarn test

# 린트 검사
yarn lint
```

## ✅ Definition of Done

### Functional Requirements
- [ ] `entites` → `entities` 디렉토리명 수정 완료
- [ ] `tabel-query` → `table-query` 디렉토리명 수정 완료
- [ ] 모든 관련 import 구문 업데이트 완료
- [ ] 루트 디렉토리 오염 파일 제거 완료
- [ ] .gitignore 업데이트 완료

### Technical Requirements
- [ ] 빌드 에러 없음 (`yarn build` 성공)
- [ ] 테스트 실행 시 경로 오류 없음
- [ ] 린트 검사 통과
- [ ] TypeScript 컴파일 에러 없음

### Quality Requirements
- [ ] 코드 리뷰 완료
- [ ] 변경사항 문서화
- [ ] Git 커밋 메시지 명확성

## 🔍 Testing Strategy

### Unit Tests
- 각 디렉토리 변경 후 해당 모듈 테스트 실행
- Import 오류 확인을 위한 컴파일 테스트

### Integration Tests
- 전체 애플리케이션 빌드 테스트
- 모든 모듈 간 의존성 정상 동작 확인

### Regression Tests
- 기존 기능 정상 동작 확인
- API 엔드포인트 정상 응답 확인

## 📊 Success Metrics

### Quantitative Metrics
- 빌드 성공률: 100%
- 테스트 실행 성공률: 100%
- 린트 오류 개수: 0개
- 경로 관련 오류 개수: 0개

### Qualitative Metrics
- 코드베이스 일관성 향상
- 개발자 경험 개선
- 프로젝트 구조 명확성 증대

## 📚 References

### Technical Documentation
- [NestJS 프로젝트 구조 가이드](https://docs.nestjs.com/first-steps)
- [TypeScript 모듈 해결 가이드](https://www.typescriptlang.org/docs/handbook/module-resolution.html)

### Internal Documentation
- `/workspace/vanillameta/CLAUDE.md` - 프로젝트 구조 설명
- `/workspace/vanillameta/backend-api/README.md` - 백엔드 설정 가이드

## 🏷️ Tags
`#filesystem` `#refactoring` `#cleanup` `#directory-structure` `#import-paths` `#maintenance`

## 📝 Notes

### Development Notes
- 작업 중 IDE 재시작 필요할 수 있음 (캐시 문제)
- Git에서 파일 이동을 추적하도록 `git mv` 사용 권장
- 변경 후 전체 프로젝트 검색으로 누락된 경로 확인 필요

### Future Considerations
- 향후 디렉토리 구조 변경 시 자동화 스크립트 고려
- 프리커밋 훅으로 네이밍 컨벤션 검증 고려
- 파일 이동 시 히스토리 보존 방법 개선

---
*Last Updated: 2025-06-12T12:00:00Z*
*Next Review: Sprint Retrospective*