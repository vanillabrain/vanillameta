# Studio 소유자 복제 저장 — 새로고침 복구

2026-10-19 · 기준 `7c3a05ef` + 신규 기능 · P5/FR012·NFR008 · 사용자가 직전 bounded 설계를 승인한 범위.

| ID | 신규 조건 | 기대 | 상태 |
|---|---|---|---|
| SPR-RR-01 | 실제 저장commit 뒤 응답503 대체→새로고침→실제 API 재시작→명시 같은 요청 확인 | 초기 UUID/ticket 그대로 보관·reload 자동 요청0·기존 사본 반환/추가 자산0·현재 권한/로그인 재검사 | PASS · 아래 범위 |
| SPR-RR-02 | 서버 미전달/만료 ticket의 보관 요청→명시 확인 거절→연결 입력 복귀 | 기록/입력 유지·현재 원본/소스 확인 후에만 복구·새 미리보기 명시 전 저장0 | PASS · 아래 범위 |
| SPR-RR-03 | 복구 안내·오류·재시도390/768/1440·키보드 | 기존36px 버튼·줄바꿈/포커스/페이지overflow0·자동 반복/중복 요청0 | PASS · 아래 범위 |

소유자 Studio 혼합 복제만 저장 전 기존 로그인·탭 scope에24h/8KiB의 최소 확인 기록을 보관한다. requestId/ticket·제목/대상 소스/열 연결/블록 선택·단위 확인이며 SQL/결과/token은 저장하지 않는다. 공개/수신자/일반 복제 경로는 확장하지 않는다. 저장 전 보관 실패는 POST를 막고 입력을 유지한다. 미확정 재시도로 보관 기한을 갱신하지 않는다.

기록을 권한 증명으로 사용하지 않는다. reload는 복구 안내만 표시하고 명시 같은 POST로 서버 영수증/현재 접근을 확인한다.400/409 거절 후만 연결 복귀를 허용하며 현재 원본·소스 조회/로그인 scope 확인이 실패하면 기록을 지우지 않는다. 성공 확인 뒤 기록 정리에 실패해도 새 복제를 시작하지 않는다. 명시 복구 전/후 자동 저장·게시0이다.

실제 검증은 기존 로컬 공개 샘플3/source4와 대상29, API4560/웹3460을 사용한다. 제품 AI는 호출하지 않고 gpt-6-luna 설정·VoiceOver BLOCKED를 유지한다. 기존9개 MySQL·이미 통과한 정상 소스 복제·일반 게시/AI를 반복하지 않는다.

