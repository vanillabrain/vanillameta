# UC024 누락 열 블록 제외 재사용 검증 — 2026-10-16

[설계](../architecture/reuse-block-selection.md)·[UC](../use_cases/UC-024-reuse-selected-blocks.md)·[TC](../test_cases/TC-024-reuse-selected-blocks.md). 기준 develop-v2 `e98aacc8` 및 이번 변경, 기존 FE3698/API4899→4898/SQLite. Ego55 하나와 `/tmp/vm-reuse-selection/` 증빙을 사용했다. 기존 사용자 데이터/DB를 초기화하지 않았다.

## 부족점과 구현

TC005 A4의 필요한 필드 표시·저장 차단은 있었지만 해당 블록을 제외해 계속하는 기능은 없었다. 기존 reuse draft에 블록 ID·제목·필요 열 이름만 추가했다. UI는 기본 전체 포함, 블록 선택은 접고 미연결 블록이 있으면 펼쳐 필요한 열을 표시한다. 제외는 자동으로 하지 않는다.

preview의 선택적 blockIds는 최소1개·중복/타 원본 ID 없음으로 검증한다. 서버는 원본 순서대로 선택한 정의와 필수 연결만 계산하고 모든 폭의 해당 좌표를 보존한다. 명시한 선택에 불필요한 매핑도 거절한다. 생략은 기존 전체 포함 계약이다. SQL·원본 소스/인증·결과를 metadata에 추가하지 않으며 기존 opt-in/로그인/본인 소스·버전·중지 검사를 유지한다. 저장은 기존 ticket/requestId 원자 저장으로 새 ID의 비공개 복사본을 만든다. 새 DB·의존성·LLM 호출은 없다.

첫 실제 소유 미리보기에서 레거시 layoutSizes가 제외 전 개수로 남아400 `invalid layout sizes`가 발생했다. 원본 인덱스에 따라 positional 배열도 함께 투영하고 두 번째 블록만 선택하는 저장 회귀로 고정했다. `owner-first-attempt.json`이 실패, `owner-selected-preview.json`이 보완 후201이다.

## 실제 화면/XHR

1. 소유 분석27/source28 전체 Rill1391572행의 평균 블록을 명시 제외→2블록 미리보기201. 아직 저장하지 않는다.
2. 원본27을 공개 Rill 검증용으로 임시 게시했다. 최초 version4는 재사용false여서 수신자404였다. 실제 체크 상태true와 preview allowReuse:true를 확인한 뒤 같은 URL version5로 재게시해 수신자 접근을 열었다. 빠른 자동 조작의 체크 상태 미확인 결과를 권한 우회나 성공으로 집계하지 않는다.
3. 다른 계정 수신자의 기존 누락 소스30을 선택했다. 요청/가격/OS를 각각 my_requests/my_floor/my_os로 연결해도 평균 블록의 has_bid_floor_cnt 연결이 부족해 preview/save가 막혔다. 영향 블록과 필드가 화면에 표시됐다(`missing-block-state`, `missing-390.png`).
4. 평균 Bid Floor만 명시 제외→필요 연결2/2·블록2/3. 요청 수634,513,000 +169점 추세와 OS28그룹 전체 미리보기201. 제외한 가격/분모 매핑은 payload에 없다.
5. 평균을 다시 포함→이전 미리보기와 저장 ticket 무효, 누락 안내/저장 비활성. 다시 제외→새 ticket으로 재미리보기→복사본33 저장201. 저장은 ticket/requestId만 보낸다.
6. 새로고침 후 source30·2개 새 블록 ID·원래 순서·모든 폭 좌표가 같았다. 새 게시version0/비공개다. reload XHR에는 추가 저장/게시0이다. 원본27의 editor 응답은 작업 전후 전체 동일했다.
7. 임시 게시 중지→version6/inactive·링크404. 복사본33의 editor 응답은 계속200/동일하다. 분석/소스/복사본을 삭제하지 않았다.

`recipient-preview`, `recipient-save`, `saved-copy`, `reloaded-copy`, `restored-selection-invalidates`, `original-before/after`, `copy-after-revoke`, `final-publication`, `assertions.json`에 기록했다. SQL 없는 수신자 preview와 metadata, 서버 권한/중지·원자 저장 회귀도 확인했다. 기존 자동 승인 검토가 거절했던 타 계정 변경 POST를 재시도하지 않았다. 수신자 자신의 새 복사본 저장은 정상 권한 경계 안의 동작이다.

## 수치·UI

원본 데이터는 TC005와 같은 canonical 파일이며 source30은 열 이름 변경/평균 분모 열 누락 외 값이 같다. 독립 oracle과 요청634,513,000·OS28개 모든 값이 정확 일치했다. 기존 TC005의 실제 Rill aggregation 비교는 데이터/계산 변경이 없어 재사용했다. 이번에 Rill의 복제 UI나 LLM을 새로 실행한 것은 아니다.

