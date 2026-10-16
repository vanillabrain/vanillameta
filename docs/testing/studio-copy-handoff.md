# Studio 저장본 복제·소스 교체 후 새 Studio 연결

Status: Draft · P5 · UC020/TC-005 재사용 진입 지원 · PASS_SELECTED.

## 변경 계약

Studio 도구줄의 ‘저장본 복제’는 마지막 저장본의 기존 소유 reuse 화면을 새 탭으로 연다. 현재 원본 탭의 미저장 변경은 포함하지 않으며 그 사실을 링크 title과 복제 화면에 표시한다. 새 source/열 연결 → 전체 미리보기 → 명시 비공개 저장의 기존 서버 계약을 사용한다. 자동 게시·새 LLM 요청은 없다.

`editor=studio`가 정확히 일치하는 소유 복제에서만 원본 보기 링크와 새 복사본의 완료 이동을 Studio로 연결한다. 임의 return URL은 받지 않는다. query가 없거나 잘못된 값이면 기존 조회 화면으로 이동하고, 공유/게시 수신자 복제는 query와 무관하게 기존 계약을 유지한다. 복사본 ID·권한·버전·원자 저장 검사는 기존 서버가 수행한다.

## Ego87 실제 실행 · 2026-10-17

기존 FE3698/API4899·원본45/source32·공개 합성 교체 source34를 재사용했다.

1. 원본에 미저장 블록 복제(3→4)와 미전송 질문을 두고 패널을 닫았다.
2. 실제 새 탭 복제 링크 → 저장본3블록 확인 → source34 선택/같은 이름의 호환 열3개 자동 연결 → 전체 미리보기.
3. 환불 비율10%, 날짜별10%/10%, 총매출300을 확인하고 명시 저장1회로 **비공개46/source34** 생성. 완료 URL은 `/dashboard/46/studio`다.
   4.46 reload는 GET만 실행했고 같은 계산/배치가 표시됐다. 별도 임시 DuckDB 연결로 원본 Parquet의 행을 읽고 Python Decimal로 계산한300.00/30.00/10% 및 두 날짜 값과 모두 일치했다. 파일 SHA는 `oracle.json`에 기록했다.
4. 원본 탭의 네 번째 블록·미저장·undo1·질문이 그대로 유지됐다. 질문을 비우고 undo로 검증용 편집만 원복했다. 원본45의 서버 응답 전체가 전후 동일하다.
   6.46은 원본과 새 블록 ID를 사용하고 저장된3개 제목·모든 폭 배치 좌표를 보존한다. 원본 미저장 네 번째 블록은 포함하지 않는다. shareYn=N/shareToken=null·publication0이며 임시 게시를 생성하지 않았다. 원본의 기존 publication updatedAt은 검증 시작보다 이전이고 이번 요청에 게시 쓰기는 없다.

**기능 PASS_SELECTED:** 위 저장본/소스 교체/비공개 저장/새 Studio/reload/원본 보존 범위다. 기존 미리보기+저장 POST가 각1회이며 저장 원자성·모든 장애/권한 조합을 이번에 새로 실행한 것은 아니다.46은 로컬 비공개 검증 복사본으로 보존한다.

**디자인 PASS_SELECTED:** 원본 미저장 도구줄·reuse 전체 미리보기·저장46 Studio를390/768/1440에서 캡처/실측했다.9상태 문서 넘침0, 복제 링크32px/14px·기존 헤더/블록 추가 행 보존. 복제 화면은 기존36px 버튼/입력과 모바일16px 입력을 따른다. 실제 휴대폰/전체 접근성은 NOT_RUN이다. 탐색/계산 엔진은 미변경으로 새 Rill live 비교는 하지 않고 독립 Parquet 수치로 검증했다.

## 검사·증빙·한계

