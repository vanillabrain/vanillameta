# 업무 변수의 조건 실행 의미 — 선택 검증

2026-10-18 · UC050/052 · FR015/018/020·NFR005/006/008 · TC050 E01/E04/E05/E08/E13/E14. [계획](../plans/UC-050-condition-semantics.md)의 구현 및 개별 실행 증빙이다. develop-v2 작업 트리를 대상으로 하며 최종 dist의 core-stable14 PASS/38.3초를 확인했으며 커밋은 본 문서와 함께 기록한다. BE26 suites/884개는 단계별 검증 완료이며 Jason·Bernoulli의 최종 범위 검토는 APPROVE/0 findings다. 전체 FR015/TC050·16개 요건의 수용 완료를 뜻하지 않는다.

## 실행 기준과 보존

- `StudioConditions`의 선택적 `semantics`는 `{schemaVersion:1,catalogVersion,columns:[{column,businessType,dateFormat}]}`다. 해당 소스의 전체 non-auto 선언을 열명 순으로 고정한다. 열 유형/SQL/날짜 표현식을 클라이언트에서 받지 않는다. 실제 native schema와 정확한 append-only 카탈로그 이력을 서버가 대조하며 손상·누락·위조·다른 소스 이력은 거절한다.
- 의미 없는 legacy 조건은 native로 유지한다. 최신 카탈로그 수정이 저장 조건/분석/보기를 자동 재해석하지 않는다. 명시 `최신 업무 의미 채택`은 기존 정의를 유지한 검토→새 미리보기→저장이다. 호환되지 않는 연산자는 재검토하며 semantic 기준을 생략해 native로 낮추지 않는다.
- 파일 `sourceRevision`은 실제 캡처한 불변 파일 기준이며 조건 편집의 metadata revision·SourceConditionEntry version·SourceCatalogEntry version과 다르다. 서버 preview의 `analysisConditions`만 분석 적용에 사용한다. draft의 metadata revision을 파일 기준으로 전달하지 않는다.
- Source read에 제공한 `analysisConditions`는 현재 파일/native schema와 그 wrapper의 이력만 검증한다. 별도 SourceEntry가 native/semantic이거나 definition·semantics JSON·동결 이력이 손상되어도 유효한 분석 편집 문맥을 대체하거나 막지 않는다. SourceEntry version은 이 경로에서 정보용이다. 제공한 wrapper 자체의 오류는 실패하며 저장 조건으로 fallback하지 않는다.
- metadata 이력 읽기는 공통 metadata 조정을 사용한다. 전체 날짜 검증/집계 SQL은 큐 밖에서 같은 캡처 파일을 사용하고 전후 현재 read 권한·파일·기준을 확인한다. 새 의미 채택은 SQL 후와 최종 저장 시 최신 카탈로그 CAS를 확인한다. 읽기 미리보기에는 edit 권한을 요구하지 않는다.

## 계산과 소비자 범위

업무 category는 원본 정밀 scalar의 동등/목록/NULL 의미를 유지하며 숫자·날짜 범위나 문자열 contains를 몰래 허용하지 않는다. 지원 UUID/ENUM의 명시 범주도 허용 값과 native 정밀도를 유지한다. VARCHAR 업무 날짜는 YYYY-MM-DD·YYYY/MM/DD·YYYYMMDD 고정 형식과 ISO 조건 피연산자를 사용한다. 전체 원본의 잘못된/빈 날짜를 NULL로 바꾸어 제외하지 않으며 NULL은 별도로 보존한다. 오류에는 열/건수만 담고 원본 값·SQL을 노출하지 않는다.

Source/Studio 직접·AI 조건, 공통 조회/분포·표본, Explore/Pivot/CSV·영속 출력·저장 보기 및 저장/게시/재사용 소비자의 wrapper 전달을 연결한다. 저장 보기 version1~5의 선택적 조건/의미를 유지하고 복구 시 현재 파일/schema/정확한 이력을 확인한다. 소스 교체는 실제 사용한 업무 선언의 호환성을 확인해 대상 소스의 전체 최신 canonical snapshot으로 새로 묶는다. 원본 카탈로그 버전을 그대로 대상에 복사하지 않는다. 기존 확정 영수증은 정확한 요청과 현재 권한/사본 접근을 확인하는 과거 저장 확인이며 새 SQL/산출물을 만들지 않는다. 아래 선택 실행을 모든 소비자/경합의 통합 통과로 확대하지 않는다.

## 확인된 증빙

