# UC052 Studio 공통 조건 연결 검증

2026-10-18 · develop-v2 · 기준bddd2ec5 · [설계](../plans/UC-052-studio-conditions.md). FR018/019/020·NFR005/006/008·TC050 E04/E05/E08의 선택 구현이다. 추가16개 요건 전체 수용은 미완료다.

## 구현 계약

소스의 저장 포함/제외 조건을 Studio에서 읽고 명시 적용한다. 읽기만으로 질문/초안/실행은 바뀌지 않는다. 공통 문서의 optional conditions와 setConditions 연산으로 직접 편집·제거·undo/redo·전체 미리보기 무효화·초안 복구/저장/reload를 연결한다. AI 내용 편집은 현재 조건을 보존하며 AI에게 조건 변경 권한을 새로 허용하지 않는다. 소스 조건의 나중 저장도 이미 적용한 복사본을 자동 변경하지 않는다.

조건 wrapper의 sourceRevision은 관리형 불변 파일 경로 hash다. 내용 checksum이나 소스 조건 이력의 metadata 포함 revision과 다르다. 현재 실제 native schema에서 전체 조건을 검증하며 파일 교체/유형 오류/열 누락/손상 wrapper를 없는 조건으로 처리하지 않는다. stale 저장본 GET은 초안을 보존하면서 미리보기 오류를 반환하고, 명시 해제 후 최신 파일로 다시 미리보기/저장할 수 있다. 외부에서 불변 파일을 직접 덮어쓰는 변형은 이번 hash로 탐지하지 않는다.

숫자·차트·추세·현재/이전 기간·상세 행·Pivot·기존 CSV는 기존 filters/dateRange와 조건을 AND로 조합한다. 별도 Dataset 소비자도 범위를 유지하도록 검증된 고정 query와 bindings를 안전한 literal로 렌더링해 저장한다. quote/Unicode/세미콜론 값·인용된 질문표와 저장 크기를 검사하며 임의 문자열 보간/새 의존성은 없다. 조건을 사용하지 않는 기존 query 동작은 유지한다.

새 공개 게시 응답에는 조건 적용 여부와 집계만 추가하고 조건 정의/열/값/SQL/파일 hash를 추가 공개하지 않는다. opt-in private recipe는 전체 조건을 보존하고 유지하는 모든 블록에 조건 열 연결을 요구한다. 원본/수신자 실제 유형을 검증하며 누락/충돌 매핑은 전체 저장을 막는다. 새 복사본의 조건은 수신자 파일 hash로 고정한다. 원본/권한/ID/비대상 배치는 보존한다.

일반 withDuckDBSnapshot도 공통 확정 metadata capture를 사용한다. SQLite rollback될 연결을 읽는 실제 반례를 수정했다. 상위 Studio lease가 긴 SQL을 점유하는 범위와 운영 처리량은 별도이며 이번 수정으로 모든 SQL이 큐 밖이라고 표현하지 않는다.

## 선택 검증

Git 제외 `.aiwf/evidence/UC052-studio-conditions/`에 명령별 로그를 보관한다. 제품 코드/실제 SQLite·DuckDB 검증과 FE mock 응답 검사를 구분한다.

- Main 문서/연산/AI run: 3 suites134 PASS. 실제 Studio23 PASS는 중첩 포함·제외200/해제500·영속 Dataset 재실행·일반 AI 저장 후 재실행200·ID/배치/SQL 보존·파일 교체 후 초안 유지/명시 해제/1000 재저장과 거절 시 쓰기0을 확인했다.
- 실제 snapshot RED는 rollback될 열을 반환하는 실패1건이며 수정 후 기존 snapshot 포함2 suites8 PASS. 기존9개 query/상세/Pivot/export 소비자 회귀263 PASS다. 미구현 모듈 compile 실패를 동작 RED로 세지 않는다.
- 게시/복제: modern/legacy10 suites207 PASS. 신규17개는 실제 SQLite/DuckDB로 공개 리터럴 비노출·집계·완전 매핑/누락 거절·수신자 hash·scope drop 주입 rollback과 원본 보존을 검사한다.
- FE Pivot 보존5 files72 PASS, UC052 타깃25 PASS/357 SKIP(총382)와 별도 초기190 PASS를 구분한다. skipped를 통과 수로 세지 않는다. mock 요청/문서 roundtrip·명시 적용/제거/undo/redo·late 응답/409/초안/질문 보존·전체 조건 필드 매핑과 Pivot/CSV 요청 범위를 검사한다.

최종 전체 검사·독립 검토·문서 패킷 결과는 아래에 추가한다. 과거 실패 로그는 남기고 최종 재실행과 구분한다.

## 미실행/후속

Ego TaskSpace96은 사용자 제어 중이다. 제어 반환 전 실제 Ego 질문→미리보기→저장→새로고침과390/768/1440 크기·정렬/키보드·새 조건 UI는 BLOCKED/NOT_RUN이다. CSS/DOM 단위 및 기존 core를 새 화면 증거로 대체하지 않는다. 이번 단위 실제 MySQL·실휴대폰·실LLM/임의 자연어 조건 제안·운영/사람 수용도 미실행이다.

