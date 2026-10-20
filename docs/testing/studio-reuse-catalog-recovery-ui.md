# Studio 소스 복제 — 대상 지표 변경 후 실제 화면 복구

2026-10-19 · 기준 `1dbd231f` · [선행 UI](studio-pivot-source-reuse.md) · [서버 동시 요청](studio-pivot-distinct-requests.md).

| ID | 이번 신규 실행 | 기대 | 상태 |
|---|---|---|---|
| SPR-UI-08 | 저장본3→기존 테스트 source29의18행 열 연결→미리보기 후 미사용 임시 대상 지표를 API로 생성→키보드 저장 | 실제 저장409·부분 자산0·미리보기/저장 시도만 해제·제목/소스/6열/단위·블록 선택 보존·명시 재미리보기 가능 | PASS_SELECTED |
| SPR-UI-09 | 오류 상태390/768/1440·키보드 재미리보기→비공개 저장→reload | 오류/재시도 포커스·버튼36px/모바일 입력16px·페이지 넘침0. 새 대상 지표/사본/영수증의 원자 저장·새ID/원본/기존 게시 보존. 독립 기존18행 정답5431.25USD/마진5.390840046029919% | PASS_SELECTED |

원본 테스트 dashboard3/source4·대상29는 이미 검증용 공개 합성 자료다. 대상 metric 생성은 테스트 상태 준비 API이며 실제 UI 조작으로 계산하지 않는다. 오류를 주입한 가짜409 대신 실제 catalog 변경/서버 거절을 사용한다. 임시 미사용 지표는 정확한 ID의 공개 삭제 서비스로 영향0을 확인한 뒤 비활성화하며 기존 지표/대시보드를 삭제하지 않는다. 새 복사본은 비공개 로컬 증빙으로 보존한다. 익명 게시·원본 편집은 하지 않는다.

제품 서버3460/4560·기존 로그인 테스트 계정을 재사용한다. 토큰/비밀번호를 출력하지 않는다. gpt-6-luna/VoiceOver BLOCKED는 유지하고 이번 직접 복제에서 LLM 호출은 없다. 이전 네트워크 오류/정상 저장/MySQL9개를 반복 수용으로 합산하지 않는다. native select 값 연결은 문서화된 selectOption을 사용하며 방향키만의 native 선택 수용으로 승격하지 않는다.