기능 PASS와 대표 디자인 PASS를 구분한다. 실제 캡처를 읽고 미연결·선택·제외·미리보기·긴 복사본 제목·저장 상태를 확인했다. 선택 행은 전체 label 클릭 영역, 기존 Checkbox16px·입력/일반 버튼36px, 본문14px/보조12px를 재사용한다. 가로 넘침0, 모바일은 세로·데스크톱은 제목/소스2열과 선택2열이다. 기본에는 블록/열 설정이 접혀 있다. 기존 원본의 아래쪽 좌표/공백을 자동 압축하지 않았다.

`selected-preview-*`, `saved-*`: CSS390/1440, 태블릿 요청768은 사이트 확대율 반올림으로 실제769다. 치수 JSON에 실제 폭을 기록했다. 물리 휴대폰/모든 상태 조합의 검증은 수행하지 않았다.

## 검사·리뷰와 한계

- BE 선택/재사용/수신자/remap43개, FE 재사용/게시33개 PASS. 새 동작 없는 기존 기대 metadata 키 검사에는 blocks를 추가했다.
- 전체 BE97 suites1691개·FE68 files1019개, 루트 build, 변경 파일 eslint·FE type PASS. 통합 전에는 기존 core8개를 재실행하지 않고 Ego의 새 흐름과 SQLite 회귀를 실행했으며, 아래 원격 통합 후 별도로 core를 실행했다.
- Main은 구현 후 별도 리뷰 패스로 권한·선택/순서·배치·ticket 무효화와 문서 대조를 수행했다. 독립 외부 리뷰를 받은 것으로 표기하지 않는다. glossary/entity_model은 새 영속 개념이 없어 변경하지 않는다.
- strict lint는 기존 UC007~010의12오류/33경고를 유지한다. 신규UC024 오류0. pin/check는 drift 검사이며 packet은 awaiting_review/acceptance not_recorded다.

운영MySQL·실휴대폰·모든 동시 경합/자연어·기존 거절된 타 계정 변경 POST 실제 실행·제품 수용은 별도 Open이다. 이 개선은 필수 열이 없는 블록의 명시 제외이며 임의 계산 변경/열 유추/자동 제외를 추가한 것이 아니다.

## 원격 Studio 통합 후 추가 검증

완료 직전 원격 develop-v2의15개 커밋(`bbd55328`, Studio T10~T15/호환성 병합)을 발견했다. UC024를 `79110391`에 먼저 보존하고 원격을 `385a6afe`로 병합했다. UC024 런타임 파일 충돌/변경0이며 원격 AGENTS/TC005의 Studio·분석 증빙도 함께 보존했다. 원격의 MUI/Emotion4개 의존성은 lockfile 그대로 `npm ci --legacy-peer-deps`로 설치했다. 새 패키지를 임의로 선택하지 않았다.

- 통합 전체 BE116 suites: 2030PASS/6FAIL. 실패2파일6개는 supertest의 listen EPERM(소켓 샌드박스)이었고 권한을 허용한 해당 publication/remix HTTP 파일을 재실행해 모두 통과했다. 함께 실행한 execution HTTP3개는 중복이므로 고유 수에 합산하지 않는다. 전체2036개 중 고유 미해결 실패0이며 전체 명령 한 번에 green이었다고 보고하지 않는다.
- 통합 전체 FE89 files:1246PASS/1FAIL. 기존 SourceDetails의50개 선택 회귀1개가5000ms 제한시간을 넘겼다. 소스 변경 없이 해당 파일174개를 단독 재실행해 모두 통과했다. 전체1247개 중 고유 미해결 실패0이며 개별 실행과 구분한다.
- 최종 루트 build·FE type PASS. 원격에서 추가한 PublishedRoute는64hex Studio/UUID 분석 링크를 형식으로 분리하며 거절 후 fallback하지 않는다. Studio MUI ThemeProvider는 별도 경계로 국소 적용되고 기존 reuse 화면의 코드/UI Kit는 그대로다. 해당 라우트·테마 회귀도 통합 FE에 포함됐다.
- 기존 SQLite를 별도 backup한 복사 DB4902에서 통합 서버 기동·소유 copy33/source30의1블록 미리보기634513000을 확인했다. 이어 원본 DB를 backup한 뒤 기존4898도 최신 코드로 기동했다. 기존 dashboard/database/dataset/widget/metric 및 관련 테이블의 행 수·전체 해시가 모두 유지됐고4899 경유 동일 미리보기 API도 PASS였다. 추가 저장/게시0. 원격 Studio의 엔티티/마이그레이션은 원격 통합 범위이며 UC024가 새 DB 계약을 추가한 것은 아니다.
- 별도 복사 DB 서버는 종료했다. 기존 서버·프록시는 정상 유지한다. 임시 UC024 링크는 계속 중지 상태다.