증빙 원본은 Git 제외 `.aiwf/evidence/UC050-condition-semantics/`에 보관한다. 아래 수치는 실행별이며 중복 가능한 배치를 합산하지 않는다. 과거 중간 실패/skip 로그는 최종 PASS로 바꾸지 않는다.

| 실행 범위                                                 | 확인 결과                                                          | 정확한 로그/명령 기록                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| 공통 의미/compiler·기존 조건/native runtime               | 4 suites / 202 PASS                                                | `kernel-tests.log`, `kernel-commands.txt`                                                     |
| 독립 실제 DuckDB 정답·SQLite 이력/재연결                  | 1 suite / 33 PASS                                                  | `oracle-runtime.log`, `oracle-commands-README.md`                                             |
| Explore semantic 독립 정답 후속                           | 1 suite / 8 PASS / 22 SKIP / 30 등록; 전체30 PASS 아님             | `oracle-explore-semantic-final.log`; 초기 실패는 `oracle-explore-semantic-initial.log`에 보존 |
| UUID/ENUM 실제 native 후속                                | 13 PASS / 33 SKIP / 46 등록; 앞선 33을 재실행한 결과가 아님        | `oracle-uuid-enum.log`                                                                        |
| Source service/JWT·SQLite resolver·실제 날짜 검증         | 3 suites / 49 PASS; 분석 문맥 격리/손상 4개 포함                   | `source-analysis-tests.log`, `source-README.md`                                               |
| 격리 MySQL 8.4.11 nullable migration/영속 version         | 1 suite / 2 PASS; legacy 행·시각·NULL 보존, 반복 up, exact history | `source-mysql-tests.log`, `source-README.md`                                                  |
| 복제/생성 소비자                                          | 6 suites / 147 PASS                                                | `remix-consumer-tests.log`, `remix-consumer-commands.txt`                                     |
| Studio profile 수정 및 전후 guard 회귀                    | 2 suites / 41 PASS                                                 | `studio-profile-final.log`; Main의 profile 수정·guard 4개 포함 보고와 일치                    |
| 최종 FE Studio+Explore 디렉터리                           | 52 suites / 802 distinct PASS; 이전 미실행 53개 포함, skip 없음    | `fe-final-tests.log`, `fe-final-README.md`; 이전224/100 등과 합산 금지                        |
| Source 실제 headless UI                                   | 1 PASS                                                             | `ui/playwright-001.log`, `ui/run-001/artifacts/`                                              |
| BE 선택26-suite 단계별 최종 범위                          | 26 suites / 884 unique 검증 완료; 단일 재실행 배치884 PASS 아님    | `backend-tests-allowed.log`, `legacy-reuse-final-tests.log`, `resource-access-final.log`      |
| core headless 회귀                                        | 14 PASS / 49.4초 / exit0; 다른 UI 배치와 합산하지 않음             | `core/playwright-001.log`                                                                     |
| 최종 안정 dist 실제 Codex 조건 제안→명시 적용/저장/reload | 1 PASS / 11.9초 / exit0; 같은 시나리오의 이전 실행과 합산하지 않음 | `ui-stable/playwright-001.log`; 이전 `ui-codex/playwright-001.log`의1 PASS/14.5초는 이력      |

Source 최종 타입·scoped lint·격리 build는 `source-analysis-{types,lint,build}.log` 및 README의 명령/exit0 기록을 따른다. FE 타입·scoped lint·production build는 `fe-final-{types,lint,build}.log`와 `fe-final-README.md`에서 PASS다. 각 lane의 검사는 전체 제품/16개 수용을 대신하지 않는다. 중간 `business-access-final.log`의3개 실패는 이후 `backend-tests-allowed.log`에서 해당 suite PASS로 대체 확인했으며 원래 실패 로그는 보존한다. 파일명의 final만으로 통과로 해석하지 않는다. 최종 안정 BE type/lint/build는 exit0 PASS다. `backend-types-stable.log`·`backend-lint-stable.log`는 빈 로그이고 `backend-build-stable.log`는 정상 build 출력이다. 최종 dist 실제 Codex UI는1 PASS/11.9초이며 core-stable14 PASS/38.3초다.

## 실제 Source UI 범위

`frontend-web/e2e/business-conditions.spec.ts`의 격리 Chromium 실행1개에서 소유 synthetic Parquet 업로드→업무 날짜 V1 등록→날짜 조건 전체 미리보기(최종2행)→조건 저장/분석 적용(합계300)→보기 저장을 확인했다. 카탈로그 V2 범주 변경 뒤 reload/보기 복구는 V1 날짜 의미와 합계300을 유지했다. 최신 의미를 명시 채택한 뒤 범주 동등 조건으로 다시 미리보기/저장/적용하는 흐름을 확인했다.

