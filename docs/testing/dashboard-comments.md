# 대시보드·차트 댓글 1조각 검증

[계획](../plans/dashboard-comments.md)의 1조각(웹 댓글)을 검증했다. 2조각(원격 MCP)은 아직 구현하지 않았다.

증빙 디렉터리: `/Users/moonklabs/workspace-vanilla/phase2-evidence/dashboard-comments-20261103`

## 시나리오

대상은 로컬 SQLite의 대시보드 6("QA Sales Studio Verification", 분석 정의와 `block-<uuid>` 블록 보유)이다. 소유자는 `guest`, 읽기 권한자는 이번에 만든 조직 1 구성원 `qaslice1reader`(대시보드 6과 소스 5 read 정책)다.

| ID | 시나리오 | 결과 | 증빙 |
| --- | --- | --- | --- |
| DCOM-01 | 소유자 보기 화면: 패널을 열기 전 머리글 "댓글"과 차트별 댓글 버튼 표시 | PASS | `01-owner-dashboard-before-panel-1440.png` |
| DCOM-02 | 읽기 권한자가 차트 카드 버튼으로 차트 스레드 작성. 자기 스레드만 보이고 해결 버튼 없음 | PASS | `02-reader-chart-comment-panel-1440.png` |
| DCOM-03 | 소유자가 읽기 권한자 스레드(차트 라벨)를 보고 답글, 대시보드 전체 댓글 작성 | PASS | `03-owner-panel-thread-reply-1440.png` |
| DCOM-04 | 소유자가 `/dashboard/6/edit-charts`에서 차트 제목 변경·저장 → 스레드에 "변경됨 · 현재 차트 · 새 제목", 스레드 클릭 시 카드 스크롤·강조 | PASS | `04a-…`, `04b-…`, `09-changed-flag-{1440,390}.png` |
| DCOM-05 | 소유자 해결 → 읽기 권한자 새로고침 후 해결됨, 소유자의 전체 스레드는 읽기 권한자에게 안 보임 | PASS | `05a-…`, `05b-…` |
| DCOM-06 | 390(전체 시트)·768(우측 시트)·1440(고정 패널)에서 가로 넘침 없음 | PASS | `06a/b/c-owner-panel-*.png` |
| DCOM-07 | 키보드: 머리글·차트 버튼 포커스 링, 머리글 버튼으로 열면 포커스가 패널로 이동하고 Escape로 닫히며 버튼으로 복귀 | PASS(수정 후) | `07a-…`, `07b-…`, 페이지 내 실행 결과 |
| DCOM-08 | 권한 없는 사용자는 권한 없음 안내만 보고 댓글 UI 없음 | PASS | `08-reader-no-grant-1440.png` |
| DCOM-09 | 2조각 원격 MCP(2026-11-04). 실제 Claude Code 2.1.317: 임시 프로젝트 등록 → 로그인 요청 범위에 `dashboards:read` 포함 → 승인 화면에서 "대시보드 제목과 차트 구성 읽기(데이터 값 제외)" 기본 체크, 쓰기는 댓글만 허용 → `vm_list_dashboards`(대시보드 6만) → `vm_read_dashboard`(차트 2개, SQL·데이터 값 없음) → `vm_add_dashboard_comment`로 첫 차트 블록 댓글 → 소유자 웹 패널에 "차트 · QA Sales Studio Verification" 스레드, 작성자 "Claude · Claude Code (로컬 검증)". 검증 후 logout·등록 제거 | PASS | `dashboard-mcp-20261104/01-consent-1440.png`, `02-owner-dashboard-claude-comment-1440.png`, `claude-code-run.jsonl` |

API 상태(`api-status-summary.txt`): 목록 GET 200, 권한 부여 전 403 1회, 생성 POST 201×2, 답글 201, 상태 변경 201.

## 검증 중 고친 것

- 머리글 버튼으로 연 고정 패널에 포커스가 들어가지 않아 Escape가 동작하지 않았다. 패널이 열릴 때 포커스가 패널 밖에 있으면 패널로 옮긴다. 회귀 테스트를 더했다. Ego 동작 사이에는 페이지 포커스가 풀려(`document.hasFocus()=false`) 측정이 흔들리므로 페이지 안에서 연속 실행으로 확인했다.
- "변경됨" 표시가 메타 글씨와 같은 회색이라 잘 보이지 않았다. 대시보드 전용 `info` 표시를 강조색 배지로 바꿨다.
- 목록을 패널을 처음 열 때 불러오던 것을 대시보드가 로드되면 바로 불러오도록 바꿨다. 차트 버튼이 패널을 열기 전부터 보인다. 권한 거부·빈 레거시 대시보드에서는 부르지 않는다.
- revision 충돌 409에 `code: 'REVISION_CONFLICT'`를 붙여 상태 충돌 409와 구분한다.

## 자동 테스트

