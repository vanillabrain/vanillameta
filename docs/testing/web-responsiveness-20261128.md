# VanillaMeta 웹 응답성 검증 · 2026-11-28

기준은 `2f3af4ab`이며 수정 빌드의 제품 변경은 `5dce80ff`다. macOS arm64와 Chrome 158을 사용했다. 브라우저를 1440×1000으로 고정하고 운영 모드로 빌드한 두 버전을 동일 주소에서 제공했다. 새 브라우저 컨텍스트와 같은 합성 데이터를 사용했다. API는 격리 Nest 런타임, 메타데이터는 SQLite, 필터 집계는 DuckDB였다.

## 측정과 결과

| 흐름 | 표본 수 · 빌드별 | 기준 중앙값 (최소~최대) | 수정 중앙값 (최소~최대) |
| --- | ---: | ---: | ---: |
| 아티팩트 허브 첫 검색 입력부터 결과 프레임까지 | 8 | 23.8 ms (18.9~31.0) | 21.6 ms (17.1~25.3) |
| Studio 첫 입력 시도부터 초안이 보이기까지 | 5 | 2161.5 ms (2146.0~2162.4) | 30.1 ms (28.7~32.2) |
| 차트·Pivot 공통 필터의 마지막 선택부터 결과 확인까지 | 5 | 682.6 ms (669.6~717.5) | 712.7 ms (670.0~814.1) |

Studio는 실제 화면에서 고정한 NDJSON 진행 메시지 22개를 수신했다. 이전에는 컴포저가 비활성화되어 첫 입력이 무시됐다. 기존 빌드에서는 스트림 종료 후 다시 입력했다. 수정 빌드는 5회 모두 스트리밍 중 입력을 표시했고 종료 뒤에도 초안을 보존했다. 한 실행 중 전송은 여전히 한 건이었다. 브라우저가 키 입력을 받아들인 시점부터 반영될 때까지의 중앙값은 19.3 ms와 22.9 ms였다. 체감 차이는 입력을 막고 있던 대기를 제거한 결과다.

허브는 검색 시 한 건이 화면에 표시된 사례다. 목록 DOM 재사용 실험에서 개선을 입증하지 못해 해당 변경을 제외했다. 필터는 합성 CSV 4행에서 A와 B를 연속 선택했다. 각 실행에서 마지막 선택 조건에 대한 차트와 Pivot 요청이 모두 성공했고 화면의 합계 340을 확인했다. 허브와 필터의 측정 범위가 겹쳐서 속도 개선이나 회귀를 판정하기는 어렵다.

## 코드 검사와 증빙

- `frontend-web`에서 `node --test scripts/check-use-effect.test.mjs`와 `node scripts/check-use-effect.mjs`를 실행했다. TypeScript 5.9.3으로 기존 327건을 확인했다. 임시 파일에 추가한 React 별칭 호출과 이름공간 호출은 실제 CLI에서 종료 코드 1을 반환했다. 테스트에서 승인 어댑터 파일과 기존 호출 수만 통과하는 것도 확인했다.
- 대상 프런트엔드 테스트는 99건 중 87건이 통과했다. Dashboard의 실패 12건은 기준 코드에서도 같은 이름으로 재현됐다. Studio와 ArtifactLibrary 단독 테스트는 통과했다.
- 원시 표본과 캡처는 로컬 `phase2-evidence/web-responsiveness-1128/`의 `summary.json`, `hub-pair.json`, `baseline/studio-trial-*.json`, `after/studio-trial-*.json` 및 양쪽 `filter.json`에 있다. 트레이싱은 표본 수집과 별도로 실행했다. `baseline/hub-trace.json`과 두 빌드의 `studio-trace.json`을 Chrome에서 열 수 있다. 기능 캡처는 `after/studio-stream.png`, `after/ego-hub-search.png`, `after/dashboard-pivot.png`에 있다.
- 실제 모델 응답과 OS 네이티브 한글 IME, PostgreSQL 배포 런타임, 대량 데이터 화면 경로는 이 실행에서 측정하지 않았다. GitHub Actions의 원격 실행은 미실행이며 동일 검사 명령을 로컬에서 실행했다.
