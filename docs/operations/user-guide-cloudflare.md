# 사용자 가이드 Cloudflare Pages 배포

## 배포 구조와 현재 상태

Cloudflare Pages Direct Upload + GitHub Actions로 정적 가이드를 배포한다. 제품 API/데이터 서버와 별개이며 `.vitepress/dist/`만 업로드한다. 서브도메인 배포에는 기본 `VM_DOCS_BASE=/`를 사용한다.

워크플로우는 `.github/workflows/user-guide.yml`이다. main/develop 변경과 PR에서 빌드·링크 검사하고, **develop만 운영 배포**한다. 운영 브랜치를 바꿀 때는 업로드/배포 조건·명령의 branch와 Pages production branch를 함께 바꾼다.

사용자가 지정한 운영 도메인은 `docs.vanillameta.net`이다. 현재 Pages 프로젝트·Secret·도메인 연결은 확인되지 않았으며 배포는 비활성이다. 구성 파일·로컬 검증과 실제 업로드·DNS·TLS 성공을 구분한다.

## 1. Pages 프로젝트 준비

Cloudflare의 **Workers & Pages → Pages → Direct Upload**로 프로젝트를 준비한다. Git 연동과 Actions 업로드를 중복 구성하지 않는다. 프로젝트 이름 예시는 `vanillameta-docs`이며 실제 이름을 GitHub 변수에 등록한다. Production branch는 **develop**으로 설정한다.

인증을 완료한 운영자 환경에서 CLI 생성도 가능하다. 이미 있는 프로젝트에는 새 생성 명령을 반복하지 않는다.

```bash
npx wrangler@4.151.3 pages project create vanillameta-docs --production-branch=develop
```

Production branch가 다르면 업로드가 운영 대신 preview 배포가 될 수 있다.

## 2. GitHub 설정

저장소 **Settings → Secrets and variables → Actions**에 등록한다. 토큰은 채팅·문서·소스에 넣지 않는다.

| 종류     | 이름                       | 값                                        |
| -------- | -------------------------- | ----------------------------------------- |
| Secret   | `CLOUDFLARE_API_TOKEN`     | 대상 계정 Pages 편집 토큰                 |
| Secret   | `CLOUDFLARE_ACCOUNT_ID`    | 대상 계정 ID                              |
| Variable | `CLOUDFLARE_PAGES_PROJECT` | 실제 프로젝트 이름                        |
| Variable | `DOCS_DEPLOY_ENABLED`      | 준비 후 `true`, 자동 배포 중지 시 `false` |

토큰은 대상 계정의 **Account → Cloudflare Pages → Edit** 권한으로 발급한다. 이 workflow는 DNS를 수정하지 않으므로 DNS 권한을 추가할 필요가 없다. 계정 정책에 따른 토큰 범위·만료를 설정한다.

활성화 변수와 프로젝트 이름은 repository 범위로 등록한다. Secret은 repository 또는 `docs-production` Environment 범위를 사용할 수 있다. 해당 Environment에 승인·브랜치 제한을 설정하면 그 정책도 적용된다.

## 3. 배포 실행

1. 계정·프로젝트·production branch를 확인한다.
2. Secret·변수를 등록하고 `DOCS_DEPLOY_ENABLED=true`로 설정한다.
3. Actions의 **User Guide → Run workflow → develop**을 실행하거나 develop의 사용자 문서를 변경·푸시한다.
4. build와 deploy의 성공을 각각 확인한다. 업로드 후 기본 배포 URL의 홈·`/scope` HTTP 검사도 자동 실행한다.
5. deploy Environment URL을 연다.

빌드는 Node 24로 실행하며 기본·하위 경로의 링크를 검사한다. 기본 경로 결과물을 artifact로 전달해 배포 단계에서 다른 소스를 다시 빌드하지 않는다. PR/main에서는 운영 업로드하지 않으며 production 배포는 직렬 실행한다.

활성화 변수를 false로 바꿔도 기존 사이트는 유지된다. 사이트 공개 중지·프로젝트 삭제와 구분한다.

## 4. docs 도메인 연결

