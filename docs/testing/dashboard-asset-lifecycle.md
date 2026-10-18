# UC055 조직 대시보드 비활성화·복원 검증

[계획](../plans/UC-055-dashboard-lifecycle.md)의 FR024/NFR005/007/008 구현 단위다. 전체 TC050/16개 요건 수용 완료가 아니다. 기존 [TC005 전체 여정](dashboard-lifecycle.md)은 원문 그대로 보존한다.

## 구현과 보존

Dashboard.assetActive/assetVersion을 현재 조직의 활성 소유 admin/JWT epoch·8종 영향·기준 버전과 함께 검사한다. 상태 CAS·지속 영수증·dashboard.activate/deactivate 감사는 원자 저장한다. 일반 read/edit/publish/export·owner fallback·live share/token/embed·게시/재사용·최종 저장은 비활성에서 차단한다. 관리/명시 회수·사용처 기반 삭제는 현재 소유 admin에게만 유지하고 활성 자산의 기존 삭제 권한과 과거 삭제 receipt 확인은 보존한다.

정의/모든 폭 배치·소스·권한/전달·게시 snapshot/URL/version·독립 사본을 삭제하지 않는다. 복원도 원 소스·현재 권한·만료/회수를 우회하거나 자동 재게시하지 않는다. 독립 source export를 다른 대시보드 비활성 때문에 차단하지 않는다. 이미 전달한 데이터/파일 회수와 진행 중 SQL/LLM 강제 취소는 보장하지 않는다.

복원 전의 저장·게시·복제 준비 기준은 lifecycle 버전으로 무효화한다. 새 클라이언트 proof는 필수다. 캐시된 이전 클라이언트의 proof 없는 저장은 정확한 기존 receipt만 현재 원본·사본 접근 검사 후 재확인하며 기록이 없으면409/쓰기0, proof 없는 미리보기는400이다. 직접/그룹 받은 자료의 확정 receipt는 준비 fingerprint와 현재 권한 검사를 분리하되 동일 직접 관계 또는 정확한 groupId의 현재 allowCopy·조직/소유/구성원·소스 read를 검사한다. 신규 복제의 strict reference/proof를 약화하지 않는다. 사전 배포 호환은 이전 알고리즘 reference/receipt fixture로 검사했으며 과거 서버 배포를 재실행한 것은 아니다.

## 확정 실행

로컬 증빙은 Git 제외 `.aiwf/evidence/UC055-dashboard-lifecycle/`에 있다. 반복 실행을 더해 합격 수를 부풀리지 않는다.

| 검사                                                                   | 결과                                                     | 증빙                                                             |
| ---------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------- |
| 실제 SQLite/Nest JWT 상태·권한·CAS·rollback·receipt·migration·no-store | 47 PASS                                                  | mysql/sqlite-recovery-code.log                                   |
| 기존 보호/정책/삭제·공통 부모 잠금                                     | 138 PASS, 뒤의 삭제28개 재확인 포함                      | core/affected-tests.log·core/inactive-delete-tests.log           |
| QueryFailedError 분류/rollback·동일 UUID 복구                          | 10 PASS                                                  | core/conflict-tests.log                                          |
| 실제 MySQL8.4.11                                                       | 중복 제외16 PASS, 복수 실행                              | mysql/verification.json                                          |
| BE 소비자 선택                                                         | 중복 제외288 PASS, 마지막 Received Remix48개 재확인 포함 | consumer-evidence/README.md·consumers-received-receipt-tests.log |
| 상태 UI/API·기존 조직 통합                                             | 86 PASS                                                  | frontend-retry-tests.log                                         |
| Studio 재사용/실행 proof 전달 FE                                       | 108 PASS, 포함된17개 추가 재확인                         | consumer-evidence/README.md·consumers-frontend.log               |
| 격리 headless 기존 핵심 흐름                                           | 11 PASS                                                  | core-regression/playwright-001.log                               |
| 새 상태 복구·390/768/1440 최종 화면                                    | 1 PASS                                                   | ui-label-final/playwright-001.log                                |

MySQL 기본14개는 정의 저장/실제 권한 writer 양순서와 rollback/영수증/이관되지 않은 소유 경계를 검사한다. 추가 requireRemix 포함15개 PASS 뒤 게시 경합2개만 선택 실행(기존14개 skipped)했다. 실제 Dashboard 잠금 대기를 관측하고 회수 commit 뒤 실제 requireRemix410/후속 사본 INSERT0, 대기하던 실제 revoke가 최신 version2/snapshot2/allowRemix를 보존하고 revokedAt만 변경함을 확인했다. requireRemix는 production transaction helper와 제한 wrapper 검증이며 전체 StudioRemix 엔진의 MySQL 실행이 아니다. 소유 Docker 컨테이너/볼륨/임시 credential은 모두 정리했다.

## 실제 화면과 복구

새 합성 계정/조직·격리 자료로 영향 읽기→명시 비활성 저장의 실제 commit 뒤 응답만503 치환→재확인에 upstream 미전달 프록시409 1회→reload/자동POST0→관리 권한 읽기→같은 UUID/본문 재확인→복원을 확인했다. 원본 조회·익명 live share는 비활성에서 차단하고 독립 자원은 유지했다. 복원 후 같은 링크가 현재 권한으로 열리며 과거 요청 replay가 복원을 덮지 않는다. 경합409는 주입한 것이며 실제 MySQL deadlock 재현이라고 표시하지 않는다.

명시 DASHBOARD_LIFECYCLE_STALE만 동결 요청을 폐기하고 RETRY_REQUIRED·미분류409는 보존한다. 현재 상태와 과거 영수증을 구별한다. 새 로그인은 private 상태/로컬 의도를 숨기며 일반 갱신/접기·같은 세션 reload는 원 요청을 유지한다. 기존 질문/SQL/편집 초안을 지우지 않는다.

390/768/1440에서 도구32px·기본36px·글자14px·문서 가로 넘침0을 검사했다. 긴 조직명 옆 라벨은 shrink를 막고 실제 텍스트 Range가 한 줄인지 확인한다. 최종 캡처의 건수 우측 정렬·줄바꿈·버튼 간격을 확인했다. flex 행 전체 높이를 줄바꿈으로 오판한 초기1개 검사 실패는 ui-final 로그에 보존하고, 실제 텍스트 측정으로 수정한 최종1개를 별도 기록했다.

## 리뷰·검증 한계

독립 리뷰의 비활성 삭제 권한·재확인409·게시/받은 자료 준비와 역사적 receipt·게시 부모 잠금 후 현재 읽기 findings를 수정했고 확정 미해결0건이다. 최종 BE/FE 전체 타입·scoped lint·build와 E2E 정적 타입을 확인했다. 진행 중 Remix fixture의 필수 proof 누락은 계약을 optional로 만들지 않고 fixture를 수정했다. strict 명세 lint는0 errors/기존2 warnings(FR011/NFR002 상태 차이), exit1을 유지한다. pin/check는 동기화이고 packet은 awaiting_review/acceptance not_recorded다.

실제 Ego96는 사용자 제어 공간으로 유지한다. headless viewport를 실제 Ego/실휴대폰·운영·사람 수용으로 표시하지 않는다. 모든 MySQL writer/모든 장애·초안 조합과 전체 TC050/16개 요건은 미완료다.
