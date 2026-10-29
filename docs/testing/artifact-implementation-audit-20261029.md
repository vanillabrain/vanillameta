# Figma Artifact 시나리오와 develop 구현 현황

2026-10-29 KST. 코드 수정 없이 작성한 현황과 실행 순서다. 기준은 원격 fetch 후 일치한 develop `3b9c27afaed522b9227b8f34a2d978f2be297dcf`다. HEAD와 origin/develop 차이는 0/0이다.

## 현재 제품은 차트형 Artifact 기반이며 문서형 보고서 여정은 미완성이다

파일·샘플에서 차트를 생성하고 Studio에서 편집·저장·게시·복제하는 기반은 구현돼 있다. 직원·그룹 공유와 파일 갱신 복구도 최신 실제 실행 증빙이 있다. 이 기능들을 다시 처음부터 구현할 필요는 없다.

최근 커밋 `453bbe63`은 Google 문서의 비공개 Markdown 사본·버전을, `acb4c543`은 원격 읽기 OAuth를 추가했다. `3b9c27af`은 실제 Codex CLI의 문서 조회·해제 후 차단을 기록했다. Google 실계정 승인은 설정 부재로 차단돼 있다.

Figma가 보여 주는 보고서에는 독립 본문, AI 설명 적용, 비공개 저장 당시의 고정 수치, 조직 수신자의 고정 버전 열람이 함께 있다. 현재 제품은 이 조합을 하나의 보고서로 저장하고 다시 여는 여정까지 완성하지 못했다. 기존 Studio의 `description`과 정해진 집계 요약은 독립 문서 편집기와 다르다.

### 판정 기준

- **완료**는 해당 행에 적은 지원 범위의 구현과 기존 실제 실행 증빙이 있는 경우다. 운영·모든 변형·사람 수용 완료가 아니다.
- **부분 구현**은 관련 기반이 있지만 해당 Figma 시나리오의 일부가 없거나 미커밋인 경우다.
- **미구현**은 조사한 제품 라우트·등록 모듈·도메인 모델에 대응 여정이 없는 경우다. 단순히 테스트가 없다는 이유로 미구현이라 하지 않는다.
- **미검증**은 코드·설정이 있지만 해당 실행 변형의 증빙을 확인하지 못한 경우다.
- **차단**은 실제 실행에 필요한 외부 설정·승인이 없는 경우다.

최신 데스크톱 Artifact 기능·정상 여정·주요 실패 상태를 36개 묶음으로 정리했다. 모든 프레임·단축키 변형을 개별 실행한 전수 검사표는 아니다.

이 문서에서 묶은 36개 시나리오는 완료 14, 부분 구현 8, 미구현 11, 미검증 2, 차단 1이다. 크기와 난도가 다른 시나리오 수이므로 제품 완성률이나 남은 공수의 백분율로 환산하지 않는다.

Figma의 21개 페이지 이름과 최신 14~17 및 파일 페이지의 노드 목록을 실제 MCP로 읽었다. 현재 17페이지의 최상위 항목은 189개이며 키보드 변형·공유 조합·과거 사본도 포함한다. 프레임 수를 기능 수로 사용하지 않는다. 새 Present 클릭이나 제품 테스트를 수행하지 않았고, 기존 통과 증빙을 재사용했다.

throughput checkpoint: n/a, read-only investigation.

## 기준 화면과 실제 경로

- [최신 허브](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=561-476).
- [매출 보고서 제작](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=531-615), [저장·재열기](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=531-1827), [수신자](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=531-3039).
- [외부 AI의 별도 저장 승인](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=573-1295).
- [문서 사본·요약](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=578-1046).
- [데이터 운영](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=388-3).

아래 URL은 실제 등록 라우트 또는 API 템플릿이다. `:id`와 `:token`은 자원별 값이다. 현재 QA 서버의 기동이나 운영 배포를 뜻하지 않는다. `/dashboard/library`는 API 경로이고 별도 UI 페이지가 아니다. C/E 번호는 아래 코드·증빙 참조표에 연결된다.

### 목록과 디자인

| ID · 시나리오 | 판정 | Figma · 실제 경로 | 코드·검증 근거와 남은 차이 |
|---|---|---|---|
| H01 공통 사이드바와 목록·편집·MCP·데이터 운영 내비게이션 | 부분 구현 | [561:476](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=561-476) · [451:1055](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=451-1055) · [451:2543](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=451-2543) · [451:1799](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=451-1799)<br>/dashboard · /studio/new · /documents · /ai-connections · /data/file | C1/C2/C6/C7 · E1/E4/E5<br>개별 화면 경로는 존재한다. Figma의 공통 작업 공간·사이드바는 전체 적용되지 않았다. |
| H02 허용된 본인 분석 목록·검색·보관·복원 | 완료 | [561:718](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=561-718)<br>/dashboard; API GET /v1/dashboard/library?view=active (또는 archived) | C1 · E3/E1<br>기존 Dashboard 분석 자산 범위의 선택 검증 완료다. 문서·파일을 포함한 통합 목록 완료가 아니다. |
| H03 목록·그리드 전환과 검색 조건을 유지한 Studio 왕복 | 부분 구현 | [561:476](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=561-476) · [561:597](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=561-597) · [561:839](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=561-839)<br>/dashboard?artifactDisplay=grid&artifactQuery=…; /dashboard/:id/studio | C1/C2 · E1<br>로컬 구현·실제 MySQL/화면 검증은 있다. 관련 UI 변경·검증 MD가 미커밋이므로 HEAD 완료로 승격하지 않는다. |
| H04 전체·내 항목·공유받음에서 문서·보고서·PDF 통합 조회 | 미구현 | [561:476](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=561-476) · [561:960](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=561-960) · [561:1476](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=561-1476)<br>직접 대응 경로 없음; 관련 /dashboard · /documents · /organization | C1/C4/C6 · E1<br>현재 Dashboard 목록·받은 분석·Google 문서가 분리돼 있다. 통합 조회 계약과 자산 유형·동작 분기가 필요하다. |
| H05 Neutral·Warm·Pastel·Dark 테마 전체 전환 | 부분 구현 | [307:376](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=307-376) · [307:516](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=307-516) · [307:656](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=307-656) · [307:796](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=307-796)<br>전체 앱 전환 경로 없음; 일부 조직 Embed 화면만 light/dark | C11/C1 · E1<br>shadcn 토큰·일부 dark 스타일은 있다. Figma의 네 테마를 앱 전체에서 전환·유지하는 계약과 검증은 없다. |

