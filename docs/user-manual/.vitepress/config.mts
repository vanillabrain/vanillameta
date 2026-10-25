import { defineConfig } from "vitepress";
import { fileURLToPath } from "node:url";

const groups = [
  {
    text: "아티팩트 시작하기",
    collapsed: false,
    items: [
      ["1. 아티팩트 이해하기", "agent-artifacts"],
      ["2. 첫 아티팩트 만들기", "quickstart"],
      ["3. 수정하고 저장하기", "ai-edit"],
      ["4. 게시하고 공유하기", "publish"],
      ["5. 복제해서 재사용하기", "reuse"],
    ],
  },
  {
    text: "데이터·분석 더 알아보기",
    collapsed: true,
    items: [
      ["내 데이터 연결", "data"],
      ["용어 찾아보기", "concepts"],
      ["화면과 이동", "navigation"],
      ["지표와 차원", "metrics"],
      ["Explore", "explore"],
      ["Pivot", "pivot"],
      ["AI 생성 상세", "ai-create"],
      ["질문 예시", "recipes"],
      ["매출 분석 샘플", "sample-walkthrough"],
      ["CSV 출력과 보관", "export-library"],
    ],
  },
  {
    text: "팀·관리자·외부 에이전트",
    collapsed: true,
    items: [
      ["조직 공유와 권한", "organization"],
      ["조직 공유·재사용 실습", "team-reuse-walkthrough"],
      ["관리자용 AI 실행 환경", "agent-connection"],
      ["MCP 연결·직접 제작", "mcp"],
    ],
  },
  {
    text: "필요할 때 찾아보기",
    collapsed: true,
    items: [
      ["전체 안내", "contents"],
      ["기능 사전 · 50개 시나리오", "feature-scenarios"],
      ["문제 해결", "troubleshooting"],
      ["초안·충돌 복구", "recovery"],
      ["실제 화면 모음", "screenshots"],
      ["지원 범위·문서 기준", "scope"],
    ],
  },
];

export default defineConfig({
  lang: "ko-KR",
  title: "VanillaMeta 가이드",
  description:
    "내 데이터로 아티팩트를 만들고 수정·공유·재사용하는 VanillaMeta 기본 가이드",
  // Only these user-facing pages enter the build and search index.
  srcDir: "site",
  base: process.env.VM_DOCS_BASE || "/",
  cleanUrls: true,
  vite: {
    plugins: [
      {
        name: "user-guide-source-boundary",
        configResolved(config) {
          // VitePress merges the repository workspace into fs.allow; narrow it again.
          config.server.fs.allow = [
            fileURLToPath(new URL("..", import.meta.url)),
          ];
        },
      },
    ],
    publicDir: fileURLToPath(new URL("./public", import.meta.url)),
    server: {
      host: "127.0.0.1",
      fs: {
        strict: true,
        allow: [fileURLToPath(new URL("..", import.meta.url))],
      },
    },
  },
  head: [["meta", { name: "theme-color", content: "#1b5dba" }]],
  markdown: {
    config(md) {
      // Includes keep the existing GitHub guides canonical; adapt only their relative links.
      md.core.ruler.before("normalize", "user-guide-links", (state) => {
        state.src = state.src
          .replaceAll("](site/", "](/")
          .replaceAll("](images/", "](/images/")
          .replaceAll("](../images/", "](/images/")
          .replaceAll('src="images/', 'src="/images/')
          .replaceAll('src="../images/', 'src="/images/')
          .replaceAll(
            "VanillaMeta_사용자_매뉴얼.md#조직-직원에게-조회-공유",
            "organization.md"
          )
          .replaceAll("VanillaMeta_사용자_매뉴얼.md", "contents.md")
          .replaceAll("스크린샷_가이드.md", "screenshots.md")
          .replaceAll(
            "[검증 기록](../testing/user-guide-ego.md)",
            "[문서 기준과 검증 범위](scope.md)"
          );
      });
    },
  },
  themeConfig: {
    siteTitle: "VanillaMeta · 사용 가이드",
    nav: [
      { text: "시작하기", link: "/agent-artifacts" },
      { text: "전체 안내", link: "/contents" },
      { text: "문제 해결", link: "/troubleshooting" },
    ],
    sidebar: groups.map((group) => ({
      text: group.text,
      collapsed: group.collapsed,
      items: group.items.map(([text, slug]) => ({ text, link: `/${slug}` })),
    })),
    outline: { level: [2, 3], label: "이 페이지에서" },
    docFooter: { prev: "이전", next: "다음" },
    sidebarMenuLabel: "메뉴",
    returnToTopLabel: "맨 위로",
    darkModeSwitchLabel: "테마",
    lightModeSwitchTitle: "밝은 화면으로",
    darkModeSwitchTitle: "어두운 화면으로",
    search: {
      provider: "local",
      options: {
        translations: {
          button: { buttonText: "문서 검색", buttonAriaLabel: "문서 검색" },
          modal: {
            displayDetails: "본문 미리보기",
            resetButtonTitle: "검색어 지우기",
            backButtonTitle: "검색 닫기",
            noResultsText: "검색 결과가 없습니다:",
            footer: {
              selectText: "선택",
              selectKeyAriaLabel: "Enter",
              navigateText: "이동",
              navigateUpKeyAriaLabel: "위쪽",
              navigateDownKeyAriaLabel: "아래쪽",
              closeText: "닫기",
              closeKeyAriaLabel: "Escape",
            },
          },
        },
      },
    },
    footer: {
      message:
        "VanillaMeta 사용자 가이드 · 설치 환경과 권한에 따라 화면이 다를 수 있습니다.",
    },
  },
});