정확한 주소를 정한 뒤 **Pages 프로젝트 → Custom domains → Set up a domain**에서 먼저 등록한다. 운영 주소: `docs.vanillameta.net`.

Cloudflare DNS라면 안내된 자동 레코드를 확인한다. Route 53 등 외부 DNS를 유지할 경우 안내된 실제 Pages 호스트로 CNAME을 등록한다.

| 종류  | 이름 | 대상                                                  |
| ----- | ---- | ----------------------------------------------------- |
| CNAME | docs | 생성한 실제 Pages 프로젝트의 `프로젝트이름.pages.dev` |

CNAME만 만들고 Pages Custom domains 등록을 생략하지 않는다. 기존 docs 레코드가 있다면 사용 중인 서비스를 확인하고 덮어쓰지 않는다. 서브도메인은 네임서버 전체를 Cloudflare로 이전할 필요가 없다.

도메인·인증서 상태가 활성화된 뒤 HTTPS를 확인한다. CAA 등 기존 인증서 제한으로 실패하면 상태 안내를 확인한다. 배포 토큰으로 DNS를 자동 수정하지 않는다.

## 5. 온라인 완료 확인

- 홈과 `/scope` 직접 진입·새로고침
- 한국어 검색·메뉴·목차 이동
- 빠른 시작 캡처 5개·화면 모음 16개
- 390/768/1440px 대표 화면
- 제거한 외부 제품 참고 정보가 본문·검색에 없는지 확인
- 내부 설계·검증 문서 경로 비노출
- docs 도메인과 HTTPS 인증서 일치

Pages는 `.html` 확장자를 생략한 경로를 제공하므로 현재 cleanUrls 설정을 유지한다. 없는 주소를 홈으로 일괄 반환하는 SPA redirect는 추가하지 않으며 `404.html`을 유지한다.

## 되돌리기

Pages의 이전 정상 배포로 rollback하고 직접 경로·도메인을 확인한다. 소스도 수정하고 필요하면 `DOCS_DEPLOY_ENABLED=false`로 다음 배포를 중지한다. 프로젝트·도메인·DNS 삭제는 별도 요청으로 처리한다.

## 공식 참고

- [Actions Direct Upload](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)
- [커스텀 도메인](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [정적 경로](https://developers.cloudflare.com/pages/configuration/serving-pages/)
- [Wrangler Action](https://github.com/cloudflare/wrangler-action)

## 이번 구성 검증

2026-10-21 develop 기준으로 actionlint 1.7.12(배포 YAML 문법·표현식, shellcheck 별도 미실행), 문서 production build, HTML 21개·내부 참조 843건 검사를 통과했다. GitHub repository 변수·Secret 이름 조회는 모두 빈 목록이었다. 계정·토큰·프로젝트·도메인·DNS가 준비되지 않아 실제 Cloudflare 업로드·HTTPS/온라인 화면 검증은 미실행이다. 배포 완료로 표시하지 않는다.

## 도메인 연결 준비 확인 — 2026-10-21

- 지정 주소: `docs.vanillameta.net`.
- 공개 NS 조회: `vanillameta.net`은 Cloudflare 네임서버를 사용한다. 새 네임서버 이전은 필요하지 않다.
- A·AAAA 조회와 권한 서버 CNAME 조회: `docs.vanillameta.net`은 NXDOMAIN이었다. 현재 공개 레코드는 확인되지 않았다. 실제 등록 직전에도 다시 조회한다.
- Ego의 Cloudflare 대시보드는 로그인 화면이었다. 로그인된 계정의 zone 권한·기존 Pages 프로젝트·DNS 설정은 아직 확인하지 않았다.
- 다음: 사용자 직접 로그인 → 대상 계정/zone 확인 → 기존 프로젝트 확인 또는 신규 준비 → Secret 설정 → 검증된 빌드 게시 → Custom domain 등록 → DNS/TLS 및 온라인 화면 검증.

DNS·프로젝트·인증서 변경은 아직 수행하지 않았다. 공개 NS만으로 어느 계정이 관리하는지 또는 현재 계정에 편집권이 있는지는 판단하지 않는다.
