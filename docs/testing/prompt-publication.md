# UC-019 질문 저장 → 게시 준비 검증

2026-10-15, `03d226d7` 위 변경. P3/P4 FR-007/011, [UC-019](../use_cases/UC-019-prompt-publication.md)·[설계](../architecture/prompt-publication.md)·[TC-019](../test_cases/TC-019-prompt-publication.md). 문서를 먼저 작성하고 별도 native executor가 의미·코드를 리뷰했다. 발견한 BE 타입 오류, 잘못된 중지본 ‘재게시’ 표시와 저장/게시 안내의 혼동을 보완했다. Draft·테스트·pin·사람 승인·운영 배포·전체 제품 수용은 별개다.

## 구현

기존 질문 UI의 자동 모드에서 저장과 게시를 함께 명시하면 쓰기 없는 전체 미리보기를 검증한 후 기존 저장 API로 저장한다. 성공 응답의 분석 ID와 revision을 확인해 같은 저장 버전의 게시 미리보기로 이동한다. 저장 완료 안내와 게시 상태를 나눠 보여준다. 공개 범위는 링크를 가진 사람, 전체 기간·필터 없음·UTC로 고정하며 만료일 확인 후 ‘링크 게시’를 눌러야 공개된다. 활성 게시본이 있을 때는 ‘이 결과로 재게시’로 표시한다.

기존 단일·batch 계획은 그대로 쓰고 `publicationRequested: true`만 선택적으로 추가한다. false·문자열·저장 없는 조합·clarify 조합은 거절한다. 필드 생략은 기존 동작이다. 분류 입력은 질문만이며 변경 생성기의 editPrompt에는 저장·게시 지시를 제거한다. 직접 지정 모드·모호한 대상 확인에는 게시 flag가 없다. 새 API·엔티티·DB·의존성은 추가하지 않았다.

저장 409·응답 불명확·취소는 기존 UC-017 초안 복구에 머문다. 복구 후 자동으로 게시하지 않는다. 게시 준비 실패는 이미 저장한 분석을 보존한다. `savedRevision`이 잘못됐거나 중복되거나 현재 저장본과 다르면 미리보기·게시를 막는다. URL 자체가 권한을 부여하지 않으며 소유권 검사는 기존 서버 계약을 따른다. 새로고침은 조회·미리보기만 반복할 수 있다.

## 첫 검증 결과 — 원격 UI 통합 전

기존 실행환경 FE3698 / proxy4899 → API4898, 기존 SQLite·업로드, 공개 Rill 분석 12를 사용했다. 요청 모델은 기존 Codex `gpt-6-luna`이며 모델 대체는 추가하지 않았다. CLI 결과만으로 실제 제공자 내부 모델 라우팅까지 독립 증명하는 것은 아니다. Ego TaskSpace36을 한 번 생성하고 검증·원복 뒤 종료했다.

| 실행                                                                  | 결과                                                                                                                                         |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 제목 임시 수정 → “현재 편집 내용을 저장하고 게시 미리보기로 이어 줘.” | 실제 분류 save/true/publicationRequested true, editor/ai 201 → editor 201 → owner GET200 → preview201. 저장 응답·query·preview revision 일치 |
| 미리보기에서 공개 범위·만료 확인 → 링크 게시                          | version6, 새로운 임시 URL, 명시 클릭 전 게시 쓰기 0건                                                                                        |
| owner 새로고침                                                        | editor POST 1→1, publication POST 1→1. 추가 저장·게시 0건                                                                                    |
| 공개 화면·새로고침·credentials omit GET                               | 200, 게시한 ticket의 snapshot과 동일. 숫자2·각169개 시간별 추세·OS 차트·논리 배치 보존                                                       |
| Rill 화면·Parquet oracle 비교                                         | 요청 634,513,000(635M), 평균 5.571238676523254($5.57), 평균 상대 허용오차 1e-9 안에서 일치                                                   |
| 공개 응답 경계                                                        | SQL·queries·fields·소스 ID·인증·연결 설정 키 없음                                                                                            |
| 실제 저장 버전 불일치 query                                           | 상태 조회만 수행, 미리보기·링크 게시 비활성, 저장 화면 확인 안내                                                                             |
| 게시 중지 → 익명 새로고침                                             | version7 active false, 공개 GET404                                                                                                           |
| 제목 원복 → “현재 편집 내용을 저장해 줘. 게시는 하지 마.”             | AI201·editor201만 수행. 게시 flag 생략, 게시 준비·공개 호출 없음. 저장 화면 새로고침 확인                                                    |
| 원복 비교                                                             | 제목·원본 분석 내용(revision 제외)·블록 정의/ID·모든 폭 배치 동일. revision은 명시 저장에 따라 변경                                          |

Rill 실행 데모는 날짜가 2026-10-06~13으로 이동하고 원본 Parquet는 2023-09-09~16 UTC다. 전체 기간 집계 수치와 숫자+추세 구성을 비교했으며 날짜별 bucket·픽셀 동일성을 주장하지 않는다. UI 문구 수정 중 HMR이 읽기 전용 미리보기를 한 번 추가 실행했으며 공개 쓰기는 명시 클릭 한 번뿐이었다.

## 첫 디자인 검증 — MUI 시점

