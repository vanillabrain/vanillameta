# UC050 저장 분석의 지표 기준과 출처 확인

## 범위와 계약

2026-10-18·비교 기준 `ca69540b`. FR015·BR050-02·[계획](../plans/UC-050.md)의 저장 기준 읽기다. 새 API/DB 스키마/의존성 없이 기존 소유 Studio GET의 definitions.entries에 optional metricBasis를 더한다. 기존 dashboard/source 권한 검사는 유지한다. 저장 snapshot에서 sourceId/metricId/정의버전·block key·문서 measureRefs가 일치하는 단일 참조에만 sourceId/metricId/definitionVersion과 aggregation/column/denominatorColumn/weightColumn/scale/unit을 투영한다. 현재 Metric을 basis 생성용으로 다시 조회하지 않는다. 불일치/미연결은 생략하며 미확인 필드를 추정하지 않는다.

현재 정의 카탈로그의 widget/SQL·layoutSize와 GET 계산 preview는 미변경이다. metricBasis는 별도 whitelist 요약으로 SQL/연결정보·전체 메타데이터/원본 행을 포함하지 않는다. 소스 출처는 내부 source ID이며 새로운 외부 URL/기업 원문 출처를 노출하지 않는다. 기존 schema1 단일 링크와 schema2 저장 연결 규칙을 재사용하고, 존재하는 잘못된 key는 빈 문자열이어도 생략한다.

FE optional payload를 검증하고 기존 무기준 응답은 호환한다. Inspector는 선택한 블록의 종류/definitionKey·소스/참조와 맞는 entry만 받아 저장 기준과 출처ID/버전을 접힌 화면으로 표시한다. 현재 활성 AI preview override가 있으면 이전 저장 기준을 표시하지 않는다. 표시 본문은 공통 StudioMetricBasis를 재사용하며 현재 지표·미저장 변경을 새로 확인한 결과가 아님을 알린다. 조회/펼침은 API/편집 콜백을 호출하지 않는다. 기존 필드 blur/Enter 편집 계약은 유지한다. 미연결/불일치에는 안내만 보여 현재 지표로 보충하지 않는다.

편집 문서/sessionStorage/undo·저장 요청·복제/게시 정의에 새 기준을 넣지 않는다. source/참조·저장 버전의 유효성 판정과409는 기존 서버가 담당하며 이 읽기는 공식 승인·수치 재검증·최신 지표 적용이 아니다.

## 실행 증거

로그 `/tmp/vm-saved-basis/`, Git 제외 `.aiwf/evidence/UC050-saved-basis/`에 보존한다. 새 투영 시그니처 부재 red를 확인한 뒤 구현했다. FE 초기 검증 함수 import 누락을 수정하고 type/회귀를 재실행했다.

| 검사                           | 결과/범위                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| BE 2 suites                    | PASS28: pure projection9·기존 실제 SQLite/DuckDB StudioService19                      |
| FE 6 files                     | PASS97: Inspector/optional validator13·StudioEditor·API/adapter·선택기/생성 기준 회귀 |
| BE/FE build·lint·FE type       | PASS, 최종 로그 기준                                                                  |
| 실제 HTTP/JWT·Ego/390·768·1440 | NOT_RUN/BLOCKED. 서비스 직접 실행·fixture FE와 구분                                   |

BE는 저장 기준 whitelist/입력불변·다른소스/key/빈key/버전/참조/미연결·기존 무snapshot 호환을 확인한다. 실제 SQLite/DuckDB StudioService GET에서 저장 연결의 basis를 읽고, 현재 Metric을v2로 바꾼 뒤에도 저장v1 기준을 반환하며 기존 prepare/save 버전409 경계는 그대로인지 확인한다. 전체 조회/권한 변형·실HTTP/운영MySQL을 새로 통과시켰다고 주장하지 않는다.

FE는 저장 출처/기준의 기본접힘/명시펼침·블록입력/편집콜백0, 소스/지표/버전/미연결 거절·선택전환 후 이전 값 제거, optional 응답 호환·잘못된필드/SQL/scale/ID 거절을 확인한다. 실제 StudioEditor 컴포넌트에서 설정 열기→기준 읽기 동안 추가 GET/POST0·저장 비활성 유지도 확인한다. 이 검사에 실제 LLM/저장/게시/브라우저reload는 포함하지 않는다.

strict 문서 검사는 오류0·기존 FR011/NFR002 상태 경고2로 exit1이다. pin/check 일치·packet awaiting_review/acceptance not_recorded를 확인했다. 독립 code-reviewer는 APPROVE·low2건을 보고했다. 반복 basis 계산은 이미 단일 계산으로 정리했고, source context 없는 개발용 Inspector에는 새 저장 상태 영역을 표시하지 않도록 보완했다. 공개 대상17파일의 식별 문구0·비공개 경로0과 diff 공백 검사를 확인했다. 실제 UI/수용 검증을 리뷰가 실행한 것으로 확대하지 않는다. 새 entity/제품 상태·전체 UC/TC 수용은 변경하지 않는다.

## 화면/운영 잔여

기존 Inspector 입력/버튼/스크롤 구조를 유지하고 본문은 common text-xs·min-width/긴 열명 줄바꿈과 native summary/focus를 사용한다. 실제 UI 크기/정렬·3폭 넘침/키보드·모바일 터치/Rill 화면 비교는 미실행이며 디자인 PASS가 아니다. 이전 사용자 제어권 반환을 확인하지 않아 Ego 제어권 재탈취/새 공간 우회는 하지 않았다. 운영MySQL/실기기·전체 조직권한/공식승인·고객 수용은 미완료다.
