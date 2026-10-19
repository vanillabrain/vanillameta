# UX-002 화면 간 분석 기준

기준: develop-v2 cd527547 + 이번 diff. 기존 숫자·저장·게시·복제 PASS는 재사용하며 변경한 표시와 전환만 검증한다. gpt-6-luna 유지 / VoiceOver BLOCKED.

| ID | 행동 | 기대 | 상태 |
|---|---|---|---|
| UXB-01 | 첫 화면 미선택→샘플 선택→생성안 | 데이터·기간·필터·지표 순서 동일, 생성 전 지표를 확정으로 표시하지 않음 | PASS_SELECTED |
| UXB-02 | Explore 소스/기간/필터/지표 선택 | 현재 선택 기준, 결과 대기/오류와 확정 결과를 구별, 새 조회 추가 없음 | PASS_SELECTED |
| UXB-03 | Studio 열기·편집 | 현재 문서 기준·저장 상태와 별도 블록 조건 구분, 기존 숫자 유지 | PASS_SELECTED |
| UXB-04 | 게시 설정·게시본 읽기 | 저장 기준/게시 시점 구별, 초안과 기존 게시본 혼합0·원본/SQL 노출0 | PASS_SELECTED |
| UXB-05 | 소유 저장본·게시본 복제 미리보기 | 대상 데이터/매핑 후 기간·조건·지표 기준, 미확인을 전체 범위로 추측0 | PASS_SELECTED |
| UXB-06 | 대표390/768/1440·긴 이름, Tab/Enter/Space/Escape | 문서 넘침0, 읽기 순서 유지·상세 펼침·가시 초점·모달 복귀, 조작 추가 쓰기0 | PASS_SELECTED |

실제 브라우저 입력/기대 정답/스크린샷과 선택 단위·type/lint/build 결과는 실행 후 추가한다. 새로운 LLM 비교·숫자/권한 전체 회귀·실제 휴대폰은 이 표시 변경의 통과 범위가 아니다.

## 결과 — 2026-10-19 / Ego44

[설계](../plans/UX-002-analysis-basis.md)에 따라 공통 `AnalysisBasis`의 데이터 / 기간 / 필터 / 지표 기준 순서, 상태 배지, 전체 내용을 읽는 native details를 첫 생성·지표 빌더·Explore·Studio·게시 설정/게시본·두 복제 미리보기에 연결했다. 최초 목록은 아직 데이터가 선택되지 않은 화면이므로 가짜 현재 기준을 만들지 않고 같은 작업 순서와 Studio 진입을 안내한다.

### 실행 범위와 실제 기준

