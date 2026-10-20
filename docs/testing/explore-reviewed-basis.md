# Explore 검토 조건과 조회·출력 기준 일치

2026-10-18 · 기준 ec965220 이후 작업 · [설계](../plans/UC-052-explore-basis.md) · FR018/019/025·NFR005/006/008·TC050 E05/E08/E14. 추가16개 요건의 선택 구현/검증이며 전체 수용은 미완료다.

## 구현

SourceConditions의 검증 미리보기에서 '이 분석에 조건 적용'을 명시 실행한다. 읽기 사용자도 로컬 분석에 적용할 수 있지만 소스 metadata 저장은 별도다. 편집/재조회/새 미리보기/실패는 적용 가능한 이전 미리보기를 무효화한다. 전체 소스·전체 기간·UTC 건수와 분석의 현재 기간/필터/시간대 범위를 구분한다.

소스 편집 draft.sourceRevision은 metadata+파일 합성 revision이다. 실행 파일 hash와 동일하지 않다. 서버 preview.analysisConditions는 실제 계산 pin의 파일 hash와 검증 definition을 반환한다. FE는 구조와 draft definition 일치를 검사하고 부모가 현재 catalog 파일 기준과 다시 대조한다. 예전 응답은 기존 편집/저장은 가능하지만 실행용 기준이 없으면 적용하지 못한다. 실패/파일 불일치 시 현재 분석 조건을 보존하고 자동 재바인딩하지 않는다.

명시 적용 snapshot은 조회/값 검색/일반·고급 Pivot/즉시·영속 CSV와 두 저장 보기 형식(v1~v5)에 연결된다. 소스 metadata 조건 변경을 자동 전파하지 않는다. 명시 제거는 원본/SQL/다른 분석을 변경하지 않는다. 저장/복구의 구조·용량·native schema·실제 파일 검사와 기존 조건 없는 보기 호환을 유지한다.

query/Pivot 응답의 measureVersions는 실제 계산에 사용한 정의 버전이다. 새 즉시 출력은 expectedMeasureVersions를 요청하고 응답 기준도 검사한다. 누락된 과거 응답은 화면 표시와 호환하지만 새 출력은 차단한다. 서버는 계산 전후 지표/현재 권한·새로 캡처한 파일 기준을 검사한다. caller가 오래된 outer pin을 유지해도 최종 검사에 재사용하지 않는다. 일반 Pivot CSV는 기존 표시 결과를 로컬 직렬화하므로 재집계하지 않고 현재 export 권한을 다시 검사한다.

영속 접수의 nested expected 버전과 기존 top-level 고정 버전이 다르면 생성 전에 거절한다. 과거 완료 파일은 현재 지표 변경으로 다시 계산하지 않는다. 기존 export의 불완전 query가 권한 검사보다 먼저 상세 검증되던 순서는 envelope/소스 신원→현재 export 권한→상세 query로 수정했다. 같은 테스트의 baseline/current 차등 실행으로 기존400/403 불일치를 확인했으며 기대값을 바꾸어 숨기지 않았다.

## 실행 결과

로컬 비공개 로그는 Git 제외 `.aiwf/evidence/UC052-explore-basis/`에 보존했다. 이전 실행 수는 아래 합계에 다시 더하지 않는다.

| 범위                   | 결과                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| BE 선택 통합           | 14 suites / 고유397 PASS. query/Pivot/출력·조건/JWT·두 보기/참조 writer·권한 포함                        |
| FE 선택 통합           | 6 files / 고유237 PASS. 적용/미리보기·복구·조건/버전·출력 작업 포함                                      |
| 실제 DuckDB 독립 정답  | 위 BE에 포함. OR 포함/제외+필터·DST/이전 기간·순위/추이·일반/고급 Pivot·0행/0분모·즉시/영속 CSV          |
| outer pin 파일 교체    | 위 BE에 포함. 실제 A/B 파일·같은 metadata 시각에서5개 query/Pivot/CSV409·caller pin 보존                 |
| 격리 headless Chromium | 신규 통합 여정1 + 기존 Explore/Pivot 보기1 = 고유2 PASS. 이후 geometry 선택 재실행1 PASS는 합산하지 않음 |
| types/lint/build       | BE/FE types·변경 대상 lint·제품 build·E2E types PASS                                                     |

브라우저 합성 자료의 전체 적용 합계440, 현재 기간400/이전40을 확인했다. 조건 metadata 저장 추가0, 고급 Pivot 보기 저장→reload/명시 복구, 조건·수치가 같은 즉시/영속 CSV 접수→실행→다운로드를 검증했다. 지표를 별도 보호 API에서 SUM→MAX로 변경한 뒤 즉시 출력409, 완료 영속 파일 바이트 불변도 확인했다. 지표 변경 자체의 AI 질문 UI/실LLM 실행 증거는 아니다. 작업 취소·본 테스트가 생성한 보기/대시보드/두 Dataset/지표·소스만 명시 정리했다.

390/768/1440px의 상단 스크롤 캡처에서 컨트롤/표 배치와 페이지 가로 넘침0을 확인했다. CSV 버튼36px 높이·14px 폰트는 JSON/실제 assertion으로 보존했다. Main이390px 전체 캡처를 확인했다. 초기 실패 로그도 유지한다: 접근성 status 선택자·테스트의 metadata/file 기대값·동일 의미 JSON 키 순서·테스트 Dataset 정리 누락을 수정했다. 고정 헤더가 문서 중간에 찍힌 fullPage 캡처는 상단 스크롤 후 재확인했다. 이를 별도 제품 회귀 실패 또는 실제 Ego/휴대폰 증거로 보고하지 않는다.

## 남은 수용

사용자 제어 Ego96·실휴대폰·이번 MySQL/운영·실LLM·대규모 성능·전체 TC050/16개 사람 수용은 NOT_RUN/Open이다. 사내 공통 분류 재사용 및 저장 업무 유형/날짜 의미의 직접/AI 실행 일치는 별도 FR015 후속이다. strict 문서 검사는 기존 FR011/NFR002 상태 경고2개/오류0을 유지하며 pin/check/packet은 사람 승인이나 운영 배포가 아니다.