증빙 root: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-reuse-catalog-recovery-ui-20261019/`.


## 실제 실행·발견한 오류

Ego40·기존 로컬 테스트 로그인으로 실행했다. 인증 파일의 과거 token으로 시도한 소유 소스 읽기1회는401/쓰기0이었다. 이후 현재 로그인 탭의 기존 API 클라이언트로만 준비/정리를 수행했으며 token·비밀번호를 출력하거나 옮기지 않았다. 응답409는 실제 catalog 변경에 따른 서버 응답이다.

최초 미리보기 뒤 임시 미사용 지표47 생성→키보드 저장409에서 제목/소스/6열·단위/6블록 선택은 모두 보존됐고 비교 대상 metadata 내용도 불변이었다. 그러나 native disabled 저장 버튼에서 **포커스가 BODY로 빠졌다**. `conflict-initial-1800.png`와 `ui-after-conflict.json`이 수정 전 증거다. 처음 파일명390은 실제 viewport1800임을 이미지 확인 후 정정했다. Ego 호출마다 viewport가 초기화되므로 최종 단계는 매 호출에 명시390/768/1440을 적용했다.

`DashboardReuse/index.tsx`에 저장 시작의 포커스 출처를 확인하고 확정4xx 뒤 busy가 끝나면 ‘전체 미리보기’로 복귀하는 좁은 처리를 추가했다. 사용자가 다른 컨트롤/링크로 이동했다면 포커스를 빼앗지 않는다. 입력/권한/집계/저장·영수증 API나5xx 동일 요청 복구 계약은 변경하지 않았다. 자동 재미리보기/자동 저장0이다.

관련409 회귀에 포커스 단언을 추가해 **실패1/통과1/제외17**을 확인한 뒤 수정했다. 다른 링크로 이동한 이용자의 포커스 보존 회귀도 추가했다. 최종 선택은 **4 PASS / 15 제외**(4092개·기존 uncertain save·pending duplicate)이며 전체19개/기존 통과를 새로 합산하지 않는다. 최초 상대경로 fixture 준비 오류로 변경 전 기존409 검사만 실행된 로그는 `focus-before-test-change.log`이며 RED 증거가 아니다. 초기 eslint는 새 테스트 줄바꿈 형식1건으로 실패했고 Prettier 후 해당2파일 non-fixing lint PASS다. FE type와 FE build PASS(1.34초). BE/기존 core·전체 단위는 관련 BE 변경이 없어 재사용했다.

## 수정 후 사용자 흐름

1. HMR로 초기화된 개발 화면을 다시 준비하고390px에서 동일6열 연결/단위를 명시 확인했다. 임시47은 사용처0 확인/삭제 서비스로 비활성화했다. 새 미리보기 뒤 임시48 생성으로 실제409를 재현했다.
2. Enter 저장→실제409에서 제목/소스29/6열/단위/6블록 동일, preview 제거·저장 비활성/전체 미리보기 활성, 포커스 **BUTTON 전체 미리보기 / :focus-visible=true**, metadata 내용 불변이다. Tab은 footer, Shift+Tab은 같은 미리보기 버튼으로 복귀했다.
3. 오류 상태를390/768/1440에서 캡처했다. 페이지 overflow0, 실제 보이는 입력/소스/주요 버튼36px·390/768 입력16px/1440 입력14px다.768/1440 제목/소스 input top 차이0px다. 체크박스 자체16px를 일반 버튼36px로 보고하지 않는다. 닫힌 details의 숨은 입력은 최종 측정에서 제외했다. 초기 scroll offset이 남은 fullPage 캡처는 최종 scrollY0의 `conflict-final-*`로 대체한다.
4. 임시48도 실제 사용처0/삭제 확인 후 비활성화해 새 저장 사본의 catalog에 임시 지표를 남기지 않았다. **새 미리보기는 metadata 쓰기0**이고6블록·신규 지표4개·Pivot5431.25USD/마진5.390840046029919%다. 이전18행 독립 Decimal/Rill 정답을 재사용하며 신규 Rill 실행은 없다.
5. Enter 재미리보기→Tab으로 저장 버튼 가시 포커스→Enter 저장201→**새 비공개 dashboard28/source29** Studio→reload를 실제 확인했다. 두 실패 요청을 저장 성공으로 계산하지 않는다. 저장 후 지표49~52/새6블록 ID·순서/xs/md/lg 배치를 보존했다. 사본 저장의 순증은 Metric4/Dashboard1/Widget·Dataset·관계 각각5/StudioState·생성 영수증 각각1이다. 기존 모든 비교 행·원본3·개인 보기·게시 행은 불변이고 shareYn=N(별도 dashboard_share 관계 조회)이다. reload 추가 metadata 쓰기0이다.
6. 저장/reload 화면도390/768/1440 overflow0, 주요 저장/게시36px·Studio 도구32px를 확인했다.390px 실제 Pivot 표의 전체 합계5431.25USD/5.39%·358px 블록·Compute/Storage·두 고객 표시를 확인했다. 넓은 표는 내부 스크롤이며 실기기/전체 native 키보드 수용으로 확대하지 않는다.

## 증빙·종료

증빙 root의 `manifest.json`, `before*.json`/`after*.json` metadata 행 digest, `ui-before-conflict.json`/`ui-after-conflict.json`, `ui-fixed-before-conflict.json`/`ui-fixed-after-conflict.json`, `error-keyboard.json`, `conflict-layout-final.json`, `fresh-preview.json`, `saved-navigation.json`, `persistence-checks.json`, `saved28-layout.json`, `saved28-pivot-ui.json`/`saved28-pivot-keyboard.json`을 대조했다. `temporary-metric*.json`은 정확한 준비 ID/사용처0/비활성화 확인이며 삭제 영수증2개는 과거 사건으로 보존한다. 임시47/48의 준비2행+논리 삭제를 복제 지표 증가4개와 혼합하지 않는다.

- [모바일 오류·가시 포커스](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-reuse-catalog-recovery-ui-20261019/conflict-final-390.png)
- [데스크톱 오류/입력 보존](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-reuse-catalog-recovery-ui-20261019/conflict-final-1440.png)
- [저장 후 모바일 Pivot 전체 합계](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-reuse-catalog-recovery-ui-20261019/saved28-pivot-total-390.png)
- [새 저장본](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-reuse-catalog-recovery-ui-20261019/saved28-1440.png)

모두 **실제 제품 화면**이며 별도 테스트 결과 리포트가 아니다. 대표 캡처를 직접 열어 확인했다. 새 비공개28을 검증 증빙으로 보존하며 새 익명 링크/게시·원본 수정은 없다. gpt-6-luna/VoiceOver BLOCKED 유지다. 이번은 대상 catalog 변경 한 가지의 실제 UI 복구이며 파일 교체/권한 회수 모든 변형·실제 휴대폰·운영 MySQL UI/전체 P5·TC005/기업16개 수용은 미완료다.


모바일 전체 합계가 처음에는 내부 스크롤 밖에 있어 새 사본 표에 실제 포커스를 두고 End로 마지막 열까지 이동했다. scrollLeft292/client332/전체624px·가시 포커스 true·페이지 overflow0이며 전체 합계5431.25USD/5.39%가 보이는 `saved28-pivot-total-390.png`를 최종 수치 화면으로 사용한다. 기존 표 키보드 전체 조건을 새로 통과했다고 합산하지 않는다.


소유자 Studio 혼합 복제의 새로고침 후 동일 요청 확인·서버 재시작/만료 입력 복구 후속은 [SPR-RR 증빙](studio-reuse-reload-recovery.md)을 따른다. 기존 catalog409 검증을 새로 반복 합산하지 않는다.