- 관련 FE2파일48개·type·변경 lint·FE build PASS. 저장 성공의 소유 Studio 이동/기존 이동/외부 문자열 무시·공유 흐름의 query 무시, 원본 미저장 입력/별도 탭 링크·기존 미리보기/실패 회귀를 포함한다.
- backend/core E2E·운영/실휴대폰·고객 인수는 NOT_RUN. 고객 파일럿 입력/담당자 수용은 별도다.
- AIWF strict 기존12 errors/33 warnings/4 infos는 유지하며 pin/check는 승인/전체 수용이 아니다.
- `/tmp/vm-uc044/`: `original-before/after.json`, `original-draft-preserved.json`, `preview-xhr.json`, `save-xhr.json`, `reload-xhr.json`, `copy.json`, `private-publication.json`, `raw-source34.json`, `oracle.cjs/json`, `assertions.py/json`, `origin-dirty/reuse-preview/copy-saved-{390,768,1440}.png/json`, `reuse-link-*.json`, `unit/type/lint/build.log`.
- 초기 게시 확인용 잘못된 `/bi/.../publication`404는 증거로 사용하지 않았다. DB의 share/publication 상태·수정 시각과 실제 요청 기록으로 범위를 확인했다. 공유 행은 원래 존재하는 구조이므로 shareId 존재만으로 공개로 판정하지 않는다.

## 복사본 AI 편집 후속 · Ego88 · 2026-10-17

UC044로 생성한46/source34에서 선택 블록의 제목만 ‘금액 기준 환불률’로 변경해 달라고 실제 AI 대화로 요청했다. 저장/게시 금지를 명시했고 데이터 확인·AI 제안·계산 검증·초안 준비 단계가 완료됐다. UI의 지정 제공자/모델 표시는 Codex/gpt-6-luna를 유지했다. 실행ID `cc5bb50f-acdf-4302-833a-d78af46fb996`다.

- 저장 전 서버46 응답은 시작과 완전히 동일했다. 이후 명시 저장 버튼1회로 제목을 저장하고 reload했다. reload GET만이며 저장 응답과 재조회 응답이 동일하다.
- 문서·정의의 선택 제목만 변경됐다. SQL/다른 정의/모든 블록ID/모든 폭 배치·표시·소스34는 유지됐고 환불률10%·날짜별10/10·총매출300이 직전 독립 원본 oracle과 같다. 원본45 응답도 동일하다.
- AI 패널의 초안 완료 상태와 저장 화면을390/768/1440에서 캡처·시각 확인/실측했고 가로 넘침0이다. 모바일 Sheet의 질문/실행 기록·입력 및 저장 화면 헤더/긴 제목/도구줄 정렬을 확인했다. 실제 휴대폰/전체 접근성·새 Rill 대조는 별도다.
- 검증 후 직접 설정 화면에서 제목을 ‘환불 비율’로 원복하고 정상 저장했다.46의 문서/정의 내용은 시작과 같으며 두 번의 정상 저장으로 revision은 새 값이다.46의 게시0·원본45 불변을 확인했다. 새 공개 링크/새 복제/새 지표는 만들지 않았다.

**기능/디자인 PASS_SELECTED. 제품 코드 수정0.** 직전 `4676ab0a`의 관련 FE48/type/lint/build 결과는 미변경 범위에서 재사용했고 이번 후속의 새 실행으로 집계하지 않는다. 새 단위/빌드/core E2E는 수행하지 않았다. 실제 증빙 대조13개 PASS와 AIWF 문서 체크를 추가했다. 모델 실행/모든 자연어 일반화·운영/실기기·고객 수용은 별도다.

증빙은 `/tmp/vm-uc044-ai/`의 `before-copy/after-ai-server/saved-copy/reloaded-copy/restored-copy.json`, `before-original/after-original.json`, `runs.json`, `edit-save-xhr.json`, `reload-xhr.json`, `ai-draft/saved-{390,768,1440}.png/json`, `assertions.py/json`을 따른다. 원본 파일 oracle은 직전 `/tmp/vm-uc044/oracle.json`의 미변경 source34 결과를 재사용했다.
