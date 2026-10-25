# 아티팩트 기본 도움말 재구성 — 2026-10-26

## 목적과 변경

처음 사용하는 사람이 데이터 기반 아티팩트 하나를 만들고 저장하도록 안내한다. 제품 화면의 이름은 대시보드, 편집기는 Studio임을 명시한다. 제품 기능·AI 모델·VoiceOver 설정은 변경하지 않는다.

- 기본 메뉴 5개: 이해하기 → 만들기 → 수정·저장 → 게시·공유 → 복제·재사용.
- 빠른 시작은 비용·마진 샘플의 합계·시계열 확인과 비공개 저장에서 끝낸다. site/quickstart.md는 기존 원문 include를 유지한다.
- 데이터·분석, 팀·관리자·MCP, 참고 항목은 기본 접힘으로 제공한다.
- 50개 시나리오는 학습 필수가 아닌 기능 사전으로 유지한다. 기존 페이지 경로와 scenario-1~50 앵커는 유지한다.
- 저장/게시·원본/사본, 공개 범위·권한, 계산 결과 확인에 필요한 설명을 보존한다. 여러 블록·조건 변경 상세는 접어서 읽도록 한다.

## 검증 결과

| 조건 | 결과 |
| --- | --- |
| 문서 production build | PASS, 로컬 Node26.12.1 |
| 전체 생성 HTML·링크·앵커·내부 경로 노출 검사 | PASS: 27 HTML, 1,522 local references, 오류0 |
| 홈 390/768/1440px | PASS: 가로 넘침0, 화면 캡처 확인 |
| 기본 안내5페이지 × 3폭 | PASS: 15조합, 가로 넘침0·완료된 이미지 로딩 중 깨짐0 |
| 단계별 다음 링크 | 이해→생성→편집→게시→재사용 연결, 재사용에서 종료 |
| 모바일 키보드 | 메뉴 Enter 열기, 수정 안내 링크 Enter 이동·메뉴 닫힘 확인 |
| 한국어 검색 | ‘아티팩트’ 검색으로 이해·생성 안내 노출, Escape 닫기 |

Ego 작업 공간69, 로컬 문서 프리뷰4176에서 실행했다. 제품 생성·저장·게시 기능은 기존 증빙을 재사용하며 재실행하지 않았다. 실휴대폰/VoiceOver/전체 키보드 접근성 완료로 확대하지 않는다. 첫 프리뷰는 sandbox EPERM으로 시작하지 못해 연결 거절이 있었고, 같은 공간에서 별도 프리뷰 실행 권한으로 복구했다.

## 증빙

외부 로컬 증빙 폴더: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/artifact-help-20261026/`

- home-390/768/1440.png, basics-390/768/1440.png
- menu-390.png, edit-390.png, search.png
- responsive.json, basics-responsive.json

## 배포 상태

로컬 문서 업데이트·검증 완료. 원격 확인 당시 develop에는 이번 문서와 별개인 미푸시 제품 커밋 1f02f3c5, c212fb93, ed2ec008가 있었다. 이를 문서 배포에 섞어 전송하지 않도록 이번 push·온라인 배포는 수행하지 않았다. 기존 온라인 사이트가 새 안내로 갱신됐다고 보고하지 않는다. 문서 외 .claude/settings.json·CLAUDE.md 변경은 포함하지 않는다.

### 배포 진행 승인 후

사용자가 배포 진행을 승인했다. 함께 전송될 Studio 수정안 안내 3개 커밋을 대조하고 관련 2개 파일 테스트15개, FE TypeScript·변경 제품 파일 lint·production build를 통과했다. 변경은 구조화된 수정 차이 안내이며 저장·AI 제공자 설정을 바꾸지 않는다. 제품 전체 E2E/실제 LLM/새 UI 검증은 이 배포 단계에서 반복하지 않았다. 문서의 기존 빌드·15개 폭별 페이지 조합 증빙은 그대로 재사용한다. 최종 온라인 결과는 배포 후 추가 기록한다.

### 온라인 배포 완료

- 배포 소스: b953eea043e97f9b0e3e854e924b358da3141088, drumcap으로 develop push.
- [User Guide 실행40213444125](https://github.com/vanillabrain/vanillameta/actions/runs/40213444125): Node24 build21초·deploy28초 모두 success. 기본/하위 경로 검사와 운영 URL 확인 통과.
- Ego70에서 https://docs.vanillameta.net/ 의 ‘내 데이터로 만드는 아티팩트’, quickstart의 기본5단계 메뉴와 다음 /ai-edit 연결을 실제 확인했다.
- 온라인1440/390px 캡처: production-home-1440.png, production-home-390.png. 모바일 가로 넘침0. 작업 공간 종료 완료.
- 제품 서버·운영DB 배포는 수행하지 않았다. 이전 보류는 해소되었으며 문서 사이트는 새 안내로 갱신됐다.
- CI의 action Node20 폐기 예정·git cleanup128 annotation은 남았으나 두 job과 운영 URL 검사는 성공했다. 이 문서 배포에서 CI 도구 버전 변경은 하지 않았다.
