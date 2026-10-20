# 저장 지표 계산식 일괄 반영 검증

2026-10-14, develop-v2의 923fc80c 이후 UC-004 변경. 기존 실행 환경 WEB3698 / proxy4899 / API4898, Rill9009에서 검증했다.

| 범위            | 결과                      | 근거                                                                                                                                                                                                       |
| --------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BE              | PASS 5 suites / 170 tests | AI dashboard, saved metric reference, ownership, BI editor, assistant. 삭제/다른 소스/타인 분석 제외, 대상 경합, 중복/한도, 여러 연결 차트, 명시 연결 기록, 후반 실패 전체 rollback, 사용자 지정 배치 보존 |
| FE              | PASS 3 files / 41 tests   | 계산식 editor, Assistant, transport. 영향 목록/대상 선택, stale guard, 불완전 응답 저장 차단, responsive 상태 유지                                                                                         |
| Type/lint/build | PASS                      | FE tsc, 변경 BE production/FE lint, Nest/Vite build. 기존 service.spec의 non-null assertion 경고는 기존 범위                                                                                               |
| 실제 화면/XHR   | PASS                      | 영향 확인 → 두 분석 미리보기 → 일괄 저장 → 각각 새로고침                                                                                                                                                   |
| 디자인          | PASS 390/1440             | 입력32px/폰트12px, 버튼28px, 가로 넘침 없음, viewport 전환 후 선택/미리보기 유지. 체크박스·줄바꿈·접힌 추가 결과를 캡처로 확인                                                                             |

## Rill 및 실제 분석

- Rill 공식 auction 데이터의 검증용 `uc003_requests`를 AVG에서 SUM으로 수정하고 Save changes. Explore는 compact 표시635M, Pivot OS 전체 합계는634,513,000이며 새로고침 후 유지된다. 기존 공식3개 measure는 보존했다.
- 같은 데이터의 VM source7 / metric17, 숫자 분석8와 OS 분석9를 사용했다. 영향 목록은 소유 분석2개, 연결 차트 각각1개, 저장v2를 표시한다. 미연결 분석2개는 제외 안내한다.
- 미리보기에서 숫자634,513,000 및169시간별 점, OS28개 값의 합634,513,000을 XHR로 확인했다. 미리보기 전후 지표v2가 유지되어 쓰기가 없음을 확인했다.
- 일괄 저장 응답의 updatedAnalyses는[8,9]. 지표는v2→v3 한 번 증가하고 두 분석의 SUM SQL 및 저장 연결v3가 반영됐다. 숫자 화면 새로고침 후634,513,000.00와 추세가 표시된다.
- OS 화면도 새로고침 후28개 차트/데이터 표를 확인했다. Android283,985,400, Windows114,389,600 등 Rill Pivot과 일치한다. 숫자/OS 기존 layout geometry는 ID remapping 외 모두 보존됐다. 기존 metric3/4 및 분석5의 정의는 변하지 않았다.
- 모바일은 별도 소유 검증 소스21/지표16/분석7·10에서 영향 확인과 AVG 미리보기만 실행했다. 저장하지 않았으며 기존 정의는 유지했다.
- Rill은 중앙 measure 변경으로 관련 Explore/Pivot이 반영된다. VM은 저장 SQL snapshot을 사용하는 분석이므로 명시 목록/선택 및 일괄 transaction으로 반영한다. 날짜가 이동된 Rill 데모와 VM UTC 원본의 동일 달력 날짜/픽셀 일치를 주장하지 않는다.

## 실행 증빙

- `/tmp/vm-batch-update/`: be-final.log, fe.log, be-build.log, fe-build.log, type.log, lint-be-final.log, lint-fe.log, preview.json, responses.json, persisted.json, layout.json, dialog-390/1440.png, rill-explore/pivot.txt/png.
- Aside session `2026-10-14_ElRAuMzDbgj1MolF/artifacts/`: uc004-impact.png, uc004-preview.png/json, uc004-responses.json, uc004-reload8/9.txt/png. 읽기 전용 XHR 관찰은 저장 후 해제했다. raw API 로그/인증 정보는 review packet에 넣지 않는다.
- 로컬 `.aiwf/evidence/UC-004`의 로그와 review packet은 Git 외부 증빙이다. 문서 digest는 스펙 변경 확인용이며 실행/승인 증거를 대체하지 않는다.

## 범위와 미확인

- 명시 저장 연결로 확인된 소유 분석만 지원한다. 연결 없는 옛 AI 분석은 해당 차트에서 지표를 선택해 계산식 저장한 이후 발견된다. 이름/SQL로 추측하지 않는다. 최대10개 선택이며 대규모 catalog paging은 이번 범위 밖이다.
- 새 LLM 질문, 전체 핵심 E2E 일괄 실행, 물리 모바일, VoiceOver, 운영 배포는 미실행이다. 이 계산식 변경 흐름은 LLM을 호출하지 않는다.
- 별도 작성/의미 검토 pass를 수행했으나 동일 작성자이며 독립 reviewer나 stakeholder acceptance는 미실행이다. packet은 awaiting_review, acceptance는 not_recorded다.
