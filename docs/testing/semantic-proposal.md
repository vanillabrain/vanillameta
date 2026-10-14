# UC-012 A — 쓰기 없는 구조화 제안·미리보기

2026-10-15, develop-v2 / 6fd86708 이후 이번 A 변경. [계획](../plans/UC-012.md)·[TC](../test_cases/TC-012-semantic-creation.md). A API 체크포인트이며 전체 고객 기능 완료가 아니다.

## 구현과 검사

JWT 보호된 `POST /v1/bi/analysis-proposals`에 `{sourceId,prompt}`를 제출하면 SQL이 없는 구조화 제안과 생성/재사용 계획·서버 제작 draft를 돌려준다. `POST /v1/bi/analysis-proposals/preview`에 `{proposal}`를 제출하면 소스·지표 버전과 형태를 다시 검사하고 기존 숫자+시계열·차트 미리보기를 실행한다. 저장 API·새 UI·migration은 추가하지 않았다.

기존 지표 제작의 SQL·표시 컴파일을 순수 함수로 분리해 재사용했다. 새 지표를 먼저 저장하지 않는다. 저장 지표는 활성·동일 소스의 유효 구조화 정의만 후보로 사용하며 계산·단위가 같은 가장 작은 ID를 선택한다. 표시명만 같은 다른 계산은 연결하지 않는다. 요청 소스 변경·원시 SQL·알 수 없는 필드/열/집계·비시간 line·잘못된 참조를 거절한다. source revision은409, 명시 지표 version 변경도409다.

| 검사                    | 결과                | 근거                                                                                                    |
| ----------------------- | ------------------- | ------------------------------------------------------------------------------------------------------- |
| BE 관련 단위·회귀       | PASS 4파일/90 tests | 새 compiler/service, 기존 bi.service/bi-editor                                                          |
| BE build·변경 eslint    | PASS                | nest build, 변경8개 TS 파일/테스트                                                                      |
| 실LLM 제안              | PASS 선택 질문      | Codex provider에 gpt-6-luna 요청, 기존 proxy/catalog 사용. 별도 실행 모델 provenance를 입증한 것은 아님 |
| 미리보기                | PASS API            | 숫자2개·OS 막대1개, 숫자마다 추세169개                                                                  |
| Rill 계산 대조          | PASS 원본/정의      | 로컬 auction_metrics.yaml SUM/RATIO_SUM, 독립 공개 Parquet1391572행 집계                                |
| DB 무쓰기               | PASS 관찰 범위      | 실제 제안/미리보기/오류 전후 모든 테이블 행 수 동일. 별도 미리보기 전후 전체 SQLite dump SHA256 동일    |
| 잘못된 SQL/stale source | PASS 실제 API       | 각각400/409                                                                                             |
| FE·실제 화면/Rill UI    | NOT_RUN/BLOCKED     | UI 입력 변경 없음. 기존 auto-review 거절을 우회하지 않음                                                |

질문은 “전체 요청 수와 평균 입찰가, OS별 요청 수를 보여 줘. 숫자 지표 2개와 OS별 막대 차트 1개로 구성해 줘.”다. source7 읽기만 사용하고 분석/지표를 새로 만들지 않았다. 실제 응답은 요청 **634513000**, 평균 **5.571238676523271**, OS **28개**, OS 요청 합계 **634513000**이다. 독립 Parquet 평균 **5.571238676526883**과 상대 오차1e-9 이내이며 28개 그룹 각각 일치한다. Rill 데모의 이동된 날짜와 원본 UTC 날짜를 같은 버킷으로 대조하지 않았다. Rill 실제 화면 비교는 이번에 실행하지 않았다.

## 증빙과 잔여 범위

저장소 밖 `/tmp/vm-semantic-a/{proposed.json,preview.json,result.json,oracle-result.json,verify.cjs,oracle.cjs}`와 `/tmp/vm-semantic-{tests,lint}.log`, `/tmp/vm-semantic-a-build.log`. 토큰·로그인 응답은 증빙에 저장하지 않았다. 임시 증빙은 영구 보관을 보장하지 않는다. `.aiwf/evidence/UC-012-A/`는 검사 로그/요약만 보관하며 승인 증거가 아니다.

다음은 B의 지표·분석·영수증 원자 저장, 동일 요청 재시도, 기존 UC003/004 지표 연결이다. C 질문 UI·저장·새로고침·390/768/1440 디자인은 미구현/미검증이다. 운영 DB·동시성·rollback·provider 장애의 실제 검증도 남았다. 단위 모킹 결과로 이를 PASS로 표시하지 않는다.

AIWF sync로 UC/계획/설계/TC/세션 요약을 갱신했다. 요구사항·용어·엔티티의 정책 변경은 없고 영수증 entity는 B 범위로 유지했다. 별도 자체 검토는 공유 SQL 컴파일의 기존 출력 유지, 소유권/소스 고정, raw 데이터 미전송, 무쓰기 호출 경계와 B/C 미구현 표기를 대조했다. 독립 리뷰·고객 수용은 미기록이다. 엄격 문서 lint는 기존 UC007~010 오류12개로 FAIL 유지하며 이번 UC012 새 진단은 없다.