AI 조건 제안/변경 차이·분포/표본·업무 변수 의미 실행·이름별 조건 세트·영속 export 작업/파일 권한·전체 TC050 E04/E05/E08/E13 수용은 남아 있다. 기존 private CSV의 문맥/정답을 영속 export 요건 완료로 확대하지 않는다. MK AI 연동 계약은 계속 제외한다.

## 통합 회귀와 독립 검토

첫 통합 전체 BE는157 suites2626 PASS이며 MySQL opt-in9개/1 suite SKIP다. 이는 아래 독립 검토의 raw save 경합 보완 전 실행이다. 전체 FE 첫 실행의 Widget fixture2건은 분석 범위 로딩의 fail-closed 경로에 의존하던 테스트를 명시 격리해24 PASS로 재검증했다. 두 번째 전체 FE는1682 PASS/2 timeout이며 해당 SourceDetails 파일 전체175 PASS를 별도로 확인했다. 실패/timeout을 전체 통과로 바꾸어 기록하지 않는다.

최초 독립 검토는3건으로 BLOCK했다. Pivot client CSV의 미확인 export 허용·조건 있는 mixed recipe의 unsupported 블록 검증 불일치·raw save의 preview 후 파일 교체 경합이다. 각 보완/회귀와 최종 검토를 분리해 아래에 기록한다.

기존 Chromium core8개 PASS(30.2s)는 격리 DB·테스트 서버를 사용하고 종료 후 정리했다. 로그인·CSV 집계/저장·Explore/Pivot 복원·공유/임베드·보호 경로의 기존 회귀이며 새 조건 화면의 실제 Ego 검증은 아니다. BE/FE 빌드와 type·선택 lint/formatter를 검사했다. Main spec fixture의 formatter 차이는 지역 Repository 변수로 정리했고 해당 lint를 재검증했다. AIWF strict는0 errors/기존 FR011·NFR002 상태 경고2개로 exit1이다. 상태를 임의 승인/Verified로 변경하지 않는다.

Pivot/Explore 보존 후속의 실제 DuckDB oracle5개는 필터/날짜·중첩 포함/제외를 AND로 적용한 KPI100/이전50·추세40/60·계층 합계·ratio12.5/이전50÷7·상세2행·classic/flat Pivot·private CSV 문맥/권한을 확인했다. 기존7 suites265 PASS와 type/lint도 별도 기록한다. sourceRevision의 두 계약을 서로 비교하지 않고 조건 wrapper를 실제 불변 파일 hash와 비교한다.

### 독립 검토3건 보완

CSV는 optional canExport가 생략돼도 매 다운로드마다 현재 서버 export 권한을 확인한다. 권한 거절/손상/조회 실패·늦은 응답은 Blob을 생성하지 않는다. 혼합 recipe의 조건 필수 열 검증은 서버와 같이 supported 블록만 요구하며 unsupported 블록은 명시 제외 전 생성을 막는다. FE4 files41 PASS/0 SKIP·type/lint PASS다.

raw AI 저장은 첫 쓰기 전 같은 transaction manager로 현재 연결의 파일 hash를 읽어 prepared/조건 pin과 비교한다. 실제 SQLite/DuckDB의 신규·기존 저장에서 preview 뒤 파일 교체를 주입한 RED를 확인했고, 수정 후409·저장 DML 시도0·기존 저장본/입력 보존을 검증했다. 최종5 suites93 PASS·type/lint PASS다. MySQL/MariaDB는 pessimistic_write current read로 commit까지 파일 교체와 직렬화하도록 했으나 이번 단위의 실제 MySQL 경합 실행은 NOT_RUN이다. 일반 상위 snapshot을 최신 파일 검사로 오인하지 않는다.

독립 검토자는 수정3건만 재검토해 모두 CLOSED/CLEAR로 확인했다. FE closure5개와 실제 SQLite 파일 교체2개를 독립 재실행했으며 skip을 합산하지 않았다. 이 결과는 전체 구조/제품 승인이나 미실행 MySQL/Ego/모바일/운영 수용이 아니다.

### 최종 전달 검사

검토 보완 후 전체 FE는 worker2로 제한해116 files1689 tests PASS(72.19s)다. timeout 한도를 늘리거나 테스트를 생략하지 않았다. BE 전체2626 PASS 뒤 변경한 raw save는 위93개 선택 회귀와 최종 type/lint/build로 검증했고, 전체 BE 재실행으로 표현하지 않는다. 최종 BE/FE build exit0·모든 대상 formatter/diff check PASS다. 최종 빌드의 영향받은 Pivot 저장/reload/복원/CSV 브라우저1개도 PASS(10.6s)다. 기존 core8개와 합산해 새 조건 화면 검증으로 확대하지 않는다.

문서 pin/check와 검증 패킷은 로컬 추적이며 사람 승인/수용이 아니다. 알려진 비공개 기업 식별 문자열/출처 지문 검사는 공개 대상85개 파일에서0건이다. 비공개 자료·실행 로그/임시 DB·다른 OMX 상태 파일은 커밋하지 않는다.
