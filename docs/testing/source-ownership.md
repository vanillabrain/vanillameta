# 개인 소스 소유권 — SSBI-04 선택 조건

2026-10-13. 기준 `bb22030e` 이후 이 문서와 함께 커밋되는 diff. 단계0에서 발견한 일반 API 교차 접근을 수정했다. 기존 130개 카탈로그의 완료 집계는 변경하지 않는다. SSBI-04 전체는 부분 완료: 이번 소스 계보 조건은 PASS, 아직 없는 저장 보기와 전체 운영 SaaS 권한은 NOT_RUN이다.

## 명세와 결과

A가 업로드한 CSV: amount 10/20/30, 3행, SUM60. B는 별도 실제 로그인 사용자이며 B의 파일은 amount7이다. 서버4683/웹3483, Node24.21.0, 기존 격리 메타데이터 DB와 영속 파일 워커 재사용. DB 자체를 초기화하거나 기존 자료를 삭제하지 않았다.

| 선택 조건 | 기대 | 실제 결과 |
| --- | --- | --- |
| source/metric 단건·쿼리·평가·수정·삭제 | A 정상, B403 | PASS. A 지표 평가 result:[{value:60}]. B info/execute/evaluate/metric edit/source delete 모두403 |
| Dataset/Widget 참조 | 소스 소유권을 부모 계보로 검사 | PASS. A dataset95/widget160 생성201, B dataset/widget 단건과 타인 소스 dataset 생성403 |
| 혼합 ID | B 소스18과 A dataset95를 섞어도 차단 | PASS. database/data403. chart recommendation의 실제 dataset 검사는 단위 회귀로 확인 |
| 대시보드 참조 | 본인 dashboard에 타인 widget을 넣을 수 없음 | PASS. B create layout에 widget160 →403. 정상 위젯→대시보드→공유/임베드는 기존 core 회귀 PASS |
| AI 미리보기 | 타인 draft의 databaseId 차단, 모델 호출 이전 거절 | PASS. B preview source14→403. 모델 호출0. 기존 gpt-6-luna 설정 유지 |
| 소유자 위조 | 요청 ownerId가 JWT actor를 덮어쓸 수 없음 | PASS. B multipart ownerId=5로 upload한 source18은 B 조회200/A조회403 |
| 로컬 파일 별칭 | Web create/test/update로 서버 파일 경로 등록·변경 금지 | PASS. create DuckDB alias403, create/test/update 회귀 PASS. 파일 연결은 managed upload로 안내 |
| legacy | 기존 데이터 보존, NULL 소유자 자동 획득 금지 | PASS. additive migration 신규/기존 설치와 반복 실행 회귀. 기존 source13조회403. 읽기 전용 인벤토리 저장 |
| 목록·키보드 | A 지표만 A 목록에 표시, Enter 평가60 | PASS. A/B 실제 headed 화면 목록 분리. A 평가 버튼 focus→Enter→60 |
| 접근 오류·모바일 | 실패 폼 대신 안내, 복귀 가능, 390폭 overflow 없음 | PASS. 최초 빈 폼 FAIL 캡처 후 수정. role=alert 안내, Enter 취소→/data, 화면 가로 넘침 없음 |
| 파일 안내 | SQLite 선택→파일 업로드 안내→키보드로 파일 화면 | PASS. 390폭에서 업로드 버튼 Enter→/data/file |

API 결과 원문과 정확한 fixture ID는 외부 `api-results.json`을 기준으로 한다. 차단 판정은 HTTP403, 수치 판정은 응답 result60으로 확인했으며 스크린샷만으로 판정하지 않았다.

## 코드 검증