390/768/1440 각 JSON 실측은 overflow0, 최신 채택 버튼 높이36px·글자14px다. Source390 및 실제 Codex 저장 Studio390 스크린샷의 넘침 없음 열람 확인은 Main 보고이며 이 문서 동기화에서 새 UI 실행/화면 검증은 하지 않았다. 이는 headless 화면 폭 검증이며 실제 Ego·물리 휴대폰·터치/모든 키보드 상태 수용이 아니다.

## 대기와 종료 경계

- 실제 Codex `ui-real`은 초기 AI 열기 count 경합으로 취소했다. 해당 테스트 경합 수정 후 `ui-real-final`은 질문 끝의 `저장과 게시는 실행하지 마.` 때문에 기존 복합 의도 판별에서 모델 호출 전 unsupported publish로 분기했다. DB의 unsupported 상태·쓰기0 확인 후 취소했으며 두 시도 모두 **미완료/PASS 아님**이다. 기존 증빙을 삭제하거나 성공으로 바꾸지 않는다. 이 경합 수정의 제품/테스트 변경은 Main 실행이며 이 문서 작업의 변경이 아니다.
- 복합 부정 문장의 의도 판별 제한은 **열린 이슈**다. 모든 자연어/부정 표현을 지원한다고 주장하지 않는다. `ui-codex`는 `business_day 업무 날짜가 2024년 2월 29일인 행만 포함하는 공통 조건을 제안해 줘.`만 요청해 **실제1 PASS / 14.5초 / exit0**를 확인했다. SourceEntry V2와 다른 현재 카탈로그 V3로 실제 Codex 조건 검토200→명시 적용→저장→reload V3/preview200을 검증했다. 모바일390 overflow0도 확인했으며 실제 Codex 저장 Studio390 및 Source390 스크린샷은 Main이 열람해 넘침 없음을 확인했다. 이 단일 질문의 실LLM 실행을 모든 자연어/부정 표현이나 앞선 취소 시도의 통과로 확대하지 않는다. 시도 상태/DB 확인과 세부 흐름은 Main 보고 및 실제 E2E assertion에 근거한다.
- 최초 sandbox EPERM 중단은 실행 완료가 아니다. 이후 허용 BE26-suite 배치는24 suites PASS/2 FAIL,864 PASS/20 FAIL/884 total이었다. 실패는 legacy fixture의 policy.capabilities 누락17개와 resource-access capture mock 누락3개다. 제품 fallback 없이 fixture를 정정하고 실패 suite 전체를 재실행해 legacy18/18·resource6/6 PASS를 확인했다. 최초864 PASS에 이 두 suite의 기존 성공4개가 포함되므로864+24로 합산하지 않는다. 나머지24 suites의860개+legacy18+resource6으로 **26 suites/884 unique를 단계별 검증**했으며 단일 녹색26-suite 배치라고 주장하지 않는다.
- Remix/legacy 오류 처리의 비활성 계정 read guard는 수정 완료다. Jason·Bernoulli의 최종 범위 검토는 **APPROVE/0 findings**라는 Main 보고를 반영했다. 이 범위 검토는 운영·사람의 제품 수용이 아니다.
- 최종 안정 BE type/lint/build는 exit0 PASS다. 최종 dist의 실제 Codex `ui-stable`은 동일 Source+AI 시나리오로 **1 PASS/11.9초**이며 우선 증빙이다. `ui-codex`1 PASS/14.5초는 이력으로 보존하고 더하지 않는다. 기존 core14 PASS/49.4초도 이전 실행으로 보존한다. 최종 **core-stable14 PASS/38.3초**이며 같은 안정 dist의 회귀다.
- MySQL2개는 nullable migration/영속 이력 검증에 한정한다. 전체 Source 권한·소비자·lock 경합/운영 MySQL 검증이 아니다. 사용한 전용 fixture와 임시 credential은 정리했다.
- FR015의 조직 공통 분류 사전 재사용과 새 semantic measure/dimension 생성의 전체 업무 의미 적용은 남아 있다. 기존 저장 지표 생성/조회나 조건 실행 연결을 그 완료로 계산하지 않는다.
- 실제 Ego·물리 휴대폰·운영·사람 수용 및 전체16개 요건/TC050 E01~E14는 열린 상태다. 이 docs-only 동기화는 제품 수정·commit·배포·운영 migration을 수행하지 않는다.
