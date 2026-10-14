# 탐색 조건 개인 저장·복원

기준 `codex/self-service-next-20261014`, `db584d6e` + 작업 diff. 기존 통과한 숫자 범위·정렬 집계는 재사용하고 이번 영속 상태와 복원 조건만 실행한다. AI codex/gpt-6-luna 설정 유지, 이 경로 모델 호출0. VoiceOver BLOCKED 유지.

| ID | 조작 | 기대 결과 |
| --- | --- | --- |
| EXP-VIEW-01 | 원본 Rill1391572행 source3에서 지표·차원·범위1~10·UTC Sep10~11·일·이전비교·증감률asc·원본 펼침 저장 | POST201, state whitelist만 저장. KPI56663800·이전29059200·현재126090행, Device Type첫 Connected Device−66.6666667% |
| EXP-VIEW-02 | 전체 새로고침 후 저장 보기 열기→이름으로 불러오기 | 모든 선택과 원본 펼침 복원, page0. 최신catalog sourceRevision으로 조회. 저장 전 결과/행은 metadata에 보관하지 않음 |
| EXP-VIEW-03 | 값 필터+숫자 범위 및 지표/순위 지표 선택 순서·전체기간/빈차원·불완전날짜 | 구조·타입·선택 순서 유지. 미적용/불완전 기간·조회 실패·지표0에서는 저장 차단. 기존 페이지/소스/보기 손상 없음 |
| EXP-VIEW-04 | 소유자 변경/다른 소스·계정·공유 토큰·익명, 상태/이름/20개한도·migration | 매 요청 소유권·ID범위검사, 잘못된 입력400/권한403/없는ID404. 기존 dashboard보기 보존. SQLite20개동시한도·실패후queue복구 |
| EXP-VIEW-05 | 지표/열 정의가 변경된 보기 열기·삭제·카탈로그갱신 | load409, 현재 조건과 기존 보기 유지·재조회 안내. stale보기도삭제가능. 정상 데이터 파일 게시/행·날짜경계만 변경 시 최신 데이터로 복원 |
| EXP-VIEW-06 | 목록/불러오기503·조건변경 중 지연응답·중복클릭 | 실패한 복원은 현재조건보존, 재시도·상태변경중응답차단·자원변경시abort. 삭제취소/확인은보기만삭제 |
| EXP-VIEW-07 |1440/390px, Tab/Enter 저장·복원·삭제 확인/취소 | 문서 가로넘침0·레이블·상태/오류·안전한삭제대화상자·초점복귀. 실제VoiceOver 제외 |

정답은 이전 `explore-range-sort.md`의 같은 원본 SHA256 및 독립 Parquet SQL을 재사용한다. 서버 저장소는 기존 metadata `personal_view`에 nullable sourceId와 소스/사용자 index를 추가한다. 대시보드 보기는 기존 dashboardId와 분리한다. 소스별·사용자별20개, 이름1~80자. 지표/열 정의 해시는 원본 행·최소/최대 날짜·파일 revision을 제외하고 정의 변화는 보수적으로 차단한다. 같은 스키마의 최신 데이터 재조회이며 역사 데이터 snapshot 복원은 아니다.

이번 탐색 보기의 기간은 전체기간 또는 절대 달력 날짜다. 상대기간, 팀 공유·URL 공유, 기본 보기 자동 적용, Pivot·내보내기, MySQL 실통합/운영 다중서버 부하는 후속이다. 저장 보기 패널은 기본적으로 접어서 탐색 화면 밀도를 유지한다.

## 실행 결과

