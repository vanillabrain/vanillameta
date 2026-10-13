# 대용량 집계 원본 상세·스크린리더 후속

2026-10-13, 기준 develop-v2 `1d81712c`. 기존 PREV-INPUT/KPI-INPUT/CONTRIB의 통과 조건은 반복하지 않는다. 기존 source22/dashboard23의 Rill 원본 1,391,572행·21열을 변경 없이 재사용한다. 저장·업로드·AI 생성 검사는 실행하지 않았으며 gpt-6-luna 설정 유지·모델 호출0이다.

## 선택 명세

| ID | 입력·기대 | 상태 |
| --- | --- | --- |
| DETAIL-LARGE-01 | 전체 COUNT 1,391,572행의 첫·다음 페이지25행과 원본 Parquet의 ORDER BY ALL 정답 대조. 현재09-13~15와 이전09-10~12의 같은09-11 주 시점은 서로 다른 범위의 입력이어야 한다. HTTP 크기·시간 기록 | PASS_SELECTED_VARIANTS |
| DETAIL-LARGE-02 | 25만·100만 offset의 깊은 페이지100행, 응답·RSS·독립 쿼리 계획 기록. 단일 조회5초/응답1MiB 이내를 이번 로컬 관찰 목표로 설정하며 출시 SLO·동시 부하로 확대하지 않는다 | PASS_SELECTED_VARIANTS |
| DETAIL-SR-01 | dialog 이름·설명, 표 caption·열 헤더, 조회 완료·페이지 변경·오류 안내와 현재/이전 문맥을 AX로 확인. 아래 후속에서 조회 중 안내도 보완했으며 실제 발화로 대체하지 않는다 | PASS_SELECTED_VARIANTS_AX_ONLY |
| DETAIL-SR-02 | 실제 macOS VoiceOver: 검증 창 고정→dialog 제목→표 열·셀 탐색→다음 페이지 안내→오류/복구→Escape·실행 버튼 읽기. 실제 발화·캡처 증거가 있어야 PASS | BLOCKED |