- BE 47개 스위트/406개 검사 PASS(소유권·개별 샘플·마이그레이션 신규12개 포함). 초기 실패한 단위 테스트 DI 구성은 새 권한 의존성을 제공하도록 수정 후 재검사했다.
- BE build, 변경 BE lint PASS(기존 unused 경고6). FE typecheck, 변경 FE lint, FE build PASS. 기존 Vite/TUI CSS 빌드 경고는 남아 있다.
- 공통 권한/저장/공유 영향 때문에 기존 핵심 E2E7개만 확대 실행: CSV 정확 집계/차트, 저장·재조회, 로그인, 위젯→dashboard→share/embed, smoke 모두 PASS(17.3초). product-flow의 오래된 sqlite3 업로드 fixture 선택을 현행 duckdb로 바로잡았다.
- FE 오류 안내 후 실제 변경 화면만 재확인했다. 다른 차트·Rill·LLM·전체130개 MD를 반복하지 않았다. 실제 VoiceOver 발화는 이번 범위에 포함하지 않았다.
- Aside 연결 불가 환경에서 앞서 사용자가 허용한 headed Chromium 브라우저를 이어 사용했다. 새 Playwright UI 스위트는 추가하지 않았다.

## 증빙

`/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/self-service-contract-audit/ownership-fix/`

- `api-results.json`, `backend-unit.log`, `legacy-readonly.json`, `core/.last-run.json`
- `owner-metric-60-keyboard.png`, `owner-metric-mobile.png`, `foreign-metric-hidden.png`
- 최초 실패 `foreign-source-denied.png`; 수정 후 `foreign-source-denied-fixed.png`, `foreign-source-denied-mobile.png`
- `managed-file-guide-mobile.png`

## 이관·운영 제한

Database.ownerId만 저장하고 Dataset/Metric/TableQuery/Widget은 부모 소스에서 권한을 상속한다. Dashboard는 UserMapping와 모든 연결 widget/analysisDefinition을 함께 검사한다. 목록/직접 ID/AI/템플릿 추천/공유 metadata와 shared dataset 조회에 같은 접근 서비스를 적용한다. 공유 token의 기존 만료·철회·linked dataset 제한을 유지한다.

**기존 NULL owner 소스와 그 하위 자산은 목록에서 숨기고 직접 접근을 차단한다. 파일과 정의는 보존한다.** 최초 로그인 사용자, dashboard가 참조한 첫 사용자, 클라이언트 ownerId로 임의 배정하지 않는다. 여러 사용자가 쓰던 전역 샘플을 한 사용자에게 넘기지 않는다. 신규 가입 샘플은 소스·데이터셋·위젯·물리 파일을 사용자별로 만들며 기존 전역 샘플을 재사용하지 않는다.

로컬 기존 DB는 시작 시 additive migration을 실행한다. 운영은 synchronize=false 및 배포 전에 명시적 TypeORM migration이 필요하다. 이미 ownerId가 있으면 다시 추가하지 않는다. 컬럼 삭제 rollback은 권한을 재개방하므로 지원하지 않는다.

읽기 전용 legacy 인벤토리:

```sh
cd backend-api
node scripts/source-ownership-audit.cjs /absolute/metadata.db
```

이 도구는 SQLite 메타데이터 전용이며 ID/owner/하위 자산 개수만 출력하고 연결 자격증명과 고객 행은 출력하지 않는다. 실제 owner 이관은 백업→원래 소유자 증거/모든 dashboard 참조 검토→정확한 source/user 매핑 확정→유지보수 시간에 제한된 트랜잭션 적용→A/B 직접 ID와 공유 재검사 순서다. 다중 소유 참조는 원본을 보존해 복제/정의 변경할 별도 이관 작업이 필요하다. 이번에는 인벤토리만 실행했으며 실제 기존 owner 배정은 하지 않았다.

기존 Metric.name은 아직 전역 unique다. 다른 사용자가 쓰는 이름으로 soft-delete 지표를 되살리는 요청은 차단하며, 사용자별 같은 표시 이름을 허용할 식별자/제약 이관은2A 정의 계약에서 보강한다.

공유 보기 저장, 팀 role, 전역 component/template 관리 권한, websocket 및 다중 고객 운영 전체 감사, large catalog 목록 N+1 최적화는 후속이다. 일반 메타데이터 API 격리를 전체 다중 고객 SaaS 출시 완료로 확대하지 않는다. 다음 제품 작업은 source profile·정의 snapshot과 SQL 없는2A 제작 화면이다.
