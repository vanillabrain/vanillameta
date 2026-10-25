# 계산 검증·도움말 후속 — 2026-10-25

기준은 `develop/9fcadbba`와 미커밋 diff다. [일별 추이 진단](studio-daily-diagnosis.md) 뒤 승인받은 다섯 조건만 보완했다. 기존 통과 조건의 전체 회귀나 베타 전체 수용으로 확대하지 않는다.

## 수정 범위

- 신규 생성뿐 아니라 기존 생성안의 수정·블록 추가에도 미지원 요청 검사를 적용한다. 거절 시 기존 생성안·수치·질문을 보존하며 모델/미리보기를 새로 실행하지 않는다. 따옴표로 감싼 제목 변경 예외는 유지한다. 전체 자연어 의도 판별이나 모든 동의어 지원을 뜻하지 않는다.
- 새 FORMULA의 비율 노드에서 양쪽의 정규화된 SQL이 같으면 `FORMULA_SELF_RATIO`로 거절한다. 중첩 식·이름/ID가 달라도 같은 계산을 포함한다. 역사 지표 읽기·재사용은 바꾸지 않으며 대수적 동치 전체를 판별하지 않는다.
- 같은 분류 열에 대한 새 COUNT_DISTINCT의 무의미한 비교만 막는다. native DATE의 identity CAST도 차단하고, TIMESTAMP→DATE로 묶은 서로 다른 시각 수 2/1, 자기 열로 묶은 SUM, 서로 다른 분모의 RATIO_SUM은 허용한다.
- JSON·NDJSON 연결 종료 후 실제 결과/취소를 동일하게 분류하고 모두 WARN으로 기록한다. 정상 연결 결과는 INFO다. 임의 오류 내용·비공개 필드는 전달하지 않고 알려진 FORMULA 오류 코드만 전달한다. 프런트엔드는 이 오류를 생성안 만료로 오인하지 않는다.
- 날짜 열 준비, 시각/날짜 차이, 미지원 요청 수정, 자기 비율의 의미와 연결 종료 후 확인 절차를 도움말에 반영했다.

## MD 검증 결과

| ID | 조건 | 결과·증거 |
|---|---|---|
| CALC-01 | 신규/수정/추가의 미지원 요청 | 선택 단위 검사 PASS. Ego64 신규 월별 요청은 AI 0/30, 기존 일별 생성안의 월별 수정 거절 뒤 AI 1/30·300/50 보존 |
| CALC-02 | 새 FORMULA 동일 분자/분모 | helper·실제 BI 통합 검사 PASS, SQL/저장 전에 거절; 역사 읽기 유지. 실제 브라우저 FORMULA 작성 여정은 이번 범위 아님 |
| CALC-03 | 정상 동일 열 집계와 DATE identity 경계 | 실제 DuckDB 포함 생성 suite PASS. TIMESTAMP 날짜별 distinct 2/1 허용·native DATE 자체 distinct 거절 |
| CALC-04 | 실제 AI 생성→수정→저장→reload | Ego64, gpt-6-luna 2회, source2/dashboard2/metric1. DATE 합성 파일의 날짜별 SUM 300/50과 수정 제목 복원 PASS |
| CALC-05 | 연결 종료 결과 로그 | JSON/NDJSON 선택 suite 46 PASS. cancelled run·성공 result·throw·안전한 오류 코드 포함. 이번 실제 브라우저 강제 단절은 실행하지 않음 |
| CALC-06 | 모바일·키보드 | Studio 390/768/1440px 문서 가로 넘침0. 수정 입력창에서 Tab 두 번→저장 버튼→Enter 저장. 표 버튼 focus 후 Enter로 실제 표 열기. 전체 키보드/VoiceOver 수용 아님 |
| HELP-01 | 사용자 문서 | 수정 5페이지 local preview 렌더·VitePress build PASS. 390px 문제 해결 페이지 넘침0, 검색 버튼에서 Tab→가이드 링크 확인. 운영 배포하지 않음 |

## 실행 근거