- 기존 API4560/웹3460에서 이번 전용 로컬 계정의 비용·마진 샘플 source32를 선택했다. 실제 기존 Codex/gpt-6-luna로 총매출·마진·day 추세3블록을 제안받아 비공개 dashboard32에 저장했다. 생성 결과14937.49USD/17.79%는 기존 공개 합성 CSV 정답과 일치했다. 새로운 Rill/AI 품질 비교 전체를 반복한 것은 아니다.
- 이후 metadata 복사본의 API4562/웹3462로 표시 검증을 격리했다. 복사 DB의 과거 대기 파일/export/대화 작업은 실행 대상에서 제외했다. 기존 서버/원본 파일을 초기화하거나 종료하지 않았다. 이 복사본에서만 dashboard32의 기간을2025-01-06~10 UTC, company를Hanul Foods로 바꾸고 저장/reload했다.
- **UXB-01:** 목록의 질문으로 만들기 버튼을 focus→Enter로 실행했다. 데이터 미선택/연결됨/생성안 저장 전을 구분했다. 최종 첫 생성 화면은 source32 연결 상태와 미확정 지표를 표시하며390/768/1440 및 새 상세 Enter/Space/Tab을 확인했다. 지표 빌더는 저장 지표61 선택 뒤 `총매출 · SUM · USD`를 같은 순서로 표시했다.
- **UXB-02:** 미완성 사용자 지정 기간은 `입력 기준 · 확인 필요 / 기간 입력 확인 필요`이며 전체 기간이라고 표시하지 않는다. 완성한 기간·Hanul Foods를 적용한 Explore가 Studio/소유 저장본 복제의 첫 세 기준과 정확히 일치했다(`summary-checks.json`). 조회 응답의 measureVersions만 결과 버전으로 읽고 아직 확인되지 않은 버전은 별도로 표시한다. 날짜 준비는 네이티브 필드 이벤트 보정, 필터 체크·적용은 실제 Space/Enter다. 모든 날짜 선택창 키보드 회귀를 새로 실행했다고 보고하지 않는다.
- **UXB-03:** Studio 초안 기준과 저장 후 재조회 기준을 확인했다. 블록의 고정 지표 참조61/62 v1을 읽으며 최신 지표를 추가 조회하지 않는다. 공통 범위와 Pivot의 블록별 추가 범위가 같다고 설명하지 않는다.
- **UXB-04:** 미저장 기간·필터 변경 중 게시 설정에는 이전 저장본의 전체 기간/필터 없음이 표시되고 경고·게시 차단이 유지됐다. 저장 후 게시 준비에는 새 저장 기준이 표시되지만 실제 기존 비공개 게시V1은 전체 기간/필터 없음·14937.49USD/17.79%를 유지했다. 재게시/공개 전환은 실행하지 않았다. 게시 화면은 기존 안전한 집계 응답만 사용하며 원본 source ID/SQL/현재 지표 정의를 추가 공개하지 않는다.
- **UXB-05:** 게시V1의 본인 source32 재사용 미리보기는 전체 기간/필터 없음이다. 소유 저장본의 미리보기는 저장된2025-01-06~10/Hanul Foods이다. 독립 Python Decimal 계산의2행·매출2000.00USD/이익100.00USD/마진5%와 화면이 일치했다. 일반·혼합 Pivot 복제 응답은 실제 확인한 대상 이름/기간/필터를 표시 전용으로 반환하며, 구 응답의 미제공 기준을 무조건 전체 기간/필터 없음으로 추측하지 않는다. 이번에는 복사본 저장을 추가 실행하지 않았고 기존 저장·복제 회귀를 재사용한다. 실제 혼합 Pivot의 신규 UI 전체 여정은 이전 증빙을 재사용하며 이번 FE 렌더/BE DuckDB 선택 검사와 구분한다.
- **UXB-06:** 첫 생성·빌더·Explore·Studio·게시본·게시본 재사용·소유 저장본 복제의7영역 ×390/768/1440에서 필드 순서 동일·안정 후 문서 가로 넘침0·본문/제목14px·같은 행 top 차이0을 확인했다. 컨테이너가 넓을 때4열, 모바일/좁은 게시 모달은2열이다. 상세 조작부는390px에서44px/나머지32px이며 Enter 열기→Space 닫기→Tab 다음 요소·가시 초점과 API 추가 요청0이다. 게시 모달 Escape 후 게시·공유 버튼으로 초점을 복구했다.

### 발견·수정·재확인