증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/detail-large-screenreader/`. FE3483/API4683·메타데이터 DB·서버 DuckDB 워커를 유지했다. 원본은 모든 컬럼의 ORDER BY ALL로 정렬하며 물리 중복을 제거하지 않는다. 순차 조건만 실행하고 인위적 동시 장애·전체 회귀를 추가하지 않는다.

## 실제 성능 — 2026-10-13

원본 Parquet SHA256 `7549d18b0294932802407f6bd851a807ff88ba1406b2958bbd8b4c261a4ee157`를 별도 메모리 DuckDB로 읽어 정답을 계산했다. 전체 COUNT 1,391,572행, 현재09-13~15의09-11 시작 주 입력596,293행, 이전09-10~12의 같은 주 입력397,680행(09-11~12 교집합)이 일치한다. 전체·현재·이전 각각 page0/page1의25개 원본 행·21컬럼을 정답과 전부 대조했으며 물리 중복을 유지한다.

| 선택 조회 | 관찰 시간 | 응답 크기 |
| --- | ---: | ---: |
| 전체 첫 페이지, 실제 UI 요청 | 1,095ms | 17,437bytes |
| 전체 다음 페이지 | 216ms | 17,079bytes |
| 현재 주 시점 page0 / page1 | 335 / 365ms | 17,388 / 17,414bytes |
| 이전 주 시점 page0 / page1 | 335 / 334ms | 17,544 / 17,449bytes |
| 25만 offset, page2500·100행 | 761ms | 64,653bytes |
| 100만 offset, page10000·100행 | 765ms | 63,811bytes |

두 깊은 페이지의100개 원본 행도 별도 정답과 모두 대조했다. 처음 UI 요청의 시간은 클릭부터 응답 JSON 수신까지이며 최종 화면 paint 시간으로 해석하지 않는다. 첫 응답의17,437bytes는 파싱 후 JSON 재직렬화 길이이며 다른 API 응답은 수신 body 길이다. 압축된 wire bytes를 측정한 것은 아니다. 한 번씩 순차 실행한 관찰이며 p95·반복 부하·진짜 cold cache는 검증하지 않았다. 이번 로컬5초·1MiB 목표 안에서 선택 PASS다.

Mac17,2·32GiB에서 API Node PID99851 RSS 관찰값은66,752KiB, 첫 조회 뒤72,144KiB, 기간·25만 offset 뒤93,248KiB, 100만 offset 뒤70,496KiB다. 이는 관찰 지점이며 피크·사용 상한·메모리 누수 없음을 증명하지 않는다. 워커 코드 기본값은512MB·spill2GB·단일 작업·16대기·작업별60초 제한이다. 실제 운영 환경의 보장으로 해석하지 않는다.

독립 Parquet EXPLAIN ANALYZE의25만 offset 정렬은 전체1,391,572행 scan·ORDER_BY, 최종 보존 계획의 총 시간은0.389초였다. 앞선 관찰0.363초와 구분한다. 제품의 영속 DuckDB 계획과 같다고 주장하지 않는다. 제품 경로는 매 페이지 schema·group·count·row의 순차4개 작업을 수행한다. page 상한은10000이며 최대100행에서도1,000,100행 이후391,472행은 순차 탐색할 수 없어 필터로 좁혀야 한다. 현재 안내는 ‘조회 한도에 도달했습니다. 필터로 범위를 좁혀 주세요.’다. 무제한 전체 행 탐색 완료로 보고하지 않는다.

단일 로컬 조건에서 성능 오류는 발견하지 않았다. 브라우저 abort의 실제 서버 작업 중단 전파, 요청 전체 deadline, 정렬/count 반복, 공유 워커 동시 부하는 후속 운영 위험이며 이번 순차 관찰 PASS로 해소하지 않는다.

## 실제 AX·자동 접근성 선택 결과

390px 상세25행·100행과 이전 기간397,680행의25행 상세를 설치된 axe-core로 WCAG2A/2AA/2.1AA 선택 검사했다. 각 violation0/incomplete0이며 전체 사이트 WCAG 준수 결과가 아니다. 이름 있는 dialog·연결된 설명, 표 caption·22개의 열 헤더(원본21+구성요소), 페이지 status의 `aria-live=polite`가 AX에 노출된다.

이전 기간09-10~12와 현재 비교 기준09-13~15가 별도 문장으로 제공된다. 실제 시점09-11 주 입력만397,680행이다. 다음 페이지의 caption/status는2페이지·25행으로 갱신되며 별도 정답page1과 일치한다. 읽을 정보의 구조를 확인한 것이며 실제 발화 성공은 아니다. 조회 중 live 안내·발화 시점은 이번 선택 검사에 포함하지 않았다.

503 route fixture는 error `alert`로 노출되고 재시도 뒤 실제596,293행·100행 표의 `status`/`polite`로 복구된다. 이는 접근성 정보 관찰용이며 기존 기능 오류 복구 전체 케이스나 실제 서버 장애 검증이 아니다. `ax-error-recovery.json`, error/recovery AX와 화면을 기록했다. 문서 scrollWidth/viewport는390/390이다.

자동화에서 summary를 getByLabel로 찾은 오류, 첫 이전 시점09-04를09-11로 가정한 오류는 하네스 오류였다. 올바른 summary 텍스트·추세 End 선택 후 남은 이전 AX 조건만 검증했다. 긴 PTY 입력 잘림과 응답 대기 Promise 오류로 종료된 하네스는 파일 기반 실행·전용 Node24 브라우저로 복구했다. 제품 결함으로 보고하지 않는다.

## 실제 VoiceOver 차단 상태

Aside guide/repl 뒤 listBrowserTabs를 실제 호출했으나 daemon 인증 challenge fetch 실패였다. 앞서 허용된 headed Chromium fallback으로 화면·AX·axe를 검증했다. computer-use Orca 가이드 뒤 capabilities/open은 `runtime_unavailable`/`runtime_open_timeout`이었다. CUA의 명시 Chromium 경로·VoiceOver 선택은 `timeoutReached`, 정확한 OS 창을 읽는 System Events는 보조 접근 권한 없음(-1728)으로 막혔다.

VoiceOver `open` exit0만으로 활성화·발화를 주장하지 않는다. 설치된 공식 `VoiceOver.sdef`의 last phrase content를 호출했으나 응답하지 않아 해당 osascript만 중단했다. 확인되지 않은 다른 창에는 입력하지 않았고 사용자 프로세스를 종료하지 않았다. 실제 발화·읽기 순서 DETAIL-SR-02는 **BLOCKED**다. `voiceover-blocker.json`에 도구 결과를 남겼다. OS 보조 접근 권한과 검증 창 연결이 준비된 환경에서 이 조건만 이어서 실행한다. AX·키보드 성공으로 대체하지 않는다.

## 보존·검사·증빙

모델 설정·제품 코드 변경0, 신규 리소스 생성0이다. 기존 source22/dashboard23의 저장 revision은 바뀌지 않았다. 전용 검증 창만 닫았으며 기존 데이터를 삭제하지 않았다. API 서버는 Node24, 초기 재사용 브라우저 하네스는 Node22였고 최종 미완료 AX 창은 Node24로 기동했다. 브라우저는 headed Chromium153이었다.

제품 코드 변경이 없어 단위·빌드·기존 통과 E2E는 실행하지 않았다. diff·변경 MD 링크만 검사했다. 성능·접근성 증빙은 다음 파일을 함께 사용한다.

- 수치·시간: `performance-api.json`, `first-large-detail.json`, `last-accessible-page.json`, `independent-oracle.json`, `memory-observations.json`.
- AX: `axe-dialog-before.json`, `axe-dialog-max100.json`, `axe-previous-dialog.json`, `ax-previous-page.json`, `ax-error-recovery.json` 및 AX 텍스트·캡처.
- 차단·보존: `voiceover-blocker.json`, `preserved-fixture.json`, `verification-results.json`.

DETAIL-LARGE-01/02 및 DETAIL-SR-01은 선택 PASS다. 실제 VoiceOver DETAIL-SR-02는 BLOCKED로 남기며 DESIGN-04 전체의 부분 완료·기존130개 카탈로그 집계를 유지한다.

## 조회 중 상태 안내 후속 — 2026-10-13

기준 `ab7e63dc`에서 앞서 미확인으로 남긴 조회 중 상태만 선택했다. 기존 진행 막대에는 이름이 있었지만 live status는 없어 수동 탐색 없이 조회 중임을 알리는 구조가 부족했다. `loading-before-ax.txt`와 `loading-before-mobile.png`가 수정 전 증거다.

SourceDetails의 동일한 상태 영역을 유지하면서 `role=status`, `aria-live=polite`, `aria-atomic=true`로 조회 중 페이지/행 수와 완료 결과를 갱신한다. 오류는 기존 alert로 제공하고 상태 텍스트는 비운다. 최초 모바일390px, 다음 페이지 데스크톱1440px, 503 fixture 뒤 Enter 재시도의 조회 중 상태를 AX·화면에서 확인했다. 재시도 중 닫기 버튼의 초점과 완료 후 Escape의 실행 버튼 복귀도 확인했다. 실제 VoiceOver 발화는 여전히 BLOCKED다.

증빙: `loading-after-mobile.png`, `loading-page2-desktop.png`, `loading-retry-desktop.png`와 각 `*-ax.txt`, `loading-completed-desktop.png`, `loading-verification.json`. 2.2초 응답 보류는 브라우저 관찰용 fixture이며 실제 DuckDB 지연 성능으로 해석하지 않는다. 완료 화면 axe는 violation0, incomplete1(페이지당 행 수 select의 배경 겹침 판정 불가)로 자동 대비 전체 PASS를 주장하지 않는다. 전환 중 나온 임시 대비 오류와 최종 결과는 각각 `loading-completion-axe.json`, `loading-completion-axe-stable.json`에 분리했다.

기존 대용량 수치·페이지 정답과 이미 통과한 E2E는 반복하지 않았다. FE 타입·변경 파일 lint·빌드가 통과했고, 변경 컴포넌트 단위174개(새 live 상태 회귀 포함)가 통과했다. API는 기존4683, FE는 서버가 허용한 `http://127.0.0.1:3483`을 재사용했다. localhost 출처 실패·10초 이상 보류한 하네스 종료는 제품 실패와 구분한다. 임시로 기동한3484 서버·검증 창·개인 로그인 파일만 정리했다. 저장된 정의·파일은 변경하지 않았고 AI 호출0/gpt-6-luna를 유지한다.