### 제작·편집·저장

| ID · 시나리오 | 판정 | Figma · 실제 경로 | 코드·검증 근거와 남은 차이 |
|---|---|---|---|
| R01 파일·샘플과 질문에서 차트 생성 제안·미리보기 | 완료 | [531:413](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=531-413) · [531:615](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=531-615)<br>/studio/new; POST /v1/studio/dashboards | C2 · E2<br>기존 차트형 분석 생성의 선택 실제 AI·저장 증빙을 재사용한다. Figma의 서술 본문 생성까지 완료한 것은 아니다. |
| R02 숫자·차트·Pivot 블록 추가와 크기·순서 편집 | 완료 | [531:615](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=531-615)<br>/dashboard/:id/studio | C2 · E2<br>지원하는 다섯 블록과 저장 배치 범위다. Pivot-only·혼합 Pivot의 다른 소스 remix는 제한을 유지한다. |
| R03 집계 표·정해진 수치 요약·블록 설명 표시 | 완료 | [531:615](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=531-615) · [531:1827](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=531-1827)<br>/dashboard/:id/studio | C2 · E2<br>StudioReport의 table/summary와 description은 있다. 독립 본문·이미지 블록과 AI 원인 설명은 아니다. |
| R04 문서형 보고서의 독립 본문·제목·이미지 블록 편집 | 미구현 | [451:1055](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=451-1055) · [531:615](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=531-615) · [531:1827](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=531-1827)<br>직접 대응 경로 없음; 관련 /dashboard/:id/studio | C2 · E2<br>StudioBlockKind에 텍스트·이미지 종류가 없다. 기존 description만으로 문서형 편집 완료로 보지 않는다. |
| R05 AI 본문 제안 검토·명시 적용·실행 취소 | 미구현 | [465:319](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=465-319) · [465:537](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=465-537) · [531:817](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=531-817) · [531:1019](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=531-1019)<br>문서 본문용 경로 없음; 기존 Studio AI 대화는 별개 | C2/C6 · E2/E4<br>차트 정의·설명 수정은 가능하지만 독립 보고서 본문에 대한 제안·적용·버전 보존 계약은 없다. |
| R06 차트형 분석의 비공개 저장·재열기·충돌 복구 | 완료 | [531:1423](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=531-1423) · [531:1827](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=531-1827)<br>/dashboard/:id/studio; POST /v1/studio/dashboards/:id/save; GET 동일 자원 | C2 · E2/E3<br>현재 지원 Studio 문서의 저장·재시작/reload·복구 선택 증빙이다. 고정 수치 보고서 저장과 구분한다. |
| R07 비공개 보고서의 본문·집계 수치·기준을 함께 고정 저장 | 부분 구현 | [531:1827](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=531-1827) · [531:5867](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=531-5867)<br>직접 대응 경로 없음; /dashboard/:id/studio · Studio private publication이 관련 기반 | C2/C3 · E2/E7<br>Studio GET은 현재 파일을 pin하여 재집계한다. 별도 publication은 고정 결과를 저장하지만 비공개 보고서 편집·재열기 모델과 같지 않다. |
| R08 조회 기간·필터·지표 정의·실행 근거 표시 | 완료 | [531:615](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=531-615) · [388:465](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=388-465)<br>/dashboard/:id/studio · /explore/source | C2/C5 · E2/E7<br>지원 분석의 현재 실행 근거 표시를 확인한다. 문서 본문 주장과 근거의 영속 연결·완전한 실행 이력은 별개다. |

### 공유·수신자·복제

| ID · 시나리오 | 판정 | Figma · 실제 경로 | 코드·검증 근거와 남은 차이 |
|---|---|---|---|
| S01 저장 분석의 고정 게시·재게시·만료·중지 | 완료 | [531:2635](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=531-2635) · [531:6271](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=531-6271) · [581:704](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=581-704)<br>/published/:token; POST /v1/studio/dashboards/:id/publications · /v1/studio/publications/:token/revoke | C3 · E2<br>지원 차트/Pivot snapshot의 선택 실제 증빙이다. 게시물 접근은 현재 권한 검사도 받는다. |
| S02 재게시 후 과거 v1·현재 v2 결과를 나란히 재열기 | 미구현 | [531:7281](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=531-7281) · [531:7483](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=531-7483)<br>과거 publication version 조회 경로 없음 | C3 · E2<br>현재 활성 token의 재게시가 snapshot을 갱신한다. 과거 요청 영수증은 과거 집계 본문을 보존하는 버전 열람 API가 아니다. |
| S03 조직 직원·그룹의 분석 전달·받은 자료·회수 | 완료 | [531:2231](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=531-2231) · [531:3241](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=531-3241)<br>/organization; /dashboard/:id; API /v1/enterprise/deliveries/dashboard/received · /:id · /:id/groups | C4 · E3<br>최신 실제 MySQL/Ego의 전달·수신자·회수 증빙이 있다. 소스 read는 별도이며 일반 member의 모든 공유 정책 수용은 아니다. |
| S04 팀·보기/편집·외부 링크를 한 검토 화면에서 변경 | 부분 구현 | [494:51](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=494-51) · [494:2928](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=494-2928) · [531:2231](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=531-2231)<br>/organization · /dashboard/:id/studio의 게시 설정 | C3/C4 · E3<br>권한·동적 그룹·게시의 개별 기능은 있다. Figma의 조합 상태를 하나의 검토/저장 흐름으로 적용하는 공통 화면은 없다. |
| S05 로그인한 조직 수신자에게 고정 보고서 버전 전달 | 부분 구현 | [531:3039](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=531-3039) · [531:6877](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=531-6877)<br>/organization · /dashboard/:id; 공개 게시 /published/:token은 별도 | C3/C4 · E3/E2<br>현재 조직 전달은 source read도 요구하는 Dashboard 접근 관계이고 publication은 private/link다. 원본 표본 권한을 추가하지 않는 보고서 revision 전용 열람 권한·정제 endpoint·고정 본문 여정이 필요하다. |
| S06 받은 분석을 내 소스에 매핑해 비공개 독립 복제 | 완료 | [531:8493](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=531-8493) · [531:8695](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=531-8695) · [531:8897](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=531-8897)<br>/received/:dashboardId/remix · /published/:token/remix | C2/C4 · E3/E2<br>지원 일반 분석의 복제·저장/reload·원본 회수 후 본인 사본 보존을 확인했다. 혼합 Pivot의 수신자 remix 등 제한은 유지한다. |