Ego55 실제 화면 증빙은 `79110391`까지의 UC024 코드·통합 전 기준이다. 통합 후 새 Ego 공간을 열어 Studio 화면/새 LLM 흐름을 재실행하지 않았다. 통합 후 실제 검증은 위 단위·빌드·API 및 아래 격리 core 로그 범위이며 이를 Studio 전체 제품 수용으로 확대하지 않는다.

격리 core E2E8개 PASS (`/var/folders/_k/_fd433317sv9bwb5hgwyckv80000gn/T/vanillameta-qa-o2zcdB/evidence/playwright-001.log`). 탐색/Pivot, 파일→차트/저장, 로그인/로그아웃, 위젯→대시보드→공유·임베드와 smoke를 확인했으며 사용자 DB는 사용하지 않았다.

## Studio 통합 후 Ego 실제 화면 후속 — 2026-10-16

기준 `1b18e38a`와 이번 소스 선택 안내 수정이다. Ego56 하나에서 기존 FE3698/API4899→4898과 사용자 DB를 유지했다. `/tmp/vm-reuse-integrated-ui/`에 XHR·치수 JSON·PNG·검사 로그를 남겼다. 이전 통합 전 Ego55와 구분한다.

- 원본27의 공개 Rill 검증 데이터만 재사용 허용 상태로 임시 게시(version7)했다. 통합 PublishedRoute의 UUID 링크 → 실제 ‘내 소스로 복제’ 클릭 → 다른 계정의 재사용 화면 진입을 확인했다. Studio 전용64hex 게시 링크나 Studio 대화 전체를 검증한 것으로 확대하지 않는다.
- 모바일390px에서 수신자 누락 source30 선택·열 연결 → 평균 Bid Floor만 제외 → 요청/OS 두 블록 전체 미리보기201 → 복사본34 저장201을 확인했다. 평균을 다시 포함하면 이전 preview/ticket이 무효화되고 저장이 비활성화되며, 다시 제외·미리보기해야 저장할 수 있었다.
- 소스를 선택한 후에도 ‘내 소스를 선택해 주세요’ 안내가 남는 실제 문구 오류를 발견했다. shared이면서 sourceId가 없을 때만 안내하도록 수정하고 기존 수신자 회귀에 단언을 추가했다. 레이아웃 토큰·저장 계약은 바꾸지 않았다. 수정 후 같은390px 제외→미리보기→복사본35 저장→실제 새 문서 reload를 재검증했다. 첫34의 긴 제목 검사와 최종35의 기본 제목 검사를 구분한다.
- 최종 preview payload는 선택 블록2개와 `bid_request_cnt→my_requests`, `device_os→my_os`만 포함했다. 요청634,513,000·시계열169점·OS28그룹 모든 값은 기존 독립 canonical oracle과 정확 일치했다. 데이터/계산 변경이 없으므로 기존 Rill 수치 비교를 재사용했고 이번 Rill 화면/LLM 호출은 실행하지 않았다.
- 원본27 editor 전체 응답은 작업 전후 동일했다. 복사본35/source30은 새 ID2개·원래 순서·모든 폭 좌표를 보존했고 저장/새로고침/게시 중지 후 editor 응답도 동일했다. reload XHR의 추가 저장/게시0이며 읽기 계산 POST `/ai/dashboard-preview`는 별도로 구분했다. React 전환 중 취소된 계산(status0)은 이후201 완료와 구분한다.
- 임시 링크는 실제 UI에서 중지(version8)했고 익명 게시 조회404·복사본35 조회200을 확인했다. 테스트 복사본34/35는 삭제하지 않고 비공개로 보존한다.

**기능 PASS / 대표 디자인 PASS.** 실제 캡처를 읽고390/769/1440px의 미연결·제외 미리보기·저장 화면에서 크기/정렬/줄바꿈·가로 넘침0을 확인했다. 태블릿768 요청은 사이트 확대율 반올림으로 실제769다. 입력/일반 버튼36px, 도구32px, 입력16px·버튼14px의 기존 UI Kit를 유지한다. 제목/소스는 모바일 세로·데스크톱2열, 버튼은 같은 높이로 정렬된다. 원본이 지정한 아래쪽 숫자 블록 좌표와 공백을 자동 압축하지 않았다. `final-saved-full-390.png`는 아래 숫자+추세까지 포함하는 캡처다.

최종 관련 FE10개·FE type·변경 파일 eslint·FE build PASS(`unit/type/lint/build.log`). 신규 회귀의 첫 실행은 이 파일에 설정되지 않은 jest-dom matcher 때문에 실패했으며 기존 Chai `toBeNull`로 고친 뒤10개 모두 통과했다. 제품 동작 실패로 집계하지 않는다. 접힌 details 내부 클릭과 전환 전 화면을 기다린 검증 스크립트 오류도 펼침/새 문서 로드 조건으로 보완했으며 UI 차단으로 보고하지 않는다. 전체 BE/FE/core는 위 통합 결과 이후 이번 변경이 문구 조건1개이므로 반복하지 않았다. 운영MySQL·물리 휴대폰·모든 상태 조합·Studio 전체 수용은 여전히 Open이다.