합성 CSV는 `order_date,amount,category` 3열·3행이며 2026-01-01의 100+200=300, 2026-01-02의 50이다. 업로드 파서는 DATE/BIGINT/VARCHAR로 추론했다. 질문은 `order_date 날짜별 amount 합계를 선 차트 하나로 보여줘. 실제 열 이름을 그대로 사용해줘.`이며 이어서 제목만 `일별 매출 검증`으로 바꾸도록 요청했다. 두 호출 뒤 UI 쿼터는 2/30이다. 저장한 문서의 정의1개·지표1/v1·전체 기간 UTC가 reload 뒤 유지됐다.

실행 환경은 관리 worktree의 Node26.12.1, 전용 Docker MySQL8.4.11·native DuckDB·API4263/Web3263/Control4463이다. 빈 격리 DB의 development synchronize이며 운영 migration이 아니다. 기존 Codex 연결·gpt-6-luna를 사용하고 인증/모델 설정을 바꾸지 않았다. 운영 모드는 여전히 Codex 제공자를 거절하므로 이번 성공을 운영 AI 제공자 수용으로 사용하지 않는다. Node24 검증도 별도다.

최종 영향 BE4 suites **232 PASS / 0 FAIL / 0 SKIP**: 생성143·formula25·BI통합18·stream46. FE3 suites **85 PASS**와 BE/FE type/lint/build PASS를 확인했다. 재실행·부분 배치는 중복 합산하지 않는다. red→green 로그와 초기 테스트 기대 순서·fixture cache 누적 실패도 보존했다. 후자는 테스트 서비스 인스턴스를 사례별로 분리했고 제품 proposal 상한64는 변경하지 않았다. 최종 별도 정적 검토는 CLEAR, BLOCK 없음이다.

## 증빙·정리

증빙 폴더: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/calculation-followup-20261025/`.

- `audit/FINAL-ALL-PATCHES.md`: 최종 검사 및 build 기준. 이전 SUMMARY의 중간 실패와 구별한다.
- `input.csv`, `oracle.json`, `browser-layout.json`: 합성 입력·정답·대표 폭별 실제 DOM 표 300/50.
- `refine-rejected.png`, `keyboard-save.png`, `studio-390.png`, `studio-768.png`, `studio-1440.png`: 실제 앱 증빙. 고정 높이 차트의 표는 내부 스크롤 영역이어서 화면 한 장에 모든 행이 노출되지는 않는다.
- `help-pages.json`, `help-mobile.png`, `help-desktop.png`: 도움말 렌더. `help-mobile-calculations.png`는 이름과 달리 다음 호출에서 에뮬레이션이 해제된 데스크톱 캡처이므로 모바일 증거에서 제외한다.
- `runtime-pre-stop.json`, `runtime-stop.json`: 소유 그룹0·오류없음 확인 후 제어 API stop200. 전용 supervisor가 drain 절차로 서버/DB를 종료했다. 문서3364 preview와 Ego64도 종료했다.

Ego 에뮬레이션 중 포인터 클릭이 적용되지 않은 시도는 PASS로 세지 않고 snapshot 확인 후 키보드 Enter로 검증했다. VoiceOver 차단 상태와 기존5173·다른 Colima 프로필은 유지했다. 관리 worktree는 앞선 archive 보호 거절에 따라 보존한다. `.claude/settings.json`·`CLAUDE.md`의 다른 작업 변경은 수정하지 않았다. 커밋·push·도움말 운영 배포는 하지 않았다.

## 사용자 도움말

[AI 생성](../user-manual/site/ai-create.md), [AI 수정](../user-manual/site/ai-edit.md), [데이터 연결](../user-manual/site/data.md), [지표와 차원](../user-manual/site/metrics.md), [문제 해결](../user-manual/site/troubleshooting.md).

남은 범위는 과거 삭제된 실패 입력의 원인 확정, 운영 제공자/Node24/실기기 검증, 미지원 월별·상위N 생성 확장 및 VoiceOver다. 이번 성공으로 이 항목들을 완료 처리하지 않는다.