- PostgreSQL 17.11 임시 클러스터(`VM_REPORT_COMMENT_POSTGRES_PORT`): 대시보드 댓글 서비스 13개(실제 `DashboardDeletionService` 삭제 정리 포함), 보고서 댓글 migration 5개, 두 migration 적용 후 동기화 엔티티 일치 1개, 대시보드 migration 3개(SQLite) 모두 PASS. 검토에서 정리 쿼리의 camelCase 식별자를 직접 인용하도록 고친 뒤 실행했다.
- 백엔드 jest: 대시보드 댓글 서비스·migration 16개와 보고서 댓글·삭제·인수인계·라이프사이클·route inventory 등 회귀 14개 파일 중 13개 PASS. `src/data-source.spec.ts` 1건은 이번 변경 전부터의 실패다. 이 spec과 `data-source.ts`는 HEAD와 같고, PostgreSQL 전환(`59208ba1`) 뒤 `migrations/postgres` 밖에 남은 `AddAccountIntegrity1792430000000`를 기대한다.
- 프런트엔드 vitest: 대시보드 댓글 20개, 대시보드 보기·분석 카드·보고서 화면 회귀 11개 파일 204개 PASS.
- 최종 검토 후 더한 테스트: 보고서 경로에 대시보드 requestId를 쓰면 409이고 대시보드 스레드 ID를 내주지 않음(보고서·대시보드 서비스 spec 29개 PASS), 권한 거부 화면은 `/comments`를 부르지 않고 댓글 버튼이 없음(빈 레거시 대시보드는 기존 '요청은 `/dashboard/7`뿐' 단언이 확인). 대시보드 보기·댓글·보고서 화면 10개 파일 152개 PASS.
- `tsc --noEmit`(백엔드·프런트엔드), `nest build`, 바뀐 파일 eslint 통과.
- 2조각(2026-11-04): SQLite 백엔드 jest(대시보드 댓글·mcp-oauth·reports) 283개 PASS, PostgreSQL 17 임시 클러스터(`METADATA_DB_TYPE=postgres`)에서 대시보드·보고서 댓글 서비스와 두 migration 55개 2회 PASS, 프런트엔드 vitest(AI 연결·보고서·댓글) 178개 PASS. MCP 목록 허용 목록·조직·governed·삭제·비활성 제외, 검사로 빈 페이지의 커서, 구조만 읽기(SQL·업무 기준·소스 없음), AI 작성 기록과 열린 AI 스레드 상한, 트랜잭션 안 범위 재확인, 잠금 아래 조직 확인(소유자 조직 이동 경합), 웹·MCP 같은 requestId 분리, revision 변경 뒤 같은 입력 재시도는 이전 결과, 범위 조합별 도구 노출을 확인한다.
- `src/dashboard/personal-library.spec.ts` 4건은 HEAD(`3697c2df`)에서도 같은 실패다. 이번 변경과 무관하다.

## 계획과 다른 점

- 계획은 분석 정의가 없는 대시보드에 `whole` 댓글을 허용한다. 화면은 위젯이 하나도 없는 빈 레거시 대시보드에서 댓글 목록을 부르지 않고 버튼도 숨긴다. 논의할 내용이 없는 상태라 이번 조각에서 그대로 둔다. 서버는 이 경우에도 `whole`을 받는다.
- 대시보드 삭제 후 행 정리는 브라우저 시나리오가 아니라 실제 `DashboardDeletionService.remove`를 쓰는 서비스 spec(SQLite·PostgreSQL)으로 확인했다. 두 인수인계 경로는 정리 함수를 직접 부르는 테스트만 있다.

## 남은 것

- 같은 그룹 권한으로 보는 읽기 사용자는 서로의 스레드를 보지 못한다. "구성원 공개 스레드" 옵션이 필요할 수 있다.
- 각 스레드에 답글 입력창이 항상 열려 있어 스레드가 많으면 패널이 길어진다. 보고서와 같은 공용 컴포넌트 동작이다.
- 회원가입 API는 하이픈이 든 ID를 받지만 로그인 화면은 거부한다. 이번 범위 밖의 기존 불일치다.
- 2조각은 구현했다(DCOM-09). 계획의 `target` 인자 대신 대시보드 전용 도구 5개로 나눴다. 해결·재개 도구는 없다.
- 운영 배포 시 클라이언트 설정에 `dashboards:read`를 더하면 기존 연결이 끊겨 재연결이 필요하다. 기존 연결의 Claude Code는 이전 범위 목록을 기억할 수 있어 서버 이름을 새로 등록해야 새 범위를 요청했다.
- 로컬에서 MCP를 켜려고 `CONFIG_SECRET_KEY`를 따로 주면 기존 소스 연결 정보 복호화가 실패해 대시보드 데이터가 500이 될 수 있다. MCP 확인과 무관하며, 기본 설정으로 다시 띄우면 정상이다.
- blockId 길이: 저장은 128자까지, 댓글 앵커는 64자까지라 65–128자 blockId 차트에는 블록 댓글을 달 수 없다(기존 불일치).
- 보고서 MCP 댓글 목록(`McpReportService.threads`)은 grant 조직 확인을 하지 않는다(기존 공백). 대시보드는 같은 트랜잭션에서 확인한다.

## 테스트 데이터

`qaslice1reader`(user 10) 생성·조직 1 구성원 추가, `qa-slice1-reader`(user 9) 생성 후 비활성화(로그인 화면이 하이픈 ID를 거부). 대시보드 6·소스 5에 user 10 read 정책. 댓글 스레드 2개와 답글 1개. 대시보드 6 차트 2 제목을 "QA Net Revenue by Channel (검토 반영)"으로 변경(복구하지 않음). 임시 비밀번호는 저장하지 않았다. 2조각 확인에서 대시보드 6 첫 차트에 Claude 댓글 스레드 1개를 남겼다.
