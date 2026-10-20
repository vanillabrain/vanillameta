# 날짜·필수 컬럼 오류 도움 — 2026-10-13

범위: 커머스 CSV의 날짜 형식 오류와 필수 컬럼 누락을 기존 샘플 오류 도움과 같은 명시 클릭 → 설명 → 파일 재선택 → 재검증 흐름으로 연결한다.

## 계약

- DuckDB 검증에서 IMPORT_INVALID_DATE / IMPORT_MISSING_COLUMNS를 분류한다. 게시를 거부하고 마지막 정상 보고서를 유지한다. 필수 헤더와 권장 UTC 날짜 예시는 고정 UI로 제공한다.
- `/commerce/import-help`는 requestId만 받는다. 인증 사용자별 10분 메모리 진단, 중복 요청 차단·설명 캐시와 기존 Codex/gpt-6-luna 경로를 사용한다. AI에 원본 행·오류·파일 경로를 전달하지 않는다.
- 설명은 가능한 원인 안내이며 복구 상태는 unverified다. 실제 정상 CSV 재검증으로 복구를 확인한다. 새 파일·대상·경로 선택 및 언마운트는 오래된 업로드/도움 결과를 무효화한다.
- 서버에서도 사용자별 현재 가져오기 시도만 진단을 등록한다. 늦게 실패한 이전 요청이 새 진단을 복원하지 않는다. 접힌 폼의 재선택은 마운트 후 파일 선택을 호출한다.

## 선택 검증

기준 HEAD: 21d87990 + 현재 미커밋 diff. 격리 API 4883 / FE 3683, 저장소 밖 증빙 `/tmp/vm-import-help-evidence/`.

| ID             | 결과                   | 확인 범위                                                                                                                                                                                                                                                               |
| -------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HELP-IMPORT-01 | PASS_SELECTED_VARIANTS | 잘못된 주문 날짜와 필수 헤더 누락의 실제 API 진단 및 Codex 설명. api-results.json. Aside 날짜 설명 캡처 date-help.png와 누락 설명 missing-help.png.                                                                                                                     |
| HELP-IMPORT-02 | PASS                   | 누락 오류 중 기존 결제20994.61 / 환불4457.60 / 차감16537.01 유지. Aside에서 정상 주문 파일 재선택·재업로드 후 같은 보고서 유지. API 정상 재시도는 noop/version1 확인. 최종 UI 재시도 후 격리 DB도 source5/version1, run11 rejected → run12 noop/publishedVersion1 확인. |
| HELP-IMPORT-03 | PASS_SELECTED_VARIANTS | FE15개: 명시 클릭·민감 응답 미노출·실패 재시도·취소·오래된 결과·파일/경로 변경·접힌 카드 재선택. BE 관련 검증: import-help/파서/샘플26개, service/sample-help17개 통과(중복 import-help 집계 제외). 서버 경합 회귀 추가.                                                |
| HELP-IMPORT-04 | PASS_SELECTED_VARIANTS | Aside 접힌 폼에서 파일 다시 선택 → 폼 마운트 확인 후 setInputFiles로 정상 파일 재선택. OS 네이티브 선택창 자체는 확인하지 않았음.                                                                                                                                       |

FE 타입·변경 FE lint·FE production build·BE build·변경 BE lint·git diff check 통과. BE lint non-null assertion 경고1, 기존 Vite/CSS minify 경고 유지. 전체 E2E는 범위상 반복하지 않았으며 기존130개 집계 유지.

## 잔여

모바일390px, VoiceOver 발화, 실제 provider 타임아웃/취소/미지원 변형, OS 파일 선택창은 NOT_RUN. 자동 테스트 취소 검증을 실제 provider 취소로 확대하지 않는다. 단일 서버 메모리 진단은 재시작 시 만료된다. 날짜 파싱 정책 변경이나 자동 데이터 수정은 범위 밖이다.
