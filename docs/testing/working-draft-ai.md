# UC-008 공통 초안 AI 편집 — 2026-10-15

기준 develop-v2 / fabb23f2 위 작업 diff. [계획](../plans/UC-008.md) / [UC](../use_cases/UC-008-ai-edit-working-draft.md). P1 전체 완료가 아니다.

## 구현 계약

DashboardEdit에서 현재 items/제목/revision과 선택 key를 `/bi/dashboards/:id/editor/ai`에 보낸다. 서버 editor compiler가 현재 소스·전체 초안을 검증하고 기존 AI generator로 한 블록을 수정한다. 반환 블록만 교체해 다시 compiler/preview를 통과시킨다. AI 호출 중 바뀐 revision도 거절하며 이 endpoint는 저장하지 않는다.

프런트는 AI 변경을 직접 편집과 같은 최대50단계 이력에 적용한다. undo/redo는 미리보기를 무효화한다. 변경을 선택적으로 명시 저장한다. 취소·중복 요청·경로 변경의 늦은 응답은 초안을 덮어쓰지 않는다. UI에 내부 draft 종류 선택을 추가하지 않는다.

명시 draft 종류의 definition은 현재 소스에 대한 SELECT FROM source만 허용하는 기존 validateDraft/실제 preview 경계를 사용한다. definition의 databaseId/blockId는 권한·논리 ID 근거가 아니며 compiler가 소유 소스와 기존 key의 ID를 적용한다. 기존 existing 종류는 계속 서버 원본 SQL만 사용한다. AI 계산 변경은 분석 SQL snapshot 변경이며 중앙 지표를 갱신하지 않는다. 계산이 달라진 블록의 이전 구조화 지표 연결을 그대로 주장하지 않는다.

## 결과

| 케이스                      | 상태                | 증거                                                                                                        |
| --------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------- |
| TC-008-01 미저장 편집+AI    | PASS 단위/실LLM API | 제목·순서 변경과 미저장 복제본을 함께 전달, 복제본을 하루별 선 차트로 변경                                  |
| TC-008-02 공통 undo/redo    | PASS 컴포넌트       | 직접 제목 편집은 유지하면서 AI 수정만 되돌림/다시 실행, 재미리보기 후 저장 transport                        |
| TC-008-03 권한·SQL·revision | PASS 단위/API       | 비소유 접근/foreign target/외부 테이블/DELETE 거절, 위조 source/ID 무시, 호출 전·호출 중 revision 경합 거절 |
| TC-008-04 취소·늦은 응답    | PASS 컴포넌트       | 취소 후 기존 초안 유지, 분석 전환의 늦은 AI 결과 무시, 중복 요청 방지                                       |
| TC-008-05 저장·재조회       | PASS API            | 원본4개 ID/geometry, 미저장 제목·순서 유지, 신규 복제본 서버 ID, API 재조회 성공                            |
| TC-008-06 디자인·실제 UI    | BLOCKED             | 기존 브라우저 URL 정책 차단. 실제390/768/1440 화면·브라우저 새로고침·Rill 화면 재비교를 우회 실행하지 않음  |

- BE 3 suites / **93 tests PASS**: bi-editor, dashboard-blocks, ai-dashboard.service.
- FE **16 tests PASS**: DashboardEdit. FE 타입, 변경 BE/FE lint, BE/FE build PASS.
- 공식 Rill 소스7의 새 비공개 검증 분석 **15**. 실제 지정 LLM으로 미저장 복제본을 CHART_LINE으로 변경했다. 일별 **8행 합계634513000**, 기존 수치 oracle와 일치한다. 미리보기 전후 저장 분석이 동일한지 확인하고 이후 명시 저장했다. stale AI revision409 및 원본 분석14 불변 확인.
- 증빙: `/tmp/vm-working-draft-ai/result.json`, `fixture.json`, `verify.cjs`, `backend-tests.log`, `frontend-tests.log`. 임시 폴더이므로 영구 보관은 보장하지 않는다. 로그인 응답/토큰은 기록하지 않았다.
- API4898는 이번 빌드로 재기동, 기존 frontend3698 유지. 편집 주소: `http://127.0.0.1:3698/dashboard/15/edit-charts`. 주소와 컴포넌트 테스트는 실제 화면 관찰 증거가 아니다.
- 익명 공유, core browser E2E, 중앙 지표 계산 변경·일괄 반영은 이번 범위에서 실행하지 않았다. Rill 화면이 동일하다고 주장하지 않는다.

## 남은 작업

breakpoint별 자유 이동/resize와 배치 저장·복원, 프롬프트 배치 이동, 실제 UI/모바일 검증이 남는다. 이 통합은 선택 블록 내용 수정과 로컬 초안/이력에 한정하며 한 프롬프트로 자동 저장·게시하는 P3/P4 또는 분석 복제·소스 교체 P5 완료가 아니다.
