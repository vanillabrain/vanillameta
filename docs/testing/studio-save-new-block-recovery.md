# Studio 신규 블록 저장 응답 유실 복구

Status: Draft · UC047/P3/FR009 · TC047 · PASS_SELECTED.

## 범위와 사전 설계

[UC047 계획](../plans/UC-047.md)의 신규 블록 후속이다. 제품 소스는6911c634 그대로이며 임시 ID를 포함한 정확한 저장 요청을 재확인하는 회귀1개를 추가했다. 새로운 기능/DB/의존성은 없다. 기존 [Ego92 제목 변경 검증](studio-save-recovery.md)에 실제 신규 ID 범위를 보완한다.

## Ego93 실제 검증 · 2026-10-17

기존3698/4898/4899와 비공개46/source34의 공개 합성 자료를 사용했다. 정상 서버를 유지하고 별도4901 응답기로 지정 저장 한 건의 실제201 commit 후 브라우저 응답만503으로 치환했다. 토큰은 증빙에 기록하지 않았다.

1. 환불 비율 블록 복제→`UC047 신규 블록 복구`로 제목 변경→데스크톱 크게→미전송 질문 입력→명시 저장.
2. 임시 ID `new:cacb3da5-3b79-4822-b983-dae7a6cae46d`가 서버 ID `block-e8964c68-65b6-45f6-b21f-b5fd1c20d8a6`로 저장됐다. 실제 저장은4블록이며 lg의 추가 블록 높이6을 포함한 lg/md/xs 좌표를 대조했다.
3. reload 후 권한/Studio GET만 실행했다. 편집기 대신 같은 저장 요청 재확인 화면을 표시했고 자동 POST/AI/게시0이었다.
4. 명시 재확인 POST201의 원 요청 body/requestId/임시 ID가 첫 요청과 완전히 같았다. 기존 영수증의 idMap/서버 ID/저장 revision이 같았고 최신 GET200으로 편집기에 복귀했다.
5. 전체46 영수증은16→17이며 같은 요청 영수증은1개다. 재확인으로 추가 영수증/블록/저장 revision이 생기지 않았다. 저장본 reload도 GET만이며4블록과 동일 문서를 반환했다.
6. 문서/미확인 요청 키는 제거하고 질문 키만 유지했다. 명시 질문 복구 후 실제 입력 원문이 같았다. 별도 정상 UI 저장으로 추가 블록만 제거해 기존3블록/ID/모든 폭 배치/계산 정의를 원복했다. 정상 원복 저장은 새 revision을 만든다.
7. 원본45의 전체 API 응답 불변·46 비공개/게시0을 확인했다. 임시4901 응답기를 종료했고 기존 서버는 유지했다.

공유 definition 카탈로그의 widget 표현은 같은 정의를 참조하는 마지막 복제 블록의 ID/제목을 포함한다. 따라서 신규 블록 저장 중 카탈로그 전체의 완전 불변으로 판정하지 않고 원래 문서 블록·모든 배치와 계산 정의를 대조했다. 제거 후에는 기존 카탈로그 entries도 완전히 같았다. SQL/집계·차트 동작은 바꾸지 않아 새 Rill 실행/수치 oracle은 반복하지 않았다.

## UI와 검사

- 확인 화면과4블록 저장 화면의390/768/1440px 실측 가로 넘침0. 확인 버튼32px, 실제 캡처에서 제목/설명 줄바꿈·좌우 간격·버튼 정렬을 확인했다. 모바일은 Chromium 화면 폭 검증이며 실제 휴대폰 검증이 아니다.
- 관련 FE2파일9테스트 PASS(신규 ID 회귀1개 포함), 타입·변경 파일 lint PASS. 제품 소스 불변이므로6911c634의 FE111/build 증빙을 재사용하며 새 전체 검사로 표현하지 않는다.
- 실제 요청/영수증/idMap/문서/배치/질문/원복/UI38개 대조 PASS. 초기 대조 스크립트의 카탈로그 전체 동일성 가정을 위의 공유 정의 표현에 맞게 수정했고 제품 오류로 처리하지 않았다.
- AIWF strict 기존12 errors/33 warnings/4 infos로 실패 상태 유지, pin/check 일치. packet은 awaiting_review/acceptance not_recorded이며 독립 리뷰/고객 승인이 아니다.
- 확정 후 최신 GET 실패 중 reload·409 초안 복귀는 기존 컴포넌트 회귀 범위다. 이번 실제 실행에는 포함하지 않았다. 모든 경합·운영 MySQL·실휴대폰·전체TC005/고객 수용은 Open이다.

증빙은 `/tmp/vm-uc047-block/`의 `before/after-{45,46}.json`, `lost-response/replay.json`, `fault-events.jsonl`, `committed/recovered/reloaded.json`, `reload-pending/saved-audit.json`, `storage-lost/recovered.json`, `question.json`, `db-before/replayed.json`, `confirm/saved-{390,768,1440}.png/json`, `assert.py/assertions.json`, `unit/type/lint/strict.log`다. `/tmp`는 로컬 실행 증빙이며 영구 배포 산출물이 아니다.
