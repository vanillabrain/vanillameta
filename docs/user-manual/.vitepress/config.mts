import { defineConfig } from "vitepress";
import { fileURLToPath } from "node:url";

const groups = [
  {
    text: "시작하기",
    items: [
      ["빠른 시작", "quickstart"],
      ["화면으로 따라 하는 샘플", "sample-walkthrough"],
      ["기본 개념", "concepts"],
      ["화면과 이동", "navigation"],
    ],
  },
  {
    text: "데이터와 분석",
    items: [
      ["데이터 연결", "data"],
      ["지표와 차원", "metrics"],
      ["Explore", "explore"],
      ["Pivot", "pivot"],
    ],
  },
  {
    text: "AI와 Studio",
    items: [
      ["AI 분석 생성", "ai-create"],
      ["AI 수정·블록 편집", "ai-edit"],
      ["질문 예시", "recipes"],
      ["초안·충돌 복구", "recovery"],
    ],
  },
  {
    text: "저장과 활용",
    items: [
      ["게시·링크 공유", "publish"],
      ["조직 공유와 권한", "organization"],
      ["조직 공유·재사용 샘플", "team-reuse-walkthrough"],
      ["복제와 재사용", "reuse"],
      ["CSV 출력과 보관", "export-library"],
    ],
  },
  {
    text: "도움말",
    items: [
      ["문제 해결", "troubleshooting"],
      ["실제 화면 모음", "screenshots"],
      ["지원 범위·문서 기준", "scope"],
    ],
  },
];

export default defineConfig({
  lang: "ko-KR",
  title: "VanillaMeta 가이드",
  description:
    "데이터 연결부터 AI 분석·탐색·저장·게시·사내 공유까지 따라 하는 VanillaMeta 사용자 가이드",
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
      { text: "가이드", link: "/contents" },
      { text: "빠른 시작", link: "/quickstart" },
      { text: "문제 해결", link: "/troubleshooting" },
    ],
    sidebar: groups.map((group) => ({
      text: group.text,
      collapsed: false,
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
