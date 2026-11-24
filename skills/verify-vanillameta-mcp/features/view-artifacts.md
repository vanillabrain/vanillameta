# Open an artifact in the browser

## Sub-features
The viewer at `/ai-artifacts/<id>` renders each kind. `html` goes into a sandboxed iframe, `document` renders as an article, `sheet` as a table, `chart` as a canvas. Only the owner can open an artifact.

## How to get to it (user POV)
The person clicks the link the AI host returned, signs in if needed, and reads the result.

## Driving it with Playwright
List the ids, then judge them in a real browser:

```sh
vars=$(skills/verify-vanillameta-mcp/env.sh) && eval "$vars"
JWT=$(curl -s -H 'Content-Type: application/json' -d '{"userId":"guest","password":"Admin!@12"}' "$VM_API_URL/login/signin" | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')
curl -s -H "Authorization: Bearer $JWT" "$VM_API_URL/ai-artifacts"
WEB=$VM_WEB_URL SHOTS=$VM_EVIDENCE_DIR/render ITEMS='[{"name":"doc","id":"<id>","kind":"document","title":"<title>","needle":"<text in the body>"}]' node scripts/verify/artifact-render-check.mjs
```

For `chart`, use `"needle":""`. The proof is `PASS` for the title, the kind-specific line, and `오류 알림 없음`, plus the screenshot.

A chart passes when the canvas holds more than 2000 coloured pixels. Axes and labels are grey. A chart with all values 0 gives about 330 and fails. An empty chart gives 0.

## Gotchas
- A missing or foreign id shows `This artifact cannot be opened. It was deleted or you do not have access.` and no title.
- The html needle is read inside the iframe. Look at `iframe[title="artifact"]`.
- A series drawn only in grey fails the chart check even with data.
