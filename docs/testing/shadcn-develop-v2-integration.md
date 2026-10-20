# shadcn branch / develop-v2 통합 검증

2026-10-15, PR #440. 작업 브랜치 `codex/shadcn-design-audit`의 `31b3c14c`에 `develop-v2`의 `03d226d7`을 통합했다. 대상 브랜치에 PR을 병합하거나 배포하지 않는다.

## 충돌 해결

- DashboardAnalysis: 최신 develop-v2의 MUI 밀도 보정은 shadcn 공통 크기·Tailwind 간격으로 유지한다. MUI 의존성을 되돌리지 않는다.
- DashboardEdit: 자동 의도·대상 후보·일괄 변경 요약·저장 복구/불확실 상태·명시 저장 경로를 모두 유지하고 새 UI를 shadcn 컴포넌트로 표현한다. 테스트 mock을 className 계약으로 갱신했다.
- DashboardView: shadcn 컨트롤과 최신 게시 버전 진입을 함께 유지한다.
- 신규 Publication 화면: 기존 요청·상태·만료·미리보기·게시/중지 계약을 보존하며 MUI 대신 Button/Card/Notice/TextField와 Tailwind 반응형 블록 배치를 사용한다. 오래된 MUI mock을 제거했다.
- AI 서버: 양쪽의 표시 단위·지표 연결 보존 및 자동 대상/일괄 편집 로직이 유지됨을 독립 검토했다. 명시적 제목 변경 지시와 저장 지표 원제목 검증이 모순되던 경로를 보완했다. 기본 이름 보존·단일 대상·다른 블록 보존은 유지하며 기존 BR-016-02 명시 이름 판정을 공유한다.

## 검증

- FE 전체: 64파일 962개 PASS. 충돌 편집기/라인 관련 116개, 게시 화면 12개 PASS.
- FE 타입 PASS, lint 오류0 / 기존 경고22. FE/BE 최종 build PASS.
- BE AI/BI: 44 suites 1130개 PASS. 이후 명시 이름 변경 보완의 saved-metric-reference37 / bi-editor76 / ai-dashboard58개 PASS.
- 핵심 E2E: fixture 환경 수정 후 8개 경로 모두 통과 확인. 최초 격리 서버의 JWT·CORS·암호화 키·관리 경로 표기 불일치로 발생한 실패는 제품 통과로 세지 않고 재실행했다.
- Ego 실제 UI: 편집기1440/390, 게시 미리보기1440/390, 데이터390 확인. 게시390 가로 넘침 없음, 데이터390 푸터 상단950px까지 내용 영역 유지. AI 수동 모드 선택 확인. 게시 버튼은 실행하지 않았다.

증빙: 채팅에 첨부된 외부 `vanillameta-shadcn/layout-correction/merge-*.png`, 임시 검증 로그 `merge-*.log`. 스크린샷에 토큰/비밀번호를 포함하지 않는다.

## 한계

실제 LLM을 통한 새 일괄 편집·운영 DB·실기기 터치·전체 차트 종류/다크모드 조합은 이번 통합에서 재실행하지 않았다. 이름 변경 보완의 LLM 응답은 mock 회귀로 검증했다. 원본 작업 서버/DB는 보존하고 복제 메타데이터 DB와 별도3297/4297 서버를 사용했다.