### 외부 문서와 데이터

| ID · 시나리오 | 판정 | Figma · 실제 경로 | 코드·검증 근거와 남은 차이 |
|---|---|---|---|
| D01 실제 Google 계정으로 선택 문서 승인 | 차단 | [578:562](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=578-562) · [304:2170](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=304-2170)<br>/documents · /documents/google/callback; POST /v1/documents/google/start · /complete | C6 · E4<br>사용자가 기존 OAuth 설정 없음을 확인했다. 클라이언트 설정과 실계정 승인이 없어 실제 Google 왕복만 BLOCKED다. |
| D02 Markdown 원문 사본·갱신·과거 버전·연결 해제 | 완료 | [578:804](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=578-804) · [578:925](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=578-925) · [578:1409](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=578-1409)<br>/documents/:id; GET /v1/documents/:id/versions/:version; POST /:id/refresh · /disconnect | C6 · E4<br>Google 네트워크는 모의다. 실제 MySQL 저장·API/UI·재시작 후 v1/v2 본문 보존은 선택 검증했다. 실계정 성공과 합치지 않는다. |
| D03 문서 요약의 별도 비용 동의·근거 버전·관리자/배치 실행 | 미구현 | [578:1046](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=578-1046) · [578:1167](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=578-1167) · [578:1530](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=578-1530) · [581:1551](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=581-1551)<br>직접 대응 경로 없음; /me/usage의 기존 AI 쿼터는 관련 기반 | C6/C9 · E4/E8<br>원문 사본 갱신은 LLM을 호출하지 않는다. 요약 자산/작업·예산 동의·오래된 요약 판정이 없다. |
| D04 Microsoft·Docs/Sheets/Slides 연결과 원본 편집 | 미구현 | [578:683](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=578-683) · [304:2237](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=304-2237) · [304:2371](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=304-2371)<br>직접 대응 경로 없음; Google Docs 읽기 /documents만 지원 | C6 · E4<br>MS 커넥터·Office 임베드 편집·Google Docs 쓰기·자동 양방향 동기화가 없다. |
| D05 Google/MS 스프레드시트를 VM 데이터소스로 사용 | 미구현 | [388:55](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=388-55) · [578:562](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=578-562)<br>직접 대응 경로 없음; 파일 업로드 /data/file은 별개 | C5/C6 · E4<br>CSV/JSON/Parquet 임포트는 구현돼 있다. 인증된 Sheets/Excel 탭·열 선택과 갱신 커넥터는 없다. |

### 업로드 산출물

| ID · 시나리오 | 판정 | Figma · 실제 경로 | 코드·검증 근거와 남은 차이 |
|---|---|---|---|
| F01 HTML/ZIP 업로드·검사·격리 미리보기·공유·버전 교체 | 미구현 | [304:658](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=304-658) · [304:852](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=304-852) · [304:1681](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=304-1681) · [360:431](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=360-431)<br>직접 대응 경로 없음 | C1/C5/C6 · E1/E4<br>데이터 파일 임포트와 HTML 산출물 보관은 다른 기능이다. 정적 HTML도 별도 자산·격리 렌더 계약이 필요하다. |
| F02 PDF 업로드·미리보기·조직 공유·버전 교체 | 미구현 | [561:1476](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=561-1476) · [304:1077](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=304-1077) · [304:1792](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=304-1792)<br>직접 대응 경로 없음 | C1/C5/C6 · E1/E4<br>Figma에는 예시가 있다. 제품의 PDF 자산 업로드/열람/버전 API는 조사한 경계에서 찾지 못했다. |
| F03 PPT 업로드·슬라이드 미리보기·공유·버전 교체 | 미구현 | [304:942](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=304-942) · [304:1034](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=304-1034) · [304:1737](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=304-1737)<br>직접 대응 경로 없음 | C1/C5/C6 · E1/E4<br>PPT 변환·미리보기·버전 교체 제품 경로가 없다. 외부 제작 PPT를 보관하는 기능과 자체 슬라이드 편집기는 별도다. |

### 외부 AI와 MCP

| ID · 시나리오 | 판정 | Figma · 실제 경로 | 코드·검증 근거와 남은 차이 |
|---|---|---|---|
| M01 로컬 Codex/Claude MCP의 제안·미리보기·별도 비공개 저장 | 완료 | [360:82](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=360-82) · [360:196](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=360-196) · [360:252](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=360-252)<br>로컬 stdio mcp-server; 결과 /dashboard/:id/studio | C8/C2 · E6<br>실제 호스트 증빙이 있다. 지원 대상은 차트형 Studio 자산이며 게시/공유/문서 본문 수정은 제외한다. |
| M02 원격 OAuth 조직·읽기 권한 승인·취소·연결 해제 | 완료 | [377:150](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=377-150) · [377:171](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=377-171) · [377:180](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=377-180) · [573:779](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=573-779)<br>/ai-connections · /ai-connections/approve/:ticket; /v1/mcp | C7 · E5<br>정적 등록 client·PKCE·한정 scope·현재 권한 재검사의 선택 검증이다. 만료 access token의 refresh는 없다. |
| M03 실제 Codex의 원격 문서 조회와 해제 후 차단 | 완료 | [573:779](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=573-779) · [573:900](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=573-900) · [561:1355](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=561-1355)<br>/v1/mcp의 vm_list_documents · vm_read_document | C7/C6 · E5<br>실제 Codex CLI/gpt-6-luna의 두 도구 호출·독립 정답·만료 전 해제 후 새 세션401을 확인했다. 로컬 HTTP/합성 문서 범위다. |
| M04 원격 OAuth로 AI 제작·본문 수정·별도 저장 | 미구현 | [573:1021](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=573-1021) · [573:1142](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=573-1142) · [573:1295](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=573-1295) · [573:1416](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=573-1416)<br>대응 원격 쓰기 도구 없음; 관련 로컬 stdio 경로는 M01 | C7/C8 · E5/E6<br>원격 서버는 읽기 도구만 등록한다. 로컬 stdio의 저장을 원격 제작 완료로 계산하지 않는다. |
| M05 공개 HTTPS와 다른 AI 호스트의 실제 원격 연결 | 미검증 | [573:658](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=573-658) · [377:150](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=377-150)<br>운영 /v1/mcp · /.well-known/... | C7/C10 · E5<br>nginx 전달 설정과 원격 서버는 있지만 공개 운영 URL·Claude/ChatGPT 원격 OAuth 실호스트 호환성 증빙은 없다. |

