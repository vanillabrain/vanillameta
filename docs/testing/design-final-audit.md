# Rill 최종 AI 화면·수정 UX 및 미설정 오류 — 2026-10-12

기준 `develop-v2` / `3cb58b36` + 이번 접근성 이름 수정. `vanillameta-verify` MD 잔여 조건을 실제 headed Chromium으로 확인했다. Aside daemon 부재에 따른 기존 허용 대체 브라우저다. 비교 URL은 VM `http://127.0.0.1:3400/dashboard/5`, Rill `http://localhost:9009/canvas/auction_qa?tr=inf`, desktop1440×900. 기존 광고 원본1391572행/SHA256/집계·VM 실Codex 생성/수정/저장/필터 결과는 관련 변경 없이 재사용했다. VM의 gpt-6-luna 설정은 유지했고 VM 실LLM 호출은 반복하지 않았다. Rill은 제품 자체 AI로 검증했으며 동일 모델을 사용한다고 주장하지 않는다.

## 최종 결과

| ID | 판정 | 보완한 잔여 조건 |
| --- | --- | --- |
| DESIGN-01 | 완료 | 기존 Rill 대화의 최종 차트를 재열어 확인했다. 재기동에 따른 날짜 이동 때문에 현재 All time 범위에서도 동일 공통 질문의 미완료 비교를 보완했다. 실제 Rill 응답은 요청634513000, 평균5.5712386765(정답 오차1e-9 이내), 기기9개 정답·내림차순·분모·범위 설명. 실제 최종 차트 캡처와 VM의 기존 Luna SQL/정답/설명을 대조했다. |
| DESIGN-02 | 완료 | VM Luna 생성 후 저장 화면에 요청634,513,000 / 평균$5.57 / 가로 막대9개 이름·0축·전체 폭·전체 기간/필터 없음 표시. Rill 동일 전체 데이터의635M/$5.57/9개 가로 막대와 대조. 작은17,000은 VM 데이터 표와 Rill AI 답변에서 정확값 확인. 화면 반올림 차이는 유지한다. |
| DESIGN-03 | 비교 완료 | 같은 수정문을 Rill 조회 AI와 편집 AI에서 직접 실행했다. 조회 AI는 변경안을 안내, 편집 AI는 YAML에 제목/헤더/차트제목을 즉시 반영. reload 후 변경 제목·2KPI·가로막대 유지. 기존 필터/VM 수정·취소·저장 증빙과 함께 결과·단계 차이를 기록했다. 양 제품의 저장/취소 UX가 동일하다는 판정은 아니다. |
| AI-DASH-01 | 완료 | 기존 VM 실Luna 생성/수정/취소/저장/오류 결과에 Rill 동일 수정문 비교를 추가. 실제 미설정 API와 UI 오류·저장 비활성·자산 불변 증빙을 보완했다. |
| DESIGN-04 | 부분 완료 | 새로고침/수정/삭제·계정·언어·홈 링크 이름 누락을 수정하고 한/영 실제 접근성 트리, 계정 메뉴 Enter 열기/닫기·controls 대상 존재 확인. 모바일390×844에서 수정 화면 document폭390 확인. 전체 대비 측정·스크린리더·전체 키보드 경로는 NOT_RUN. |

DESIGN-03의 완료는 명세가 요구한 비교 관찰이 모였다는 뜻이다. Rill 편집 AI는 파일에 즉시 쓰며, 이번 흐름에서 VM의 **미리보기 → 명시 저장 / 취소**와 같은 트랜잭션을 제공하지 않았다. 같은 수정 결과는 얻었지만 UX 동등성은 아니다. Rill의 조회 모드는 변경 방법을 안내하고, 편집 모드로 전환해야 파일을 수정했다. 다른 제품의 동작을 VanillaMeta의 결함으로 간주하지 않았다.