1. 최초 공통 안내가 첫 화면을 많이 밀어내어 설명을 자세히 보기 안으로 옮겼다. 부모 화면의h2 크기 규칙에 끌려가지 않도록 이름 있는 heading을 국소14px로 유지했다. 같은 컴포넌트가 좁은 모달에서4열이 되지 않도록 화면 폭 대신 컨테이너 폭으로 반응한다. 모바일의 상세 버튼은44px로 통일하고 펼침 아이콘을 추가했다.
2. 기존 복제 응답/테스트에서 `unmappedFilters`가 생략되면 새 표시가 예외를 던졌다. optional 필드와 필요한 매핑의 미확인 상태를 구분해 수정했고 해당 Remix11개를 재검증했다. 일반 차트 복제의 별도 응답 경로에도 공통 기준을 연결했다.
3. Explore에서 Seoul 사용자 지정 기간을 전체 기간으로 바꾸면 쿼리에 시간대를 보내지 않는 기존 동작과 새 표시가 달라질 수 있었다. 전체 기간의 기본UTC/고급 Pivot의 명시 시간축을 읽도록 표시만 보완했다. 기존 payload 회귀에 실제 기준 표시를 추가해 선택1개 PASS다.
4. 긴 이름은 저장 자료를 바꾸지 않고 DOM에280자를 주입해390px 전체 내용/줄바꿈·넘침0·다음 영역과20px 간격을 확인하고 원복했다. 이는 실제 긴 catalog 저장/서버 검증이 아니다.
5. 모달 크기 변경 직후에는 배경 차트 resize/전환 중 일시적인 측정값이 있었다. 안정된 재검사에서 문서 넘침0이며1440/768/390의 모달 푸터 하단은919.5/984/828px로 각1000/1000/844px 화면 안이다. 즉시 측정값을 안정 상태 PASS로 사용하지 않는다. 소유 복제 캡처는 고정 헤더가 제목을 덮지 않는 위치로 보정했다.

### 선택 검사

- 최종 FE6파일47 PASS(공통 표시/고정 참조/복제 응답·화면/게시 저장 기준). 별도 빌더 영향21 PASS와 중복을 합산하지 않는다.
- 영향 UI5파일175개 배치는 초기 Remix8FAIL을 포함했다. 수정 후 그 파일11 PASS; 다른4파일164 PASS는 재사용했다. 전체 배치가 처음부터 통과했다고 기록하지 않는다. 기간·시간대 표시 선택1 PASS(나머지60 SKIP).
- BE 실제 DuckDB 혼합 미리보기3 PASS, 일반 복제 기준의 쓰기 없는 투영1 PASS(같은 파일22개 미선택). 전체 MySQL/기존 복제 저장을 반복하지 않았다.
- FE type·변경 파일 non-fixing lint·FE build, BE 변경 파일 lint·BE build PASS. 단계별/겹친 배치는 전체 완료 수로 환산하지 않는다.

### 증빙

외부 root: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/analysis-basis-ux-20261019/`. `summary-checks.json`, 각 화면의 `*-checks.json`, `studio-draft-vs-saved.json`, `oracle.json`, `publish-dialog-settled.json`과 캡처를 대조했다. JSON의 실제 viewport 측정을 우선하며 초기 프레이밍/전환 중 측정과 최종 캡처를 구별한다.

- [Studio390](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/analysis-basis-ux-20261019/studio-390.png) · [1440](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/analysis-basis-ux-20261019/studio-1440.png)
- [Explore390](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/analysis-basis-ux-20261019/explore-390.png) · [1440](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/analysis-basis-ux-20261019/explore-1440.png)
- [첫 생성390](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/analysis-basis-ux-20261019/create-390.png) · [빌더390](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/analysis-basis-ux-20261019/builder-390.png)
- [게시본1440](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/analysis-basis-ux-20261019/published-1440.png) · [게시 설정390](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/analysis-basis-ux-20261019/publish-dialog-390.png)
- [저장본 복제390](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/analysis-basis-ux-20261019/owner-reuse-390.png) · [게시본 복제390](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/analysis-basis-ux-20261019/remix-390.png)

gpt-6-luna·VoiceOver BLOCKED 유지. 이번 변경은 기준의 공통 표시이며 필터 자동 전파·계산/저장/권한 정책 변경이 아니다. 실휴대폰·운영 MySQL·전체 보안 역할 행렬·실고객/기업16개 수용은 NOT_RUN/Open으로 남긴다.

검증 종료 후 Ego44와 이번 전용 API4562/웹3462를 정리하고 임시 생성 인증정보 파일을 삭제했다. 원래 API4560/웹3460은 유지했다. 격리 서버의 초기 CORS origin 누락은 실행 환경 설정 실패였으며, 명시한 로컬 origin으로 재기동해 정상 로그인 후 검증했다. 이 환경 보정을 제품 코드 수정으로 집계하지 않는다.
