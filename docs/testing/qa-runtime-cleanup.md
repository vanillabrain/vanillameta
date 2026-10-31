# TC050 검증 런타임 종료 오류 복구

2026-10-23 · develop `37fb21de` 후속 · [계획](../plans/TC-050-runtime-cleanup.md)

## 이전 CI

`37fb21de859805c93e14c7d75248abd4159a1521`의 CI39806544068은 backend/frontend 모두 success로 완료했다. MCP Server39806544197 및 User Guide39806544202도 success다. 이전 응답의 CI 진행 중 상태를 이 결과로 대체한다.

## 재현과 원인

격리 `--probe-child-drain` 반복 중 관측한 순서는 `check(-pgid,0) EPERM → 이후 그룹 소멸 → matching drained/groups0 → 거절`이었다. 원래 관측기는 그룹 조회와 IPC 전송 오류를 같은 catch로 처리해 unverifiable을 보냈다. 부모의 failed가 영구적으로 켜져 이후 정상 소멸 증명과 모든 재시도를 거절했다. 유료 AI 호출 없이 실제 Node 자식/손자에서 재현했다. 로그 추가 후 통과한 초기 두 실행만으로 해결을 선언하지 않았고 반복에서 EPERM 코드를 포착했다.

## 수정

- 관측기를 `scripts/lib/qa-child-drain.cjs`로 분리해 실제 supervisor와 회귀 테스트가 동일 코드를 실행한다.
- 그룹 조회 오류는 check-error/제한된 코드로 구분하며 소유 그룹을 유지하고 재조회한다. ESRCH 이외의 오류를 소멸로 취급하지 않는다.
- IPC/증명 전송 오류는 동기·비동기 모두 fatal이다. 실패 플래그를 초기화하거나 불명 그룹을 버리지 않는다. 모든 proof callback 완료·소유 그룹0·현재 요청의 drained가 필요하다.
- disconnect/조기 종료/timeout/다른 요청은 정리를 허용하지 않는다. timeout 뒤 늦은 전송 오류는 원래 attempt 객체에 묶어 새 drain을 거절하거나 undefined를 참조하지 못한다. 동기 send 예외도 같은 정리 hook에서 timer/pending을 해제한다.
- 새 검증에 QA_API_PORT/QA_WEB_PORT/QA_CONTROL_PORT를 선택할 수 있다. 기본값4250/3250/4450은 유지한다. 별도 포트는 별도 runtime-<control> 포인터를 사용해 보존 중인 실행의 소유 정보를 덮어쓰지 않는다. FE 준비 조회도 실제 선택한 주소를 사용한다.
- health에는 자식 관측 ready/failed/drained·그룹 수·비밀 없는 오류 코드만 추가한다. PID 탐색·임의 종료 API를 추가하지 않는다.
- GitHub Actions `QA Runtime`에 의존성/로그인/Docker 없는 Node24 회귀 테스트를 추가했다.

## 검증

최초 결함 코드로 일시/지속 EPERM 복구 회귀가 실패(2 FAIL/2 PASS)했다. 최종 Node24 회귀8개가 통과했다. 실제 자식의 일시·지속 조회 실패, 동기/비동기 proof 전송 실패, 부모 disconnect, 잘못된 요청, 늦은 콜백, 동기 send 예외를 포함한다. 늦은 콜백도 수정 전 별도 FAIL을 확인했다. 실제 자식/손자 probe는 새 spawn 차단·leader보다 오래 사는 손자 대기·제한시간 거절·그룹 소멸·정리를 통과했다. 새 유료 모델 호출은0이다.

별도 Docker MySQL8.4.11/Nest/Vite4251/3251/4451에서 두 차례 lifecycle을 확인했으며 합산 완료 건수로 쓰지 않는다. 최종 실행은 다음과 같다.

- API/control 및 실제3251웹 health200.
- 인증 없는 stop403이며 런타임은 유지.
- 인증 restart200/새 API PID, 전용 probe 테이블 행 보존.
- 인증 stop200, 소유 label의 컨테이너0·임시 runRoot/인증 파일 제거·runtime status=stopped·영속 volume0.
- 원래 runtime.json bytes와 기존3250/4250/4450/3698/9009 포트의 리스닝 PID 집합 불변. 부재 포트의 lsof 종료1과 실제 오류를 구분했다.

최종 전용 실행의 `cleanup-results.json`과 supervisor 로그는 Git 제외 evidence에 보관했다. 별도 debugger 재검토는 초기 두 지적(대체 포트 준비 주소/늦은 callback)을 수정한 후 추가 blocker0이었다. 본 검증의 MySQL 결과와 리뷰어의 모의 검사 결과를 구분한다.

## 기존 구버전 환경의 잔여 제한

원래 supervisor11506/API11666/FE11667에는 수정 전 코드와 실패 상태가 이미 메모리에 있다. 기존 control API는 내부 소유 그룹 이력을 외부로 제공하거나 실패 상태를 안전하게 복구하는 기능이 없다. 파일 변경이나 stop 반복으로 이를 소급 교체할 수 없다. 이 환경의 삭제·정리 완료를 주장하지 않는다. 기존 API·웹·Docker·런타임 소유 증빙은 보존했다. 다른 Electron이 사용하는9229 포트도 변경하지 않았다.

이번에 만든 실패 재현용 no-AI probe2개만 별도로 정리했다. 고정 probe 명령·부모/그룹 ID·임시 owner 표식·전체 cwd census에서 해당 fixture만 사용하는 폴더임을 대조했다. 이 증명은 고정된 no-AI probe에만 적용되며 원래 AI 앱의 미상 자식 이력을 대체하지 않는다.

구버전 환경은 별도 소유·transport 재조정 전까지 보존 대상이다. 원본 환경/불명 프로세스를 강제 종료하거나 전체 Docker prune으로 우회하지 않는다. 수정본으로 시작한 새 환경의 정상 정리와 구버전 자원의 보존 상태를 구분한다.

## 재현

```sh
node --test scripts/test/qa-child-drain.test.cjs
node scripts/qa-enterprise-postgres.cjs --probe-child-drain
QA_API_PORT=4251 QA_WEB_PORT=3251 QA_CONTROL_PORT=4451 node scripts/qa-enterprise-postgres.cjs
```

새 런타임의 private runtime.json에서 자신의 control URL/token을 사용한다. token/config 내용은 문서·로그·명령 인자로 출력하지 않는다. 해당 실행의 인증된 restart/stop 이후 cleanup 이벤트와 컨테이너·파일 부재를 대조한다. 이미 실행 중인 프로세스의 코드가 자동 갱신된다고 가정하지 않는다.

## 새 CI에서 발견한 시각 경합 후속

수정 커밋8a800bcb의 QA Runtime39824697709는 success였으나 전체 CI39824697629의 FE 단위 테스트가 `studioCreationRecovery`의 future 항목에서 실패했다(203파일/3301 PASS·1 FAIL). 원래 테스트는 Date.now()+60001로 레코드를 만든 뒤 실제 시계로 다시 읽어,1ms 이상 지연되면 제품의60초 clock-skew 허용 범위 안으로 들어갔다. 제품 판정 오류로 바꾸거나 허용 범위를 늘리지 않았다. 레코드/조회에 동일 captured now를 사용하고 미래60000/60001ms·만료TTL-1/TTL의 정확 경계4개를 추가했다. 최초 원본 로컬 재실행 통과만으로 CI 실패를 무시하지 않고 결정적인 시각 입력으로 고쳤다. 최종 후속 SHA의 CI 결과는 별도로 확인한다.