Rill 기존 대화에 이어 수정문을 입력했을 때는 이전 `Do not change existing dashboards` 지시와 충돌해 변경을 거절했다. 최초 응답을 보존하고 새 대화에서 동일 수정문을 입력했다. 조회 모드는 안내, 편집 모드는 파일 쓰기 성공이었다. 파일 변경은 `/dashboards/auction_qa.yaml`의 display_name, markdown 헤더, 차트 제목에 한정되고 KPI measures 및 x/y/sort는 유지됐다. 비교용 로컬 샘플 수정 상태를 보존했다.

Rill 모델은 재기동 시 원본 날짜를 현재로 이동한다. 기존 대화의 고정 날짜와 새 All time 범위를 혼용하지 않았다. 신규 공통 질문은 2026-10-05T11:47:08Z~2026-10-12T12:00:00Z 전체 범위, 필터 없음이며 VM은 원본 전체 기간이다. 총량/9개 수치 비교이지 원본 날짜의 동일성을 입증하는 것은 아니다.

## AI 미설정 격리 검증

기존4500/4670 Luna 서버 설정을 변경하지 않았다. 메타데이터를 SQLite backup으로 복제해4680에서 provider/API key 없는 상태로 기동했다. 모델명은 gpt-6-luna를 유지했고 다른 모델/로컬LLM을 호출하지 않았다. 실제 UI 생성 요청을 이 서버에 전달한 뒤 실제 응답을 UI로 반환했다(가짜 오류 JSON 생성 아님).

실제 HTTP201 / business `ERROR: AI 기능이 설정되지 않았습니다.` → UI alert·저장 disabled. 원본과 복제의 dashboard/dashboard_widget/widget/dataset/table_query 전체 행 해시 동일. 취소 후 원본 VM 초안 유지. 검증 후 이 격리 서버만 종료했고 기존 Luna 서버는 계속 사용 가능하다.

## 수정·검사

- DashboardView: 자동새로고침 선택 및 새로고침·수정·삭제에 이름 추가.
- Header/Logo/ProfileViewButton: 언어·홈·계정 메뉴 이름, 계정 메뉴 controls를 실제 Popper ID에 연결.
- 한/영 번역 추가. UI 아이콘 모양/저장/API/집계 변경 없음.
- FE tsc --noEmit PASS, 변경6파일 eslint PASS, FE production build PASS, git diff check PASS.
- 새 pageerror0. 기존 필터/집계/모바일 전체 흐름 및 VM 실LLM 성공 검사는 재사용했다. 새 범용 E2E 코드/의존성 추가 없음.

## 증빙

폴더 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/design-final-audit`:

- `rill-current-answer.txt/png`, `rill-current-chart.png`: 같은 공통 질문의 현재 범위 응답·완료 차트.
- `rill-original-final.txt/png`, `rill-ai-chart-final.png`: 이전 대화 최종 렌더 증빙(기존 고정 날짜).
- `rill-revision-context.txt/png`, `rill-revision-readonly.txt/png`, `rill-revision-editor.txt/png`: 기존 지시 충돌·조회 안내·편집 파일 쓰기 단계.
- `rill-revised.yaml`, `rill-revised-reloaded.txt/png`: 파일 지속 및 최종 화면.
- `vm-ai-final-desktop.png`, `vm-final-table.txt/png`, `vm-current-draft.json`: 기존 Luna 결과의 현재 읽기 화면/정확값/보존.
- `vm-labeled-screen.txt`, `english-labels.txt`, `vm-labeled-focus.png`, `mobile-labeled-screen.txt`, `vm-labels-mobile.png`: 이름 수정 및 모바일 증빙.
- `unconfigured-result.json`, `unconfigured-ui.png`, `unconfigured-assets.json`: 실제 오류·저장 차단·자산 불변.
- `verification-receipt.json`, `frontend-build.log`: 환경/선택 검사.

이전 Luna 실AI 정답은 `../codex-luna-connection/ai-saved-oracle.json`, 생성/수정/통화 prefix 결과와 RESULTS.md를 재사용한다. 현재 남은 MD ID는 DESIGN-04 하나이며, 완료 ID 수와 전체 출시/운영 준비 또는 WCAG 준수는 다른 판정이다.