증빙 root: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-reuse-reload-recovery-20261019/`.


## 실행 결과

Ego41·웹3460/API4560의 공개 합성 margin18행을 사용했다. 기존 테스트 계정만 로그인했고 인증정보는 출력/증빙/커밋에 넣지 않았다. 제품 AI 호출은 없으며 gpt-6-luna 설정과 VoiceOver BLOCKED를 유지했다.

- **SPR-RR-01:** 원본3→대상29의 실제 저장201을 응답 단계에서503으로 대체했다. 제목·6열·6블록·단위 확인과 UUID/ticket의 최소 기록656바이트가 보관됐다. reload에서 복제 GET/POST·profile GET0, 일반 로그인 사용자 조회1만 있었다. 전용 API를 실제 재시작한 뒤 Enter로 같은 요청을 확인해 **201/replayed=true/기존 dashboard30**으로 이동했다. 기록은 제거됐고 Pivot5431.25USD/5.39%가 보존됐다. 단위 검사의 body 동일성 확인과 실제 replay를 함께 근거로 사용한다.
- **SPR-RR-02:** 새 저장 POST를 request 단계에서503으로 막아 서버에 전달하지 않았다. reload 후 API를 다시 재시작했고 명시 확인은 실제400(만료된 미리보기)이었다. 확인 전 복제/profile 자동 요청0이다. 기록을 유지한 채 Tab→Enter로 ‘연결 입력으로 돌아가기’를 선택해 원본 GET200→source29 profile GET200을 확인했다. 제목·6개 매핑·단위·6개 블록 입력을 복원하고 확인 기록을 정리했으며 저장은 비활성이었다. 이후 명시 Enter로 새 미리보기만 성공시켰다. 추가 저장/게시0이다.
- **SPR-RR-03:** 복구 안내/만료 오류390·768·1440에서 페이지 가로 넘침0, 주요 버튼36px이다. 복원 화면 입력/선택36px,390/768 입력16px·1440 입력14px와 같은 행 배치를 확인했다. 복구 확인 버튼의 가시 포커스가400 후 유지되고 Tab으로 입력 복귀 버튼에 접근했다. 아래 초점 수정 후 실제 키보드로 전체 미리보기까지 연결했다. native select는 문서화된 selectOption으로 준비했으며 전체 native 선택/실휴대폰/VoiceOver 통과로 확대하지 않는다.

### 발견·수정·재검증

1. 읽기 전용 Astra peer가 **보관 실패 뒤 낡은 request를 다시 기록할 수 있는 경로**를 발견했다. 로컬 candidate를 검증 저장한 뒤 ref에 확정하고 POST 직전 ticket/requestId 일치를 검사한다. 저장 실패→입력 변경→새 미리보기→불명확 저장→reload 회귀를 추가했다. 저장 실패 mock은 auth scope가 아닌 `:studio-reuse-save` 키에만 적용하며 실제 쓰기 시도를 단언한다.
2. 같은 검토에서 **불명확 저장 재확인의401/403이 기록을 삭제하는 경로**를 발견했다. durable 저장은400/409 외 응답에서 기록/동일 요청/입력 잠금을 유지한다.400/409 정리 전에도 현재 로그인 scope를 재검사한다. 두 권한 오류 회귀로 입력 잠금과 기록/요청 불변을 확인했다. peer는 두 제품 수정에 잔여 구체 결함이 없다고 확인했고 테스트가 이전 잘못된 구현을 탐지하는 mutation도 확인했다. 전용 reviewer 역할 미제공으로 일반 역할/gpt-6-astra high의 read-only 검토였으며 독립 전체 검증으로 주장하지 않는다.
3. 실제 입력 복원에서 **초점 BODY 이탈**을 발견했다. 복구 후 전체 미리보기로 초점을 연결하고 다른 컨트롤에 이동한 이용자는 방해하지 않는다. 단위 RED1→GREEN9와 실제390px Tab/Enter 재검증을 수행했다. 후속 UI 재검증만503/400을 주입했고, 앞서 수행한 실제 API 재시작/실제400과 구분한다. `focus-ui-retest.json`에서 포커스·동일 입력·저장 비활성·기록0을 확인했다.

최초 장애 주입 준비 중 개발 서버 갱신이 개입해 사본29가 정상 저장됐다. 이를 응답 유실 성공으로 계산하지 않았고 별도 setup snapshot으로 구분했다. 해당 비공개 테스트 사본은 보존한다. 안정된 코드에서 다시 만든 실제 응답 유실 사본은30이다. 최초 lint의 unused import/빈 함수와 테스트의 잘못된 버튼 이름/상속 disabled 단언을 수정했다. 초기 실패 로그는 최종 통과 증빙에 합산하지 않는다.

## 검증·데이터 보존

선택 FE3파일40개 PASS와 최종 초점 회귀9개는 중복이며 합산하지 않는다. FE type·변경4파일 non-fixing lint·FE build PASS다. 새 의존성/BE 제품 변경은 없으며 이미 통과한 MySQL·일반 게시·AI·기존 전체 core는 재실행하지 않았다.

실제 commit 순증은 Metric4/Dashboard1/Widget·Dataset·관계 각5/StudioState·생성 영수증 각1이다. 기존 모든 비교 행은 불변이다. commit 후 동일 요청 확인·미전달/만료/입력 복구·새 미리보기까지 추적한12개 metadata 테이블의 내용은 동일하다. source/원본3·게시/개인 보기/삭제 영수증을 변경하지 않았다. 새 사본30은 source29의 비공개 로컬 증빙이며 신규 익명 게시0이다.

증빙 root의 `rr01-before.json`/`rr01-committed.json`/`rr01-confirmed.json`/`rr02-dropped.json`/`rr02-restored.json`/`metadata-final.json`은 **metadata 행 digest snapshot**이다. `metadata-comparison.json`, `rr01-response-loss.json`, `rr01-reload.json`, `rr02-ui-expired.json`, `rr02-ui-restored.json`, `focus-ui-retest.json`, `restored-layout.json`과 실행 로그를 대조했다. 이 기록은 원본 SQL/token을 포함하지 않는다.

- [390px 복구 안내](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-reuse-reload-recovery-20261019/recovery-390.png)
- [만료 안내·입력 복원 선택](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-reuse-reload-recovery-20261019/expired-390.png)
- [복원 입력과 키보드 포커스](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-reuse-reload-recovery-20261019/restored-focus-390.png)
- [복원 화면1440px](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-reuse-reload-recovery-20261019/restored-1440.png)
- [복구 사본의 모바일 Pivot 합계](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-reuse-reload-recovery-20261019/recovered-pivot-390.png)

실제 휴대폰/VoiceOver·공개 수신자/일반 복제의 reload 복구·실제 운영 MySQL/모든 경합·전체P5/TC005/기업16개 수용은 별도다. 타 로그인/탭에 자동 이관하지 않으며24h 만료 후 영구 보관함으로 사용하지 않는다.
