---
sprint_folder_name: S01_MVP_안정화_및_핵심_기능_강화_테스트_인프라_복구
sprint_sequence_id: S01
milestone_id: M01
title: 테스트 인프라 복구 및 코드베이스 정리
status: planned
goal: 프로젝트의 테스트 인프라를 복구하고 코드베이스를 정리하여 안정적인 개발 환경을 확보한다.
last_updated: 2025-06-12T12:00:00Z
---

# Sprint: 테스트 인프라 복구 및 코드베이스 정리 (S01)

## Sprint Goal
프로젝트의 테스트 인프라를 복구하고 코드베이스를 정리하여 안정적인 개발 환경을 확보한다.

## Scope & Key Deliverables
- 누락된 테스트 설정 파일 추가 (`test-connect-info.json`)
- 테스트 의존성 주입 문제 해결 (모든 service.spec.ts 파일)
- 디렉토리명 오타 수정 (`entites` → `entities`, `tabel-query` → `table-query`)
- 루트 디렉토리 정리 (identifier.sqlite, package-lock.json 제거)
- IDE 파일 제거 및 .gitignore 업데이트
- 기본 테스트 커버리지 20% 달성
- TypeScript 타입 안전성 개선 (Promise<any> 제거)

## Definition of Done (for the Sprint)
- 모든 테스트가 에러 없이 실행 가능
- 테스트 통과율 80% 이상
- 파일 시스템 정리 완료
- 의미있는 테스트 커버리지 20% 이상
- CI/CD에서 테스트 자동 실행 설정

## Sprint Tasks

### T01: 누락된 테스트 설정 파일 추가
- **파일**: [T01_S01_Add_Missing_Test_Config_Files.md](./T01_S01_Add_Missing_Test_Config_Files.md)
- **목표**: `test-connect-info.json` 파일 생성으로 QTT-001 테스트 오류 해결
- **우선순위**: HIGH - 모든 테스트 실행의 전제 조건

### T02: 테스트 의존성 주입 문제 해결
- **파일**: [T02_S01_Fix_Test_Dependency_Injection.md](./T02_S01_Fix_Test_Dependency_Injection.md) 
- **목표**: 모든 service.spec.ts 파일의 의존성 주입 오류 수정
- **우선순위**: HIGH - 단위 테스트 실행 가능하게 함

### T03: 파일 시스템 구조 정리
- **파일**: [T03_S01_Clean_File_System_Structure.md](./T03_S01_Clean_File_System_Structure.md)
- **목표**: 디렉토리명 오타 수정 및 루트 디렉토리 정리
- **우선순위**: MEDIUM - 코드베이스 일관성 확보

### T04: TypeScript 타입 안전성 개선  
- **파일**: [T04_S01_Improve_TypeScript_Type_Safety.md](./T04_S01_Improve_TypeScript_Type_Safety.md)
- **목표**: Promise<any> 제거 및 타입 정의 강화
- **우선순위**: MEDIUM - 코드 품질 향상

### T05: 의미있는 테스트 커버리지 구축
- **파일**: [T05_S01_Establish_Meaningful_Test_Coverage.md](./T05_S01_Establish_Meaningful_Test_Coverage.md)
- **목표**: 형식적 테스트를 실제 비즈니스 로직 검증 테스트로 전환
- **우선순위**: HIGH - 20% 의미있는 커버리지 달성

## Task Dependencies
```
T03 (파일 시스템 정리) → T01 (테스트 설정) → T02 (의존성 주입) → T05 (테스트 커버리지)
                      ↘ T04 (타입 안전성)
```

## Notes / Retrospective Points
- 이 스프린트는 다른 모든 작업의 선행 조건
- 테스트 인프라 없이는 안정적인 개발 불가능
- 프로젝트 리뷰에서 가장 심각한 차단 이슈로 식별됨
- 모든 작업 완료 후 CI/CD 파이프라인에서 테스트 자동 실행 설정 필요