### 데이터 운영과 검증

| ID · 시나리오 | 판정 | Figma · 실제 경로 | 코드·검증 근거와 남은 차이 |
|---|---|---|---|
| O01 파일 갱신·버전 확인·응답 유실·재시작 후 명시 복구 | 완료 | [388:115](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=388-115) · [388:154](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=388-154) · [388:355](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=388-355) · [388:777](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=388-777)<br>/data/file; /v1/database/:id/file-refreshes · /latest · /:requestId/retry · /cancel | C5 · E7<br>영속 작업·actual API 재시작·DuckDB 수치·기존 고정 게시 보존 증빙이 있다. 오래된 계획의 미완료 표기로 되돌리지 않는다. |
| O02 조직 사용량·실행 예산·요약 쿼터·버전 보존 정리 | 부분 구현 | [388:565](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=388-565) · [388:632](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=388-632) · [388:702](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=388-702) · [388:749](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=388-749)<br>기존 GET /v1/me/usage · 운영자 CLI; 관련 /data/file | C5/C9 · E8/E7<br>본인 AI/저장소 쿼터·원장은 있다. 조직 통합 운영 UI·문서 요약 예산·참조별 버전 정리 정책은 설계와 다르다. |
| O03 문서 응답 유실 복구 실주입과 네이티브 선택 전체 키보드 | 미검증 | [581:1188](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=581-1188) · [581:1309](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=581-1309) · [578:1409](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=578-1409)<br>/documents/:id | C6 · E4<br>같은 UUID 조회/중복 방지는 API·서비스에서 확인했다. 실제 commit 응답 유실 UI 주입·버전 select 방향키와 모든 테마는 남아 있다. |
| O04 쉬운 OSS 설치와 SaaS 승인만으로 쓰는 온보딩 | 부분 구현 | [360:3](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=360-3) · [360:82](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=360-82) · [573:537](https://www.figma.com/design/drurJx9spVDyjmQbKIa7uH?node-id=573-537)<br>deploy/docker-compose.prod.yml · /signup · /ai-connections | C10/C7 · E8/E5<br>Compose·운영 가드·초대/쿼터 기반은 있다. 깨끗한 서버의 완전한 설치 실증과 운영 AI 연결 전체 수용, 동적 client 등록 없는 승인 UX는 별도다. |

## 매출 보고서의 실제 연결 상태

| 사용자 단계 | 재사용할 기반 | Figma 대비 남은 부분 |
|---|---|---|
| 목록에서 제작 시작 | /dashboard → /studio/new. 기존 정상 샘플과 실제 AI 생성 | 공통 사이드바·통합 유형 선택과 보고서 진입 |
| 제작 | 소스/지표/차원·KPI·기간 차트 생성 | 독립 본문 블록과 근거 연결 |
| 수정 | 차트 정의·표현·배치·설명, 미리보기·undo/redo | 본문에 대한 AI 제안·명시 적용·근거가 바뀐 설명 표시 |
| 비공개 저장 | Studio 문서와 revision/CAS·멱등 요청 | 본문과 함께 저장 당시 집계 결과를 고정하는 보고서 revision |
| 재열기 | 저장 정의와 현재 데이터의 재집계 | 고정 보고서인지 현재 데이터인지 명확히 구분하고 같은 수치·본문 복원 |
| 공유 | 고정 publication 및 별도 직원/그룹 전달 | 조직 수신자에게 어느 고정 보고서 revision을 주는지 명시 |
| 수신자 열람 | 기존 로그인 전달·회수·독립 사본 보존 | 고정 본문/집계 읽기 전용 화면과 원본 행·편집 권한의 분리 |
| 갱신·재게시 | 영속 파일 갱신·복구, 명시 재게시 | 보고서 r1 보존→v4 기반 r2 생성, 과거 게시 v1의 수치 재열기 |

### 저장·게시·전달을 같은 상태로 취급하면 안 된다

`StudioService.get`은 현재 파일을 pin하고 `mixedPreview`를 실행한다. 저장된 Studio 정의를 다시 열었다고 해서 저장 당시 숫자를 고정 보관한 것은 아니다. 반면 publication은 정제된 집계 snapshot을 저장하며 파일이 바뀌어도 재게시 전까지 그 결과를 유지한다.

현재 Studio publication의 활성 token은 재게시 때 같은 행의 snapshot과 version이 갱신된다. 요청 영수증은 과거 저장 성공을 확인하는 자료다. 과거 v1 결과 전체를 다시 여는 API·UI와 같지 않다. Figma에는 v2 게시 후 v1 결과를 여는 여정이 있으므로 S02를 별도 미구현으로 남긴다.

직원·그룹 전달은 Dashboard 접근 관계다. publication의 `private|link`와 조직 전달을 합친 단일 공유 모델은 아니다. 조직 전달을 임의 공개 링크로 대체하지 않는다.

snapshot을 고정해도 현재 접근권 검사는 유지된다. 현재 publication 읽기는 게시자의 소스/대시보드 권한을 다시 확인한다. 고정 결과를 만든다는 이유로 회수 후 데이터 숨김 정책을 제거하지 않는다. 소스와 완전히 독립된 사본 권한은 별도 설계다.

### Figma 예시 숫자는 제품 정답과 구분한다

Figma v3의 총매출 1,240,000원·환불 80,000원·순매출 1,160,000원과 v4의 순매출 1,190,000원은 정적 디자인 예시다. 실제 조회 정답으로 입증된 값이 아니다.

기존 제품의 표준 37주문 샘플은 순매출 16,537.01로 검증돼 있다. 실제 제품 캡처와 Figma의 숫자·통화가 다른 것이 구현 오류라는 뜻은 아니다. 후속 구현 검증은 같은 원본 파일·통화·날짜·계산식과 독립 정답을 고정하고 수행한다. 디자인 예시 값을 응답이나 AI 프롬프트에 정답으로 넣지 않는다.

## 미커밋 구현과 원격 develop을 구분한다

기존 미커밋 변경은 조사 시작 당시 추적 파일 18개와 미추적 문서·스킬 디렉터리다. 이번 조사에서 변경하지 않았다.

| 묶음 | 현재 상태 | 후속 처리 |
|---|---|---|
| ArtifactLibrary·BoardItem/BoardList·헤더·언어 | 목록/그리드·검색 URL·정렬·기존 항목 동작의 로컬 구현과 실제 검증이 있다. | 현재 diff와 기존 증빙을 검토해 기능 단위로 커밋할 후보로 정리한다. 이 조사에서는 커밋하지 않는다. |
| DashboardView·StudioCreate·StudioEditor | 목록 복귀 조건·새 탭·저장 후 이동 문맥의 로컬 수정이다. | 위 허브 묶음과 함께 호출 관계를 검토한다. `artifactNavigation.ts` helper 자체는 HEAD에 이미 있고 일부 호출자는 dirty다. |
| artifact-hub-ui.md·artifact-hub-completion.md | 미추적 검증 문서다. 격리 MySQL/Ego 결과를 기록한다. | 코드와 함께 보관할 후보이며 원격에 반영된 기록으로 표현하지 않는다. |
| .claude/settings.json·CLAUDE.md·기존 Figma 스킬/운영 설계 | 별도 변경이다. | 허브 기능에 일괄 포함하지 않는다. |

## 첫 구현 단위는 본문과 고정 수치를 가진 비공개 매출 보고서다

이 절은 실행 순서 제안이며 코드 구현 승인이 아니다. 새 권한·장애 변형을 계속 추가하기보다, 이미 있는 차트 기능 위에 사용자가 Figma에서 본 보고서 하나가 남도록 연결한다.

| 선택지 | 재사용 범위 | 추가 부담 | 판단 |
|---|---|---|---|
| 기존 차트 description만 늘림 | 저장·게시 그대로 | 낮음 | 자유 본문·독립 블록·고정 비공개 수치를 충족하지 못한다. R03을 R04 완료로 바꾸지 않는다. |
| 기존 Studio에 제한된 본문 블록과 보고서 고정 revision 연결 | 차트 compiler·배치·미리보기·권한·저장 CAS·publication sanitizer | 본문 계약과 고정 결과 저장/읽기 및 각 렌더 경계 확장 | 권장한다. 보고서 한 건을 완성한 뒤 같은 모델을 확장할 수 있다. |
| Docs/Notion/Office급 범용 편집기·모든 파일 유형을 한 번에 구축 | 일부 인증/권한 | 높음. 편집·변환·파일·미리보기 계약까지 동시에 늘어남 | 첫 단위에서 제외한다. |

### U0 기존 허브 작업을 먼저 정리한다

현재 로컬 허브 변경을 기존 검증 기록과 묶어 검토한다. 관련 source hash가 같으면 통과 결과를 재사용하고 새 영향만 확인한다. 사용자가 커밋·push를 요청하면 해당 묶음만 develop에 drumcap으로 반영한다. 무관한 Claude 설정과 운영 설계를 섞지 않는다.

### U1 비공개 보고서 저장·재열기를 완성한다

첫 기능 단위의 목표는 설명 본문·KPI·차트를 편집하고 같은 보고서 revision으로 저장한 뒤 다시 여는 것이다.

- 기존 Studio를 확장하는 보고서 종류와 본문 블록의 명시 스키마를 정한다. 원시 HTML·스크립트·외부 이미지·Office 편집기는 제외한다. 이미지 블록은 별도 후속이다.
- 기존 데이터 소스/지표/기간/필터를 재사용한다. 보고서 revision에 계산 근거와 정제된 결과 snapshot을 함께 고정한다. 원본 행·SQL·접속정보는 본문/수신자 응답에 넣지 않는다.
- 초안은 현재 데이터 미리보기이고 저장 보고서는 고정 결과라는 차이를 화면에 표시한다. 기존 동적 대시보드 동작을 전부 고정 보고서로 바꾸지 않는다.
- 처음에는 사용자가 직접 본문을 편집해 저장할 수 있게 한다. AI 본문 편집은 U2에서 같은 저장 모델을 이용한다.

**인수 조건.** 같은 샘플에서 본문 A와 집계 결과 N을 저장한다. 목록→재열기·브라우저 새로고침·API 재시작 뒤 본문/수치/기준 revision이 같아야 한다. 원본 데이터를 바꿔도 기존 보고서 r1은 그대로다. 명시적으로 새 기준을 선택할 때만 r2 미리보기가 생긴다. 권한 회수 시 기존 접근 차단을 유지한다. 저장 실패·409는 초안을 보존하고 자동 재저장하지 않는다.

### U2 AI 본문 제안·검토·저장을 연결한다

VM 안의 기존 AI SDK/Codex 경로와 gpt-6-luna를 유지한다. 선택한 고정 집계·근거만 전달한다. 제안은 쓰기 전 상태이며 사용자 적용과 저장을 분리한다. 본문 다듬기로 수치·계산식이 바뀌지 않도록 검사한다.

**인수 조건.** 실제 모델의 본문 제안→명시 적용→되돌리기→저장·재열기를 확인한다. 오류·취소·오래된 응답에서는 본문 초안과 기존 정상본을 보존한다. 근거가 달라지면 과거 설명을 최신 설명으로 표시하지 않는다.

### U3 고정 보고서의 조직 공유·수신자 열람을 연결한다

기존 직원/그룹 대상 선택·현재 조직·회수 검사와 멱등성 패턴을 재사용한다. 현재 Dashboard 전달은 수신자의 source read도 요구하고, source read는 원본 표본 조회를 허용한다. 따라서 기존 전달 권한을 그대로 부여하면서 화면만 숨겨 보고서 전용 열람으로 만들 수는 없다.

고정 보고서 revision의 열람 권한과 정제된 본문·집계 조회 endpoint를 별도로 설계한다. 이 공유만으로 수신자에게 source read를 요구하거나 부여하지 않는다. 소유자/게시자의 현재 데이터 이용 권한 검사와 회수 후 차단은 유지한다. 이미 별도로 source read를 가진 직원의 권한을 보고서 공유가 임의 회수하지 않는다. 공유 대상과 고정 revision을 함께 검토하고 공개 링크는 별도 선택으로 유지한다.

**인수 조건.** source read가 없는 재무팀 수신자가 보고서 r1의 허용 본문·집계만 읽어야 한다. 같은 계정의 직접 소스/profile·원본 행 API는 거절되고 보고서 공유만으로 새 source grant가 생기면 안 된다. 별도 source read가 있는 직원은 독립 권한에 따른 동작을 구분해 확인한다. 다른 조직·보고서 열람 회수 후 요청은 차단돼야 한다. 독립 복제는 기존처럼 본인 대상 소스와 별도 허용·미리보기를 요구하고, 완료 사본은 원본 회수 후 본인 자료로 유지돼야 한다. 이미 통과한 전달 경합을 전부 다시 실행하지 않고 새 보고서 권한 경계만 확인한다.

### U4 갱신·재게시·과거 버전·복제를 완성한다

기존 파일 갱신 작업을 재사용해 새 데이터로 r2를 만든다. 명시 재게시 전 게시 v1을 유지한다. 재게시 후 v2와 과거 v1의 본문·결과를 구분해서 읽는다. 지원 범위의 내 데이터 매핑·비공개 사본에도 보고서 본문과 기준을 보존한다.

**인수 조건.** 원본 r1/v1, 새 r2/v2, 수신자 사본의 ID·소유자·데이터 기준·숫자를 따로 대조한다. 취소와 실패가 기존 정상본을 바꾸지 않아야 한다. 혼합 Pivot remix는 현재 명시 미지원이므로 이 단위에서 무심코 지원으로 표기하지 않는다.

### U5 문서 활용과 원격 AI 제작을 이어 붙인다

보고서 저장 모델이 생긴 뒤 Google 사본을 선택 근거로 첨부하고 외부 AI 원격 제작/저장을 연결한다. 현재 원격 읽기 OAuth는 유지하고 쓰기 scope·미리보기·별도 저장 승인을 추가 설계한다. Google 실계정 설정 준비와 공개 HTTPS/호스트 호환성 검증은 독립적으로 진행할 수 있다.

비용 승인 요약, Sheets 데이터소스, Microsoft, HTML/PDF/PPT 등록과 버전 교체는 각각 다음 단위다. 최초 보고서 여정의 필수 선행조건으로 만들지 않는다.

### 기존 베타 범위와 새 Figma 범위를 분리한다

[외부 초대 베타 전략](../strategy/external-beta.md)은 파일·샘플 기반 시각화와 Studio publication을 우선하고 임의 HTML/JS 실행을 제외한다. 새 Figma는 문서와 외부 파일 보관까지 범위가 넓다. 이번 표의 미구현 항목 전체를 당장 베타 출시 차단 조건으로 바꾸지 않는다. HTML 보관을 시작할 때도 정적 자료 저장과 임의 코드 실행을 구분한다.

## 검증을 재실행한 항목과 재사용한 항목

이번에는 제품·모델·Google OAuth·DB 쓰기·Present 조작을 실행하지 않았다. Git 기준 확인, Figma 실제 구조·선택 텍스트 읽기, 코드/라우트/스키마 대조, 기존 증빙 파일의 존재와 대표 캡처 확인을 수행했다.

다음 과거 미완료 표기는 최신 증빙에 의해 해당 범위에서 해소돼 있다.

- 파일 갱신 영속 상태·API 재시작 복구는 Rill 시나리오 RXS15/16 후속에서 확인했다. 초기 enterprise-data-artifact.md의 Remaining execution만 읽고 다시 미구현이라 판단하지 않는다.
- 직원/그룹 공유와 수신자 독립 복제는 enterprise-integrated-mysql.md·delivery-recovery.md·group-delivery-recovery.md·received-copy-recovery.md의 최신 실제 여정이 있다. 초기 recipient-deliveries.md와 received-copy.md의 UI NOT_RUN만으로 현재 상태를 판정하지 않는다.
- 문서 연결 초반 계획의 원격 OAuth 미구현 표기는 acb4c543/3b9c27af 후속 범위에서 해소됐다. 원격 쓰기까지 해소한 것은 아니다.
- 실제 Google 승인은 계속 차단이다. 모의 Google+실제 MySQL/UI와 실제 Codex+합성 저장 문서는 서로 다른 증거다.

네이티브 버전 선택 방향키·문서 commit 응답 유실 실제 UI 주입·다른 테마 전체·공개 HTTPS/다른 원격 호스트는 미검증이다. 모바일은 이번 조사 범위 밖이고 VoiceOver 차단과 gpt-6-luna 설정은 유지했다.

## 코드 참조

### C1

[frontend-web/src/router/index.tsx](/Users/moonklabs/workspace-vanilla/vanillameta/frontend-web/src/router/index.tsx) · [frontend-web/src/pages/Dashboard/ArtifactLibrary.tsx](/Users/moonklabs/workspace-vanilla/vanillameta/frontend-web/src/pages/Dashboard/ArtifactLibrary.tsx) · [frontend-web/src/pages/Dashboard/index.tsx](/Users/moonklabs/workspace-vanilla/vanillameta/frontend-web/src/pages/Dashboard/index.tsx) · [frontend-web/src/layouts/Header/index.tsx](/Users/moonklabs/workspace-vanilla/vanillameta/frontend-web/src/layouts/Header/index.tsx) · [frontend-web/src/helpers/artifactNavigation.ts](/Users/moonklabs/workspace-vanilla/vanillameta/frontend-web/src/helpers/artifactNavigation.ts) · [backend-api/src/dashboard/personal-library.controller.ts](/Users/moonklabs/workspace-vanilla/vanillameta/backend-api/src/dashboard/personal-library.controller.ts).

### C2

[frontend-web/src/pages/Dashboard/Studio/studioTypes.ts](/Users/moonklabs/workspace-vanilla/vanillameta/frontend-web/src/pages/Dashboard/Studio/studioTypes.ts) · [frontend-web/src/pages/Dashboard/Studio/StudioReport.tsx](/Users/moonklabs/workspace-vanilla/vanillameta/frontend-web/src/pages/Dashboard/Studio/StudioReport.tsx) · [frontend-web/src/pages/Dashboard/Studio/StudioCreate.tsx](/Users/moonklabs/workspace-vanilla/vanillameta/frontend-web/src/pages/Dashboard/Studio/StudioCreate.tsx) · [frontend-web/src/pages/Dashboard/Studio/StudioEditor.tsx](/Users/moonklabs/workspace-vanilla/vanillameta/frontend-web/src/pages/Dashboard/Studio/StudioEditor.tsx) · [backend-api/src/dashboard-studio/studio-contract.ts](/Users/moonklabs/workspace-vanilla/vanillameta/backend-api/src/dashboard-studio/studio-contract.ts) · [backend-api/src/dashboard-studio/studio.service.ts](/Users/moonklabs/workspace-vanilla/vanillameta/backend-api/src/dashboard-studio/studio.service.ts).

### C3

[backend-api/src/dashboard-studio/studio-publication.service.ts](/Users/moonklabs/workspace-vanilla/vanillameta/backend-api/src/dashboard-studio/studio-publication.service.ts) · [backend-api/src/dashboard-studio/studio-publication-contract.ts](/Users/moonklabs/workspace-vanilla/vanillameta/backend-api/src/dashboard-studio/studio-publication-contract.ts) · [backend-api/src/dashboard-studio/entities/studio-publication.entity.ts](/Users/moonklabs/workspace-vanilla/vanillameta/backend-api/src/dashboard-studio/entities/studio-publication.entity.ts) · [frontend-web/src/pages/Dashboard/Studio/StudioPublish.tsx](/Users/moonklabs/workspace-vanilla/vanillameta/frontend-web/src/pages/Dashboard/Studio/StudioPublish.tsx) · [backend-api/src/bi/publication.controller.ts](/Users/moonklabs/workspace-vanilla/vanillameta/backend-api/src/bi/publication.controller.ts).

### C4

[backend-api/src/enterprise/delivery.controller.ts](/Users/moonklabs/workspace-vanilla/vanillameta/backend-api/src/enterprise/delivery.controller.ts) · [backend-api/src/enterprise/resource-policy.controller.ts](/Users/moonklabs/workspace-vanilla/vanillameta/backend-api/src/enterprise/resource-policy.controller.ts) · [backend-api/src/ownership/source-access.service.ts](/Users/moonklabs/workspace-vanilla/vanillameta/backend-api/src/ownership/source-access.service.ts) · [frontend-web/src/pages/Enterprise/index.tsx](/Users/moonklabs/workspace-vanilla/vanillameta/frontend-web/src/pages/Enterprise/index.tsx) · [frontend-web/src/pages/Dashboard/Studio/StudioReceivedRemix.tsx](/Users/moonklabs/workspace-vanilla/vanillameta/frontend-web/src/pages/Dashboard/Studio/StudioReceivedRemix.tsx).

### C5

[backend-api/src/database/file-refresh.controller.ts](/Users/moonklabs/workspace-vanilla/vanillameta/backend-api/src/database/file-refresh.controller.ts) · [backend-api/src/database/file-refresh.service.ts](/Users/moonklabs/workspace-vanilla/vanillameta/backend-api/src/database/file-refresh.service.ts) · [backend-api/src/database/entities/file-refresh.entity.ts](/Users/moonklabs/workspace-vanilla/vanillameta/backend-api/src/database/entities/file-refresh.entity.ts) · [backend-api/src/database/database.controller.ts](/Users/moonklabs/workspace-vanilla/vanillameta/backend-api/src/database/database.controller.ts) · [frontend-web/src/pages/Data/FileAnalysis/index.tsx](/Users/moonklabs/workspace-vanilla/vanillameta/frontend-web/src/pages/Data/FileAnalysis/index.tsx).

### C6

[backend-api/src/documents/documents.controller.ts](/Users/moonklabs/workspace-vanilla/vanillameta/backend-api/src/documents/documents.controller.ts) · [backend-api/src/documents/documents.service.ts](/Users/moonklabs/workspace-vanilla/vanillameta/backend-api/src/documents/documents.service.ts) · [backend-api/src/documents/document.entity.ts](/Users/moonklabs/workspace-vanilla/vanillameta/backend-api/src/documents/document.entity.ts) · [backend-api/src/documents/google-docs.provider.ts](/Users/moonklabs/workspace-vanilla/vanillameta/backend-api/src/documents/google-docs.provider.ts) · [frontend-web/src/pages/Documents/DocumentDetail.tsx](/Users/moonklabs/workspace-vanilla/vanillameta/frontend-web/src/pages/Documents/DocumentDetail.tsx).

### C7

[backend-api/src/mcp-oauth/mcp.controller.ts](/Users/moonklabs/workspace-vanilla/vanillameta/backend-api/src/mcp-oauth/mcp.controller.ts) · [backend-api/src/mcp-oauth/mcp-read.service.ts](/Users/moonklabs/workspace-vanilla/vanillameta/backend-api/src/mcp-oauth/mcp-read.service.ts) · [backend-api/src/mcp-oauth/mcp-oauth.service.ts](/Users/moonklabs/workspace-vanilla/vanillameta/backend-api/src/mcp-oauth/mcp-oauth.service.ts) · [frontend-web/src/pages/AiConnections/index.tsx](/Users/moonklabs/workspace-vanilla/vanillameta/frontend-web/src/pages/AiConnections/index.tsx).

### C8

[mcp-server/src/index.js](/Users/moonklabs/workspace-vanilla/vanillameta/mcp-server/src/index.js) · [mcp-server/src/server.js](/Users/moonklabs/workspace-vanilla/vanillameta/mcp-server/src/server.js) · [docs/user-manual/site/mcp.md](/Users/moonklabs/workspace-vanilla/vanillameta/docs/user-manual/site/mcp.md).

### C9

[backend-api/src/usage/usage.controller.ts](/Users/moonklabs/workspace-vanilla/vanillameta/backend-api/src/usage/usage.controller.ts) · [backend-api/src/usage/ai-quota.service.ts](/Users/moonklabs/workspace-vanilla/vanillameta/backend-api/src/usage/ai-quota.service.ts) · [frontend-web/src/pages/Dashboard/Studio/AiUsageChip.tsx](/Users/moonklabs/workspace-vanilla/vanillameta/frontend-web/src/pages/Dashboard/Studio/AiUsageChip.tsx).

### C10

[deploy/README.md](/Users/moonklabs/workspace-vanilla/vanillameta/deploy/README.md) · [deploy/docker-compose.prod.yml](/Users/moonklabs/workspace-vanilla/vanillameta/deploy/docker-compose.prod.yml) · [docs/strategy/external-beta.md](/Users/moonklabs/workspace-vanilla/vanillameta/docs/strategy/external-beta.md).

### C11

[frontend-web/src/index.tsx](/Users/moonklabs/workspace-vanilla/vanillameta/frontend-web/src/index.tsx) · [frontend-web/src/theme/theme.tsx](/Users/moonklabs/workspace-vanilla/vanillameta/frontend-web/src/theme/theme.tsx) · [frontend-web/src/pages/Organization/EmbedPortal.tsx](/Users/moonklabs/workspace-vanilla/vanillameta/frontend-web/src/pages/Organization/EmbedPortal.tsx).

## 검증 기록 참조

### E1

[docs/testing/artifact-hub-completion.md](/Users/moonklabs/workspace-vanilla/vanillameta/docs/testing/artifact-hub-completion.md) · [docs/testing/artifact-hub-ui.md](/Users/moonklabs/workspace-vanilla/vanillameta/docs/testing/artifact-hub-ui.md).

### E2

[docs/testing/creation-publication.md](/Users/moonklabs/workspace-vanilla/vanillameta/docs/testing/creation-publication.md) · [docs/testing/copy-ai-publication.md](/Users/moonklabs/workspace-vanilla/vanillameta/docs/testing/copy-ai-publication.md) · [docs/testing/rill-scenarios.md](/Users/moonklabs/workspace-vanilla/vanillameta/docs/testing/rill-scenarios.md) · [docs/testing/studio-pivot.md](/Users/moonklabs/workspace-vanilla/vanillameta/docs/testing/studio-pivot.md) · [docs/testing/calculation-followup.md](/Users/moonklabs/workspace-vanilla/vanillameta/docs/testing/calculation-followup.md).

### E3

[docs/testing/enterprise-integrated-mysql.md](/Users/moonklabs/workspace-vanilla/vanillameta/docs/testing/enterprise-integrated-mysql.md) · [docs/testing/delivery-recovery.md](/Users/moonklabs/workspace-vanilla/vanillameta/docs/testing/delivery-recovery.md) · [docs/testing/group-delivery-recovery.md](/Users/moonklabs/workspace-vanilla/vanillameta/docs/testing/group-delivery-recovery.md) · [docs/testing/received-copy-recovery.md](/Users/moonklabs/workspace-vanilla/vanillameta/docs/testing/received-copy-recovery.md) · [docs/testing/enterprise-access-matrix.md](/Users/moonklabs/workspace-vanilla/vanillameta/docs/testing/enterprise-access-matrix.md).

추가로 [공유·포크의 실제 2·3사용자 검증](/Users/moonklabs/workspace-vanilla/vanillameta/docs/testing/shared-fork-verification.md)을 재사용한다. 사본에서 원본을 찾는 계보와 링크 경로 수신함은 이 증빙에서도 별도 공백이다.

### E4

[docs/testing/document-connections.md](/Users/moonklabs/workspace-vanilla/vanillameta/docs/testing/document-connections.md) · [docs/operations/google-documents.md](/Users/moonklabs/workspace-vanilla/vanillameta/docs/operations/google-documents.md).

### E5

[docs/testing/remote-oauth-codex.md](/Users/moonklabs/workspace-vanilla/vanillameta/docs/testing/remote-oauth-codex.md) · [docs/testing/remote-ai-oauth.md](/Users/moonklabs/workspace-vanilla/vanillameta/docs/testing/remote-ai-oauth.md).

### E6

[docs/testing/mcp-artifact-authoring.md](/Users/moonklabs/workspace-vanilla/vanillameta/docs/testing/mcp-artifact-authoring.md).

### E7

[docs/testing/rill-scenarios.md](/Users/moonklabs/workspace-vanilla/vanillameta/docs/testing/rill-scenarios.md).

### E8

[docs/testing/external-beta-m1-quota.md](/Users/moonklabs/workspace-vanilla/vanillameta/docs/testing/external-beta-m1-quota.md) · [docs/testing/external-beta-m2-llm.md](/Users/moonklabs/workspace-vanilla/vanillameta/docs/testing/external-beta-m2-llm.md) · [docs/plans/external-beta-launch.md](/Users/moonklabs/workspace-vanilla/vanillameta/docs/plans/external-beta-launch.md).

## 조사 산출물과 제한

- [행별 기계 판독 원본](/Users/moonklabs/workspace-vanilla/phase2-evidence/artifact-implementation-audit-20261029/scenarios.json).
- [Figma 현재 프레임 목록](/Users/moonklabs/workspace-vanilla/phase2-evidence/artifact-implementation-audit-20261029/figma-journey.json).
- [보고서·수신자·요약의 실제 Figma 텍스트](/Users/moonklabs/workspace-vanilla/phase2-evidence/artifact-implementation-audit-20261029/figma-report-requirements.json).
- [기존 제품 저장·재열기 캡처](/Users/moonklabs/workspace-vanilla/phase2-evidence/artifact-hub-completion-20261029/studio-saved-reloaded.png).
- [기존 Figma 보고서 캡처](/Users/moonklabs/workspace-vanilla/phase2-evidence/existing-screen-catalog-20261026/design-completion/sales-report-journey-20261028/reopened.png). 과거 캡처이며 최신 문구는 위 Figma 텍스트가 우선한다.

Prove It Works에 따라 Figma 프레임·코드 타입·실제 실행 증빙을 따로 대조했고, 파일 존재나 빌드만으로 기능 완료를 선언하지 않았다. Sequence Work into Verifiable Units에 따라 비공개 저장·재열기, AI 본문, 조직 수신자, 갱신·재게시로 후속을 나눴다.

현재 제품 전체 수용·최신 HEAD의 모든 과거 기능 재실행·디자인 픽셀 동등성은 이번 조사 결과에 포함하지 않는다. 추적 파일은 이 문서만 추가한다. 기존 제품 코드·설정·Figma 디자인·권한은 변경하지 않으며 커밋·push·배포하지 않는다.


## 독립 검토 결과

읽기 전용 GPT-6 Astra 검토는 R07/S02/S05의 고정 보고서·과거 게시본·조직 수신자 공백, O01/O02의 갱신 복구와 사용량 범위를 확인했다. U3의 원본 데이터 비공개 조건은 기존 source read 전달을 그대로 재사용할 수 없다고 지적했다. 위 실행 순서에 보고서 revision 전용 권한·정제 조회·직접 profile API 거절 인수 조건을 추가했다. 제품 취약점 수정이나 새 runtime 통과를 주장하지 않는다.
