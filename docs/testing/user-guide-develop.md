# develop 사용자 가이드 대조 기록

- 작성일: 2026-10-21
- 제품 기준: `develop` / `97904be7c7a834c31f64ecea05676f659afe124f`
- 범위: 사용자 가이드 진입점·빠른 시작·주 매뉴얼. 제품 코드·요건·UC/TC 계약은 변경하지 않음.
- 기존 SQL/위젯 중심 주 매뉴얼을 현재 Studio 흐름으로 교체함. 차트 유형 참고와 스크린샷 촬영 계획은 기존 자료임을 진입점에 명시함.

## 소스 대조

| 안내                               | 제품 소스                                                                                                            |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 대시보드 시작·화면 경로            | `frontend-web/src/pages/Dashboard/Components/GettingStarted.tsx`, `frontend-web/src/router/index.tsx`                |
| 소스 선택·생성·저장 전 수정        | `frontend-web/src/pages/Dashboard/Studio/StudioSourcePicker.tsx`, `StudioCreate.tsx`, `StudioProposalRefinement.tsx` |
| 파일 저장과 브라우저 분석 구별     | `frontend-web/src/pages/Data/FileAnalysis/index.tsx`                                                                 |
| DB 연결 버튼                       | `frontend-web/src/locales/ko/database.json`, `frontend-web/src/pages/Data/DataSource/index.tsx`                      |
| 수정·초안·배치·복구                | `frontend-web/src/pages/Dashboard/Studio/StudioEditor.tsx`, `StudioConversation.tsx`, `StudioConditionReview.tsx`    |
| 저장본/게시본·공개 범위·재게시     | `frontend-web/src/pages/Dashboard/Studio/StudioPublish.tsx`                                                          |
| 조직 직원 공유·독립 소스 권한·수신 | `frontend-web/src/pages/Enterprise/ResourcePolicies.tsx`, `Deliveries.tsx`, `ReceivedDashboards.tsx`, `index.tsx`    |

## 검토와 검증

- 실제 라우트와 주요 버튼 문구, 저장·게시 스냅샷 경계, AI 명시 저장/공개 예외, 조직 공유의 소스 읽기 독립 경계를 수동 대조했다.
- 공개 합성 샘플 `samples/rill-scenarios/data/margin.csv`를 Python `csv`/`Decimal`로 별도 합산: 18행, revenue 합계 14937.49. 문서의 기대값은 이 샘플 전체 범위에만 해당한다.
- 변경한 사용자 문서와 이 기록의 상대 파일 링크·빠른 시작의 조직 공유 앵커를 검사했다. 프로젝트 루트 README는 새 가이드 링크만 검사 대상으로 삼았다.
- 변경 Markdown의 Prettier 검사 및 `git diff --check`로 형식·공백을 확인했다.
- 본문을 별도 읽기 순서로 검토해 데이터 준비→제안→미리보기→저장→수정→게시→공유 순서와 문제 해결 경로를 확인했다. 독립 검토자 승인이나 사용자 수용은 아니다.

초기 가이드 커밋 `1b5de868`에서는 브라우저·AI·DB 인수시험을 새로 실행하지 않았다. 이후 사용자 요청에 따른 [Ego 실제 검증](user-guide-ego.md)은 별도 후속 기록을 따른다. 기존 실제 화면·MySQL 검증은 [develop 인수검증 기록](develop-acceptance-20261021.md)의 당시 범위에 한정한다. 안내된 질문의 정확한 응답은 AI 환경·데이터·권한에 따라 달라지므로 미리보기 확인 단계를 포함한다. 기존 위젯 차트 참고 문서 전체의 최신성, 모든 외부 DB, 운영 배포와 실기기 검증은 이번 문서 작업 범위 밖이다.