2026-10-14, Node24.21.0/API4684/FE3484, 별도 검증 metadata와 source3/user2. 증빙 폴더: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/explore-saved-views-20261014`.

| ID | 판정 | 실행 범위와 증빙 | 남은 변형 |
| --- | --- | --- | --- |
| EXP-VIEW-01 | PASS 선택 조건 | Aside에서 이름 `입찰가 범위·증감률 QA` 저장201. view1의 sourceId3/dashboardIdNULL와 whitelist 상태를 metadata에서 확인. `aside-saved-rows.json`, `aside-saved-desktop.png` | 다른 소스·다른 집계 정의의 전체 조합 |
| EXP-VIEW-02 | PASS 선택 조건 | Aside 전체 새로고침→이름으로 복원 및 독립 headed Chromium 새 로그인/새로고침 복원. API201 현재56663800/이전29059200/126090행, Device Type9그룹 증감률 오름차순이 이전 독립 oracle와 동일, details.page0. `ui-results.json`, `ui-xhr.json`, `aside-restored-desktop.png`, `vm-restored-desktop.png` | 모든 상태 조합의 실제 화면 |
| EXP-VIEW-03 | PASS 하위·선택 화면 | FE 상태17개에서 혼합 필터·선택 순서·전체기간/빈차원·한쪽0·미등록/불완전/unsafe 거절, SourceExplore 새2개에서 한 번의 조회로 전체 적용/page0·미완성 날짜 저장 차단. BE 검증에서 SQL/원본/unknown 입력 거절. 실제 화면은 01의 범위/date/선택 조합 | 혼합 값+범위·빈차원의 실제 저장 화면 |
| EXP-VIEW-04 | PASS 하위·선택 API | 신규 BE27개 실제 in-memory SQLite에 서비스/소유권/ID범위·상태·20개 동시 생성/실패 후 queue복구·기존 dashboard보기 보존·migration 멱등성. 실제 새 endpoint 목록/상세 익명401. 기존 공통 queue/entity 영향 회귀28개 함께 PASS | 공유 토큰 및 다른 사용자 실제 HTTP, MySQL 동시성/운영 통합 NOT_RUN |
| EXP-VIEW-05 | PASS 하위·선택 화면 | 검증 지표2의 label만 일시 변경→실제 load409, 현재 전체기간/정렬/634513000과 view1 유지·삭제 버튼 사용 가능. 원 정의 문자열 복구→목록 재시도/불러오기201/56663800. `definition-conflict-results.json`, `vm-definition-conflict.png`. BE 정의 hash는 rowCount/sourceRevision/날짜 경계 변화에 안정적이고 정의 변화/race 거절 | 실제 새 파일 게시 후 복원·실제 열 변경과 stale 삭제 HTTP NOT_RUN |
| EXP-VIEW-06 | PASS 하위·선택 화면 | 모바일 load503 응답 fixture→현재 기간/asc/56663800 유지, 목록 재시도/복원201. `vm-load-failure-mobile.png`, `ui-results.json`. 영향받는 공유 FE 회귀에서 지연 load/조건 변경/중복 잠금/abort·삭제 취소/실패 유지 | 탐색 endpoint 지연·소스 교체 및 목록503의 실제 화면 NOT_RUN |
| EXP-VIEW-07 | PASS 선택 조건 | 실제1440×900/390×844, 390 document scrollWidth390. Enter 복원, 이름 입력→Tab 저장→Enter201, 삭제 Enter→취소 기본 초점→Enter 취소/초점 복귀, Shift+Tab 삭제 확인→Enter200/목록 fallback 초점. 정확한 임시 보기만 삭제했고 view1 유지. `vm-restored-mobile.png`, `vm-views-mobile-viewport.png`, `vm-final-mobile.png` | 실제 VoiceOver BLOCKED, 전체 스크린리더·실기기 터치 NOT_RUN |

### Rill 대조

Rill0.90.5/API9014의 기존 동일 원본 파생 범위 모델 `auction_range_metrics`를 사용했다. URL `tr=2023-09-10+to+2023-09-12&compare_tr=rill-PP&grain=hour&dims=device_type&sort_type=delta_percent&sort_dir=ASC`를 새로고침한 뒤 같은 기간/이전 비교/증감률asc와 첫 Connected Device200/−400/−67%, 요청56.7M/평균$3.07가 복원되는 것을 Aside에서 확인했다. 비동기 표가 `(No available values)`에서 정상 목록으로 전환된 뒤 최종 `rill-reload-state.png`를 저장했다. 기존 수치 정답을 다시 생성하지 않았다.

VanillaMeta는 소스/사용자별 이름을 붙인 조건을 metadata에 저장하고 불러온다. Rill의 이번 로컬 UI는 URL 재현을 확인했으며 이름 저장/클라우드 북마크는 검증하지 않았다. Rill 범위는 SQL 파생 모델에 고정돼 있고 시간 grain은 hour, VanillaMeta는 동적 범위 필터/day다. 숫자 반올림과 축 차이는 이전 기록대로 유지하며 UX 전체 동일성으로 확대하지 않는다.

### 검사·데이터 보존

- BE55 PASS = 신규 explore-view27 + 영향받는 기존 dashboard view28. FE28 PASS = 순수 상태17 + 선택 UI/관련 공유 회귀11; 나머지95개는 skipped이며 새 PASS로 세지 않는다.
- FE 타입/변경 lint/production build, BE 변경 lint/nest build, `git diff --check` PASS. 전체 출시 suite·기존 숫자 범위/집계/AI 조건은 반복하지 않았다. Node24를 명시했으며 새 패키지·별도 상시 서버·AI 호출을 추가하지 않았다.
- `metadata-after-check.json`: 기존 database6/metric2/dashboard5의 전체 행이 검사 전 backup과 동일. 검증 중 지표 정의는 원 문자열로 복구했고 임시 view2만 제거, view1만 남았다. 백업은 로컬 private 파일이며 인증정보를 문서/응답에 복사하지 않는다.
- 초기 새 단위 검사가 미사용 AI SDK ESM import를 따라가 실패해 단위 경계의 BiExploreService만 mock으로 격리했다. 실제 catalog/revision/조회는 UI HTTP로 별도 확인했다. 첫 root 테스트 명령이 선택 인자를 전달하지 않아 전체 suite를 시작한 것은 중단했고 완료 통과로 계산하지 않았다. 실제 BE cwd 선택 재검사는55 PASS다.
- 초기 standalone Chromium 시작은 sandbox mach bootstrap 거부로 실패했다. 승인된 로컬 headed 실행으로 재시도해 정의409/복구를 통과했다. 최초 실패 로그 `conflict-browser-launch-first-failure.log`를 보존했다. Aside의 첫 reload 직후 버튼 탐색은 catalog 준비 전이라 실패했으며 fresh snapshot에서 준비된 버튼으로 복원했다. 제품 성공 조건을 우회하지 않았다.

이번 단위는 미커밋 `codex/self-service-next-20261014` 작업이며 develop-v2 병합/푸시로 보고하지 않는다. VoiceOver 차단·gpt-6-luna 설정은 유지한다.
