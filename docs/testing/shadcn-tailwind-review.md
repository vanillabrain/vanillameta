# shadcn 전환·AI 저장 수정 커밋 전 리뷰

- 날짜: 2026-10-15 (Asia/Seoul)
- 워크트리: `/Users/drumcap/.codex/worktrees/shadcn-design-audit/vanillameta`
- 브랜치: `codex/shadcn-design-audit`, 기준 `e8f657fd3fee467315ff6e722c6f85004385f9ab`
- 범위: frontend-web 앱/공통 shadcn 소스/테스트/의존성, landing-page 전체, backend-api AI 단위·제목 지시·지표 연결 저장 수정, 관련 문서. 원본 병행 UC-013 변경은 포함하지 않는다.
- 최종 판정: **APPROVE**, 구조 **CLEAR**. 커밋을 막는 Critical/High 결함 없음. 아래 LOW·검증 한계는 별도다. 운영 merge/deploy 승인이 아니다.

## 독립 리뷰

| Lane           | 범위·확인                                                                                                                                                | 최종 결과 |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| A / Cicero     | 공통 UI34개·폼/색/날짜/표·shell/인증/공유. 범위105파일, 관련52개 및 타입/lint/별도 빌드 확인                                                             | APPROVE   |
| B / Kuhn       | Dashboard/Data/Explore/Commerce/Widget 및 차트/관련 테스트. 관련43파일781개와 타입 확인. 가장 큰4개 파일은 handler/ref/close 계약과 테스트 중심으로 확인 | APPROVE   |
| C / Planck     | AI 저장 소스·테스트, e2e/qa, 앱/랜딩 package/lock/CI, 문서. BE전체1450 및 FE전체880 재현                                                                 | APPROVE   |
| 구조 / Maxwell | UI 소스/엔진 경계, 저장 trust/CAS, 의존성과 랜딩 산출물·빌드 경계. Astra 대신 같은 독립 구조 검토를 critic 역할로 실행                                   | CLEAR     |

리뷰는 별도 native subagent가 읽기 전용으로 수행했다. 작성 lane은 발견을 재현·수정하고 최종 통합 검증을 소유했다. 모든 파일을 동일 깊이의 행별 검사로 읽었다고 확대하지 않는다.

## 발견·조치

- 랜딩 Vite dist에서 favicon/OG 이미지가 빠져 새 배포에서404가 될 수 있었다. 기존 파일을 `landing-page/public/`로 이동해 고정 경로로 출력하고 dist와 바이트·SHA256 일치를 확인했다. 배포 자체는 미실행이다.
- shadcn CLI가 실행 의존성에 있었다. 두 package에서 devDependencies로 이동하고 npm으로 lockfile을 갱신했다. 오프라인 갱신은 선택 플랫폼 패키지 캐시 누락으로 실패해 성공으로 세지 않았다. 정상 갱신 후 manifest/lock root와 shadcn entry.dev=true를 별도 검증했다.
- UC-003 과거 실패 fixture를 실제2블록 저장으로 바꾸고 의미 있는 보존 assertion을 강화했다. BE관련147개/전체1450개 PASS.
- 부하 중 SourceDetails의 기본1초 `record-A` 대기가 간헐 실패했다. 해당 케이스의5초 명시 대기로 조정했고 실제 완료 조건/포커스/버전 assertion은 유지했다. 관련174개 PASS. 무한 retry나 제품 오류 무시는 추가하지 않았다.
- QA `healthyPage`에서 사라진 MUI 로더 종료 검사를 실제 `[data-slot="spinner"]:visible` count0 검사로 복구했다. 타입과 lint 확인; 확장 QA전체는 실행하지 않았다.

## 검증

최종 통합 시 BE86 suites/1,450개, FE60파일/880개 모두 PASS. 루트/FE/랜딩 빌드 PASS, FE타입 PASS. 마지막 테스트-only 대기/QA assertion 보완은 SourceDetails174개·타입·해당 lint로 확인했다. 핵심 E2E8개+관련4개, Ego390/768/1440, 실제AI 질문→응답→미리보기→적용→저장→새로고침, Rill 수치 비교는 관련 코드가 달라지지 않아 [기존 검증](shadcn-tailwind-migration.md)의 고정 증빙을 재사용했다. 최종 의존성 분류 변경 뒤 FE/랜딩 빌드 및 설치 계획을 재확인했다.

증빙 원본: `/private/tmp/vm-shadcn-design-audit-20261015/review-*`. 지속 증빙은 `/Users/drumcap/.codex/visualizations/2026/10/15/01a13d02-c56c-79d1-999c-d26e799361eb/vanillameta-shadcn/`의 리뷰 로그와 화면 모음을 따른다.

## 비차단 후속 항목

- Pivot 숫자 열 헤더의 좌측 정렬과 최소 터치 높이, Explore 오류 알림의 수동 닫기, Share Switch의 소비자 크기 클래스보다 강한 primitive variant는 LOW UI 개선으로 남겼다. 기능·권한·숫자 실패는 확인되지 않았다.
- DataGrid는 외부 데이터 변경을 막는 복제 반환 계약이며 현재5개 소비자는 읽기 전용이다. Date/class cell 보존과 객체 identity 의존 callback은 후속 검토다.
- 사용되지 않는 공식 Sonner primitive/next-themes, 기존 번역 문자열 DOM id·일부 DialogDescription 경고는 LOW 정리/접근성 후속이다.
- 랜딩 manifest 링크는 원본부터 없던 파일을 가리킨다. 이번 전환 회귀와 구분하며 별도 정리한다.
- SQL 문자열이 바뀌면 의미상 같아도 지표 연결을 해제한다. 모호한 키 없는 다중 블록/소스·버전 불일치는 자동 추정하지 않는다. 완전한 링크 영속성을 보장한다고 보고하지 않는다.
- 랜딩은 앱의 shadcn 소스를 공유하므로 frontend-web 설치가 빌드 선행 조건이다. Jenkins에 이를 명시했다. devDependencies를 제외한 빌드는 지원하지 않는다.
- 전체 차트/드라이버/실기기 터치·운영DB·WCAG·배포는 미실행이다. 제품 전체 TC-005 수용 완료를 뜻하지 않는다.
