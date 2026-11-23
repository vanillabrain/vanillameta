#!/usr/bin/env node
// 실제 브라우저로 /ai-artifacts/<id> 가 내용을 그리는지 판정한다.
// 입력은 환경 변수: WEB, VM_USER, VM_PASSWORD, ITEMS(JSON [{name,id,kind,title,needle}]), SHOTS(스크린샷 디렉터리).
// 판정은 DOM 과 canvas 픽셀로만 한다. 상태 코드나 JSON 응답은 판정 근거로 쓰지 않는다.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const { chromium } = createRequire(join(root, 'frontend-web', 'package.json'))('playwright');

const web = process.env.WEB ?? 'http://localhost:3000';
const items = JSON.parse(process.env.ITEMS ?? '[]');
const shots = process.env.SHOTS ?? join(root, '.verify', 'render');
mkdirSync(shots, { recursive: true });

let failed = 0;
const report = (ok, message) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${message}`);
};

const browser = await chromium.launch().catch(error => {
  console.log(`FAIL: 브라우저를 시작하지 못했습니다 (cd frontend-web && npx playwright install chromium): ${error.message.split('\n')[0]}`);
  process.exit(1);
});
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await page.goto(`${web}/login`);
  await page.fill('input[name="userId"]', process.env.VM_USER ?? 'guest');
  await page.fill('input[name="userPwd"]', process.env.VM_PASSWORD ?? 'Admin!@12');
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 20_000 });

  for (const item of items) {
    const label = `${item.name} 화면`;
    await page.goto(`${web}/ai-artifacts/${item.id}`);
    try {
      await page.locator('h1').first().waitFor({ timeout: 15_000 });
    } catch {
      report(false, `${label}: 제목이 나타나지 않음 (${(await page.locator('[role="alert"]').allInnerTexts()).join(' ') || page.url()})`);
      await page.screenshot({ path: join(shots, `${item.name}.png`), fullPage: true });
      continue;
    }
    const heading = await page.locator('h1').first().innerText();
    report(heading === item.title, `${label}: 제목 "${heading}"`);

    if (item.kind === 'html') {
      const text = await page.frameLocator('iframe[title="artifact"]').locator('body').innerText({ timeout: 10_000 });
      report(text.includes(item.needle), `${label}: iframe 안에 "${item.needle}"`);
    } else if (item.kind === 'document') {
      const text = await page.locator('article').innerText();
      report(text.includes(item.needle), `${label}: 본문에 "${item.needle}"`);
    } else if (item.kind === 'sheet') {
      const text = await page.locator('table').innerText();
      report(text.includes(item.needle), `${label}: 표 안에 "${item.needle}"`);
    } else if (item.kind === 'chart') {
      await page.waitForTimeout(1500);
      const painted = await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        if (!canvas || canvas.width < 100 || canvas.height < 100) return 0;
        const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let count = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) count += 1;
        return count;
      });
      report(painted > 2_000, `${label}: canvas 에 그려진 픽셀 ${painted}`);
    }
    report((await page.locator('[role="alert"]').count()) === 0, `${label}: 오류 알림 없음`);
    await page.screenshot({ path: join(shots, `${item.name}.png`), fullPage: true });
  }
} finally {
  await browser.close();
}
process.exit(failed === 0 ? 0 : 1);