질문·게시 미리보기·공개 화면의 390/768/1440px 캡처와 실측을 확인했다. 분석 주요 버튼 28px·입력 32px·폰트 12px, 양의 가로 넘침 0px다. 날짜 입력과 버튼은 중앙 정렬하고 좁은 폭에서 자연스럽게 줄바꿈한다. 공개 모바일 화면에서 두 숫자와 추세·OS 차트를 확인했다. 공통 헤더의 기존 컨트롤 크기는 분석 버튼 측정에서 구분했다. 사용자 저장 배치를 보존하므로 데스크톱의 비어 있는 셀과 아래쪽 요청 수 카드는 재배치하지 않았다.

## 자동 검사와 한계

- BE: `npx jest --runInBand src/ai/auto-block-intent.spec.ts src/bi/bi-editor.spec.ts` — 142 PASS. strict 계획·전달·기존 경로·취소 포함.
- FE: `npx vitest run src/pages/Publication/Publication.test.tsx src/pages/Dashboard/DashboardEdit/index.test.tsx` — 97 PASS. 저장/미리보기 실패·취소·불일치·묵은 응답·reload·활성/중지 상태 포함.
- BE nest build·변경 파일 ESLint, FE tsc·변경 파일 ESLint·build PASS.
- 단위의 모의 응답·프롬프트 규칙 검사와 실제 명시/부정 질문 두 문장의 실행을 구분한다. 모든 조건·인용·보고 표현의 실제 LLM 정확도는 NOT_RUN이다.
- AIWF strict lint는 기존 UC007~010 오류 12개·warning34·info4가 남는다. UC019 새 진단이나 suppression은 없다. pin은 내용 digest이며 승인 증거가 아니다.
- 운영 MySQL·실제 휴대폰·생성 화면 질문·계정 수신자·질문만으로 자동 공개·게시 오류의 새 실제 fault injection·전체 P3/P4/TC005는 미검증이다. 이번 변경은 기존 UC017/018 복구 증거를 재사용하며 해당 전체 검증을 반복하지 않았다.

증빙은 저장소 밖 `/tmp/vm-prompt-publication/`의 before/after-save/published/restored, XHR, 익명 응답, reload-writes, summary, 폭별 PNG/실측과 검사 로그다. 임시 파일의 영구 보존은 보장하지 않는다. 로컬 AIWF packet은 awaiting_review, acceptance not_recorded를 유지한다.

## 최종 통합 — 원격 shadcn UI 보존

push 전 fetch에서 원격 `3e6c5ab4`까지 6개 커밋(UI-001 shadcn/Tailwind 전환, 지표 링크 보존 등)을 확인했다. 기능을 `06a0e752`로 보존한 후 현재 develop-v2에서 통합했다. 충돌한 두 화면은 원격 컴포넌트·토큰을 유지하면서 저장 revision 전달·게시 guard를 보존했다. 별도 리뷰에서 원격 UI와 지표 링크 로직의 보존을 확인했다. MUI 의존성·컴포넌트를 다시 추가하지 않았다.

사용자가 추가 Ego 공간을 명시 허용하여 TaskSpace38에서 통합본을 다시 검증했다. 위 TaskSpace36 결과는 이전 UI의 기록이며 새 UI 통과 근거로 재사용하지 않았다. 같은 기존 서버·공개 분석 12에서 실제 명시 질문 → 저장 → 같은 revision 미리보기 → 명시 링크 게시 version8 → owner/public 새로고침을 실행했다. 추가 editor/publication 쓰기 0건, 인증 없는 GET200, 게시 ticket과 공개 snapshot 동일, 요청 634,513,000·평균 5.571238676523254·두 추세 각169점과 공개 whitelist를 다시 확인했다. 중지 version9·익명404 뒤 게시 부정 질문으로 제목을 원복했고 분석 내용(revision 제외)·블록·배치가 이전과 동일함을 비교했다.

390/768/1440px 질문·미리보기·공개 화면을 캡처·실측했다. 기본 버튼·입력 36px, 데이터 표 도구 버튼 32px, 일반 버튼 14px, 입력은 모바일/태블릿 16px·데스크톱 14px로 현재 UI Kit를 유지한다. 양의 가로 넘침은 모두 0px다. label이 별도 행인 TextField 때문에 질문/날짜 행의 버튼이 입력보다 14px 위에 놓이는 것을 발견해 두 행의 `items-end`만 수정했다. 768/1440px에서 입력/버튼 y좌표 차이0, 390px에서는 간격을 두고 줄바꿈함을 확인했다.

통합본 관련 BE250 PASS(질문/편집142 + 원격 지표 링크/계산/피벗108), FE102 PASS(게시·편집·공통 UI), BE build·FE type/lint/build PASS다. 패키지는 변경된 lockfile로 `npm ci --legacy-peer-deps`를 실행했다. 이 호스트의 검사 Node는22.23.1이며 package engines의24.11+ 경고가 있었다. Node24에서의 별도 실행은 미검증이다. 통합에 따른 루트 전체 검사 결과는 아래 최종 기록을 따른다.

증거는 같은 폴더의 `integration-*` 및 `verify-integration.py`이다. 최종 기준은 `integration-summary.json`, 새 폭별 PNG/실측·XHR·공개 응답·복구 비교다. 원격 변경의 전체 UI 여정을 이 범위에서 반복 검증했다고 주장하지 않는다.

최종 루트 `npm test`는 BE91 suites/1,617 tests와 FE64 files/981 tests 모두 PASS, 루트 `npm run build`도 PASS다. 두 행 정렬 수정 이후의 통합본을 대상으로 실행했다. 전체 자동 검사 통과가 운영 배포·실기기·제품 수용을 의미하지는 않는다.
