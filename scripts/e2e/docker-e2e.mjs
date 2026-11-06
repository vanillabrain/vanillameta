// scripts/docker-e2e.sh 가 앞에 `const CFG = {...}` 를 붙여 ego-browser 로 실행한다.
// 케이스는 서로 이어진다(앞 케이스가 만든 데이터를 뒤 케이스가 쓴다). 실패한 케이스는 이유와 함께 모아 마지막에 보고한다.
const fs = await import('node:fs/promises');
const crypto = await import('node:crypto');

const BASE = CFG.base;
const ONLY = CFG.only ? new RegExp(CFG.only) : null;
const GUEST = { id: 'guest', pw: 'Admin!@12' };
const results = [];
const state = {};

const task = await taskSpace('vanillameta docker e2e');
const page = task.page('p1');

const sleep = ms => page.waitForTimeout(ms);
const errMsg = e => String((e && e.message) || e).replace(/\s+/g, ' ').slice(0, 280);

async function kase(name, fn, opts = {}) {
  if (ONLY && !ONLY.test(name)) return;
  const started = Date.now();
  try {
    // 로그인이 필요한 케이스는 단독으로 돌려도 되도록 시작 전에 로그인 상태를 보장한다.
    if (!opts.anon && !state.loggedIn) {
      await uiLogin(GUEST.id, GUEST.pw);
      await page.waitForURL(/\/dashboard/, { timeout: 20000 });
      state.loggedIn = true;
    }
    await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name} (${Math.round((Date.now() - started) / 100) / 10}s)`);
  } catch (e) {
    results.push({ name, ok: false, why: errMsg(e) });
    console.log(`FAIL  ${name}\n      -> ${errMsg(e)}`);
    try {
      const shot = `${CFG.shots}/fail-${results.length}.png`;
      await page.screenshot({ path: shot });
      const t = await page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 400));
      console.log(`      url=${await page.url()}\n      shot=${shot}\n      text=${t}`);
    } catch {}
  }
}
const check = (cond, message) => {
  if (!cond) throw new Error(message);
};

async function go(path, wait = 2500) {
  await page.goto(BASE + path);
  await page.waitForLoadState().catch(() => {});
  await sleep(wait);
}
const bodyText = () => page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' '));
async function waitText(re, timeout = 15000) {
  await page.waitForFunction(src => new RegExp(src).test((document.body.innerText || '').replace(/\s+/g, ' ')), re.source, { timeout }).catch(() => {
    throw new Error(`화면에 ${re} 가 나타나지 않음`);
  });
}
const resourceStatusSupported = () =>
  page.evaluate(() => {
    const e = performance.getEntriesByType('resource')[0];
    return !e || 'responseStatus' in e;
  });
const badRequests = async (allow = []) =>
  (
    await page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .filter(e => e.responseStatus >= 400)
        .map(e => `${e.responseStatus} ${new URL(e.name).pathname}`),
    )
  ).filter(line => !allow.some(re => re.test(line)));
const clickButton = name => page.click(`loc=role:button[name='${name}']`);
const fillByPlaceholder = (ph, value) => page.fill(`loc=css:input[placeholder="${ph}"]`, value);

// 라벨 글자 바로 뒤에 오는 첫 select/input 을 찾아 값을 넣는다(React 제어 컴포넌트라 change 이벤트까지 보낸다).
async function setAfterLabel(label, value, kind = 'select') {
  const out = await page.evaluate(
    ({ label, value, kind }) => {
      const nodes = [...document.querySelectorAll('label, span, p, div, h3, h4')].filter(
        n => n.children.length === 0 && n.textContent.trim() === label,
      );
      for (const node of nodes) {
        const all = [...document.querySelectorAll(kind === 'select' ? 'select' : 'input:not([type=file]):not([type=hidden])')];
        const target = all.find(el => node.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
        if (!target) continue;
        if (kind === 'select') {
          const opt = [...target.options].find(o => o.textContent.trim() === value) || [...target.options].find(o => o.textContent.includes(value));
          if (!opt) return `옵션 없음: ${value} (있는 값: ${[...target.options].map(o => o.textContent.trim()).join('/')})`;
          const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
          setter.call(target, opt.value);
        } else {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
          setter.call(target, value);
        }
        target.dispatchEvent(new Event(kind === 'select' ? 'change' : 'input', { bubbles: true }));
        return 'ok';
      }
      return `라벨을 찾지 못함: ${label}`;
    },
    { label, value, kind },
  );
  check(out === 'ok', out);
}

// 라벨 문구가 없는 select 는 접근성 이름(aria-label)이나 들어 있는 옵션 글자로 찾는다.
async function setSelect({ aria, hasOption }, optionText) {
  const out = await page.evaluate(
    ({ aria, hasOption, optionText }) => {
      const sel = [...document.querySelectorAll('select')].find(el =>
        aria ? el.getAttribute('aria-label') === aria : [...el.options].some(o => o.textContent.includes(hasOption)),
      );
      if (!sel) return `select 를 찾지 못함: ${aria || hasOption}`;
      const opt = [...sel.options].find(o => o.textContent.trim() === optionText) || [...sel.options].find(o => o.textContent.includes(optionText));
      if (!opt) return `옵션 없음: ${optionText} (있는 값: ${[...sel.options].map(o => o.textContent.trim()).join('/')})`;
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, opt.value);
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return 'ok';
    },
    { aria, hasOption, optionText },
  );
  check(out === 'ok', out);
}


// 확인 대화상자가 role=dialog 가 아닌 화면도 있어서, 같은 이름의 버튼 중 마지막(가장 위에 뜬) 것을 누른다.
async function clickLast(text) {
  const out = await page.evaluate(t => {
    const list = [...document.querySelectorAll('button')].filter(b => b.innerText.trim() === t && !b.disabled);
    const b = list[list.length - 1];
    if (!b) return `'${t}' 버튼이 없음`;
    b.click();
    return 'ok';
  }, text);
  check(out === 'ok', out);
}


// 폼 안의 select 를 순서(0부터)로 고른다. 라벨이 접근성 이름에 없는 마법사 화면용.
async function setNthSelect(n, optionText) {
  const out = await page.evaluate(({ n, optionText }) => {
    const sel = [...document.querySelectorAll('select')][n];
    if (!sel) return `select #${n} 가 없음`;
    const opt = [...sel.options].find(o => o.textContent.trim() === optionText);
    if (!opt) return `옵션 없음: ${optionText} (있는 값: ${[...sel.options].map(o => o.textContent.trim()).join('/')})`;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, opt.value);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return 'ok';
  }, { n, optionText });
  check(out === 'ok', out);
}

const buttonState = text =>
  page.evaluate(t => {
    const b = [...document.querySelectorAll('button')].find(x => x.innerText.trim() === t);
    return b ? (b.disabled ? 'disabled' : 'enabled') : 'missing';
  }, text);
async function clickWhenEnabled(text, timeout = 15000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if ((await buttonState(text)) === 'enabled') {
      await page.evaluate(t => {
        const b = [...document.querySelectorAll('button')].find(x => x.innerText.trim() === t);
        b.scrollIntoView({ block: 'center' });
      }, text);
      await sleep(300);
      return clickButton(text);
    }
    await sleep(400);
  }
  throw new Error(`'${text}' 버튼이 활성화되지 않음(${await buttonState(text)})`);
}

// 같은 출처에서 fetch 한다(쿠키·nginx 프록시 경유).
async function api(method, path, body, token) {
  if (!(await page.url()).startsWith(BASE)) await go('/ai-connections', 1500);
  return page.evaluate(
    async ({ method, path, body, token }) => {
      const res = await fetch(path, {
        method,
        credentials: 'include',
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      let json = null;
      try {
        json = await res.json();
      } catch {}
      return { status: res.status, json };
    },
    { method, path, body, token },
  );
}
async function tokenFor(id, pw) {
  const r = await api('POST', '/v1/login/signin', { userId: id, password: pw });
  check(r.status === 201 && r.json?.accessToken, `API 로그인 실패(${r.status})`);
  return r.json.accessToken;
}
async function clearSession() {
  state.loggedIn = false;
  // 앱이 토큰을 sessionStorage 에도 둘 수 있어 현재 문서의 저장소를 먼저 비운다(CDP 정리에는 포함되지 않는다).
  await page.evaluate(() => { try { sessionStorage.clear(); localStorage.clear(); } catch {} }).catch(() => {});
  await page.cdp('Storage.clearDataForOrigin', { origin: BASE, storageTypes: 'cookies,local_storage,cache_storage,service_workers' });
}
async function uiLogin(id, pw) {
  await clearSession();
  await go('/login', 1500);
  await page.fill('loc=css:input[name="userId"]', id);
  await page.fill('loc=css:input[name="userPwd"]', pw);
  await clickButton('Login');
}

// ---- 기대값은 CSV 에서 직접 계산한다 --------------------------------------------------------
const csvPath = `${CFG.root}/scripts/e2e/fixtures/sales.csv`;
const rows = (await fs.readFile(csvPath, 'utf8')).trim().split('\n').slice(1).map(l => l.split(','));
const TOTAL = rows.reduce((s, r) => s + Number(r[3]), 0);
const BY_REGION = {};
for (const r of rows) BY_REGION[r[1]] = (BY_REGION[r[1]] || 0) + Number(r[3]);
const fmt = n => n.toLocaleString('en-US');

// ============================================================================================
// 1. 시작과 인증
// ============================================================================================
await kase('인증: 로그인 화면이 열린다', async () => {
  await clearSession();
  await go('/login', 1500);
  const t = await bodyText();
  check(/User ID/.test(t) && /Password/.test(t), '로그인 폼이 없음');
}, { anon: true });

await kase('인증: 잘못된 비밀번호는 거절되고 로그인 화면에 머문다', async () => {
  await uiLogin(GUEST.id, 'wrong-password');
  await sleep(2500);
  check(/\/login/.test(await page.url()), `로그인 화면을 벗어남: ${await page.url()}`);
  const token = await api('POST', '/v1/login/signin', { userId: GUEST.id, password: 'wrong-password' });
  check(token.status === 401 && !token.json?.accessToken, `잘못된 비밀번호가 거절되지 않음: ${token.status}`);
}, { anon: true });

await kase('인증: guest 로 로그인하면 아티팩트 목록으로 간다', async () => {
  await uiLogin(GUEST.id, GUEST.pw);
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
  await waitText(/아티팩트/);
  state.loggedIn = true;
}, { anon: true });

await kase('조직: guest 는 관리 모드의 조직 admin 이다', async () => {
  await go('/organization');
  const t = await bodyText();
  check(/admin \(관리자\)/.test(t), `admin 표시 없음: ${t.slice(0, 160)}`);
});

// ============================================================================================
// 2. 화면 순회(로그인 상태에서 데이터 없이 열리는 화면)
// ============================================================================================
const SCREENS = [
  ['/dashboard', /아티팩트/],
  ['/widget', /위젯 생성/],
  ['/widget/create', /데이터 선택/],
  ['/data', /데이터 소스/],
  ['/data/file', /파일 분석/],
  ['/data/metric', /메트릭|지표/],
  ['/data/source/create', /데이터 소스 연결/],
  ['/data/set/create', /데이터셋 생성/],
  ['/explore', /SQL 없이 차트 만들기/],
  ['/explore/source', /지표 탐색/],
  ['/documents', /연결 문서/],
  ['/documents/sheets', /Sheets 가져오기/],
  ['/documents/microsoft', /Microsoft 문서 연결/],
  ['/ai-connections', /외부 AI 연결/],
  ['/organization', /조직/],
  ['/organizations', /조직 분석/],
  ['/commerce', /매출·환불/],
  ['/reports', /비공개 보고서|내 보고서/],
  ['/studio/new', /DASHBOARD STUDIO/],
  ['/dashboard/create', /대시보드 추가/],
];
for (const [path, re] of SCREENS) {
  await kase(`화면: ${path} 이 열리고 요청이 실패하지 않는다`, async () => {
    await go(path);
    const t = await bodyText();
    check(re.test(t), `기대 문구 ${re} 없음: ${t.slice(0, 140)}`);
    check(!/Unexpected Application Error|Internal server error/i.test(t), '오류 화면');
    const bad = await badRequests();
    check(bad.length === 0, `실패한 요청: ${bad.join(', ')}`);
  });
}
await kase('화면: 브라우저가 요청 상태 코드를 보고한다(요청 실패 검사의 전제)', async () => {
  await go('/dashboard');
  check(await resourceStatusSupported(), 'PerformanceResourceTiming.responseStatus 미지원: 화면의 요청 실패 검사가 무력화됨');
});
await kase('화면: 없는 주소는 404 안내를 보여 준다', async () => {
  await go('/no-such-page');
  check(/404/.test(await bodyText()), '404 문구 없음');
});

// ============================================================================================
// 3. 데이터: CSV 업로드 → 데이터 소스 → 데이터셋
// ============================================================================================
await kase('데이터: CSV 를 올리면 데이터 소스가 만들어진다(행 수 일치)', async () => {
  await go('/data/file', 1500);
  const chooser = page.waitForFileChooser({ timeout: 10000 });
  await clickButton('파일 선택');
  await (await chooser).setFiles(csvPath);
  await waitText(/sales\.csv/);
  await clickWhenEnabled('데이터셋으로 저장');
  await waitText(new RegExp(`데이터 소스가 생성되었습니다\\. \\(${rows.length}행\\)`), 30000);
  const m = (await page.url()).match(/\/data\/set\/create\/(\d+)/);
  check(m, `데이터셋 생성 화면으로 가지 않음: ${await page.url()}`);
  state.sourceId = Number(m[1]);
});

await kase('데이터: 쿼리를 실행하고 데이터셋으로 저장한다', async () => {
  await fillByPlaceholder('데이터셋의 이름을 입력해 주세요', 'sales_orders');
  await clickButton('Run');
  await waitText(/order_date.*region.*category.*amount/);
  await clickButton('저장');
  await sleep(1200);
  await clickButton('확인');
  await page.waitForURL(/\/data$/, { timeout: 20000 });
  const token = await tokenFor(GUEST.id, GUEST.pw);
  state.token = token;
  const r = await api('GET', '/v1/dataset', undefined, token);
  check(r.status === 200 && r.json.data.some(d => d.title === 'sales_orders'), '데이터셋이 API 목록에 없음');
});

// ============================================================================================
// 4. 지표와 차트(서버 AI 없이)
// ============================================================================================
await kase('탐색: 저장된 파일의 행 수와 열이 보인다', async () => {
  check(state.sourceId, '앞 단계에서 소스가 만들어지지 않음');
  await go(`/explore?sourceId=${state.sourceId}`, 3500);
  const t = await bodyText();
  check(new RegExp(`저장된 전체 행 수: ${rows.length}`).test(t), `행 수 불일치: ${t.slice(0, 200)}`);
  check(/order_date/.test(t) && /region/.test(t) && /amount/.test(t), '열 목록 없음');
});

await kase('탐색: 합계 지표를 저장하고 숫자 차트 값이 CSV 합계와 같다', async () => {
  await setAfterLabel('지표 이름', '총 매출', 'input');
  await setAfterLabel('집계할 열', 'amount');
  await clickWhenEnabled('지표 저장');
  await waitText(/총 매출 · v1/);
  await setAfterLabel('차트 제목', '총 매출 카드', 'input');
  await clickWhenEnabled('결과 미리보기');
  await waitText(new RegExp(fmt(TOTAL).replace(/,/g, ',')), 20000);
});

await kase('탐색: 막대 차트의 지역별 값이 CSV 집계와 같다', async () => {
  await setAfterLabel('차트 제목', '지역별 매출', 'input');
  await setAfterLabel('차트 종류', '막대 · 범주별');
  await sleep(800);
  const out = await page.evaluate(() => {
    const sel = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => /region · VARCHAR/.test(o.textContent)) && /열을 선택하세요/.test(s.options[s.selectedIndex]?.textContent || ''));
    if (!sel) return '범주 열 선택 상자를 찾지 못함';
    const opt = [...sel.options].find(o => /region · VARCHAR/.test(o.textContent));
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, opt.value);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return 'ok';
  });
  check(out === 'ok', out);
  await clickWhenEnabled('결과 미리보기');
  await waitText(/region\s+총 매출/, 20000);
  const t = await bodyText();
  for (const [region, sum] of Object.entries(BY_REGION)) {
    check(new RegExp(`${region}\\s+${sum}\\b`).test(t), `${region} 합계 ${sum} 가 표에 없음`);
  }
});

await kase('탐색: 대시보드로 저장하면 조회 화면이 열린다', async () => {
  await clickWhenEnabled('대시보드 저장');
  await page.waitForURL(/\/dashboard\/\d+$/, { timeout: 20000 });
  state.dashboardId = Number((await page.url()).match(/\/dashboard\/(\d+)/)[1]);
  await sleep(3000);
  const t = await bodyText();
  check(/지역별 매출/.test(t), `대시보드 제목 없음: ${t.slice(0, 160)}`);
  check(!/조회에 실패했습니다/.test(t), `조회 실패 문구: ${t.slice(0, 200)}`);
  const bad = await badRequests();
  check(bad.length === 0, `실패한 요청: ${bad.join(', ')}`);
});

// ============================================================================================

// 아티팩트 목록(API 와 화면)에 만든 대시보드가 보이는지.
async function expectListed(titleRe, label) {
  const token = await tokenFor(GUEST.id, GUEST.pw);
  const r = await api('GET', '/v1/dashboard', undefined, token);
  check(r.status === 200, `목록 API ${r.status}`);
  const ids = (r.json?.data || []).map(d => d.id);
  // 이전 결함은 "DB 전체에서 가장 최근 대시보드 1개"만 돌려줬다. 알고 있는 대시보드가 모두 있어야 한다.
  const known = [state.dashboardId, state.classicId].filter(Boolean);
  check(known.length > 0, '확인할 대시보드 id 를 알 수 없음(앞 케이스가 돌지 않음)');
  for (const id of known) check(ids.includes(id), `${label}: 목록 API 에 대시보드 #${id} 가 없음(목록: ${ids.join(',')})`);
  await go('/dashboard', 3500);
  const t = await bodyText();
  check(titleRe.test(t), `${label}: 아티팩트 목록 화면에 대시보드가 보이지 않음`);
}
await kase('목록: 저장한 대시보드가 아티팩트 목록에 보인다', () => expectListed(/지역별 매출/, '저장 직후'));

// 5. Studio 와 게시
// ============================================================================================
await kase('Studio: 저장된 대시보드가 편집기에서 열린다', async () => {
  await go(`/dashboard/${state.dashboardId}/studio`, 3500);
  const t = await bodyText();
  check(/DASHBOARD STUDIO/.test(t) && /지역별 매출/.test(t), `Studio 화면 아님: ${t.slice(0, 140)}`);
  const bad = await badRequests();
  check(bad.length === 0, `실패한 요청: ${bad.join(', ')}`);
});

await kase('게시: 링크 게시 후 로그아웃 상태에서 공개 링크가 열린다', async () => {
  await go(`/dashboard/${state.dashboardId}/publication`, 3000);
  await clickWhenEnabled('게시 결과 미리보기');
  await sleep(2500);
  await clickWhenEnabled('링크 게시');
  await waitText(/게시 중 · 버전 1/, 20000);
  const link = await page.evaluate(() => [...document.querySelectorAll('a,input')].map(e => e.href || e.value).find(x => /\/published\//.test(x || '')));
  check(link, '게시 링크를 찾지 못함');
  state.publishedPath = new URL(link).pathname;
  await clearSession();
  await go(state.publishedPath, 4000);
  check(/링크 공유 · 게시 버전 1/.test(await bodyText()), `공개 화면 아님: ${(await bodyText()).slice(0, 160)}`);
  await page.click('text=데이터 표 보기');
  await sleep(800);
  const t = await bodyText();
  for (const [region, sum] of Object.entries(BY_REGION)) {
    check(t.includes(region) && (t.includes(String(sum)) || t.includes(fmt(sum))), `공개 화면에 ${region} 합계 ${sum} 가 없음`);
  }
});

await kase('목록: 게시한 뒤에도 아티팩트 목록에 보인다', () => expectListed(/지역별 매출/, '게시 후'));

// ============================================================================================
// 5b. 보고서: 숫자 카드 + 차트가 한 대시보드에 있어야 한다(서버 AI 없이: 편집기에서 지표 차트를 추가한다)
// ============================================================================================
await kase('보고서: 차트·배치 편집에서 저장된 지표를 숫자 카드로 추가해 저장한다', async () => {
  await go(`/dashboard/${state.dashboardId}/edit-charts`, 3500);
  // 이 화면의 선택 상자는 네이티브 select 가 아니라 커스텀 목록이다.
  await page.click('text="지표를 선택하세요"');
  await sleep(500);
  await page.click("loc=role:option[name='총 매출']");
  await clickWhenEnabled('지표 차트 추가');
  await sleep(1500);
  const t = await bodyText();
  check(/차트 추가 · 2\/6개/.test(t), `차트가 추가되지 않음: ${t.slice(-300)}`);
  await clickWhenEnabled('변경 결과 미리보기');
  await sleep(3000);
  await clickWhenEnabled('변경 내용 저장');
  await sleep(3000);
  const after = await bodyText();
  check(!/실패|오류/.test(after), `저장 실패 문구: ${after.slice(-300)}`);
});

await kase('보고서: Studio 에서 저장하면 보고서 원본 조회가 열린다', async () => {
  await go(`/dashboard/${state.dashboardId}/studio`, 3500);
  const before = await api('GET', `/v1/reports/roots/${state.dashboardId}`, undefined, await tokenFor(GUEST.id, GUEST.pw));
  if (before.status !== 200) {
    await setSelect({ aria: '추가할 블록 정의' }, state.chartTitle || '지역별 매출');
    await sleep(1500);
    await clickWhenEnabled('저장');
    await sleep(3500);
  }
  const r = await api('GET', `/v1/reports/roots/${state.dashboardId}`, undefined, await tokenFor(GUEST.id, GUEST.pw));
  check(r.status === 200, `보고서 원본 조회 ${r.status} ${JSON.stringify(r.json).slice(0, 160)}`);
  const kinds = (r.json?.blocks || []).map(b => b.kind);
  check(kinds.includes('BOARD_NUMERIC') && kinds.some(k => /^CHART_/.test(k)), `숫자 카드와 차트가 함께 없음: ${kinds.join(',')}`);
});

await kase('보고서: 작성하고 미리보기 후 비공개로 저장하면 목록에 나타난다', async () => {
  await go(`/reports/new?dashboardId=${state.dashboardId}`, 3500);
  await page.fill('loc=css:input[type="text"]', `검증 보고서 ${TOTAL}`).catch(async () => {
    await setAfterLabel('보고서 제목', `검증 보고서 ${TOTAL}`, 'input');
  });
  await page.fill('textarea', `총 매출은 ${fmt(TOTAL)} 입니다. 지역별 분해가 다음 행동입니다.`);
  await clickWhenEnabled('현재 데이터 명시 미리보기');
  await sleep(3500);
  await clickWhenEnabled('비공개 저장');
  await sleep(3500);
  const token = await tokenFor(GUEST.id, GUEST.pw);
  const list = await api('GET', '/v1/reports', undefined, token);
  check(list.status === 200 && JSON.stringify(list.json).includes('검증 보고서'), `보고서 목록에 없음 ${list.status} ${JSON.stringify(list.json).slice(0, 200)}`);
  state.reportId = (Array.isArray(list.json) ? list.json : list.json?.data || list.json?.reports || [])[0]?.id;
});

await kase('보고서: 저장한 보고서를 읽으면 본문과 저장 당시의 숫자가 보인다', async () => {
  check(state.reportId, '보고서 id 를 알 수 없음');
  await go(`/reports/${state.reportId}/read`, 3500);
  const t = await bodyText();
  check(t.includes('검증 보고서'), `보고서 제목 없음: ${t.slice(0, 160)}`);
  check(t.includes(fmt(TOTAL)) || t.includes(String(TOTAL)), `저장 당시 합계 ${TOTAL} 가 보이지 않음`);
});

// ============================================================================================
// 5c. 클래식 경로: 위젯 마법사 → 위젯 → 위젯으로 대시보드(PostgreSQL 에서 깨졌던 /component, /widget, /dashboard 조회)
// ============================================================================================
// 위젯 마법사·대시보드 만들기의 버튼은 이 브라우저 도구의 합성 클릭으로는 선택·다음이 먹지 않는다(마우스 이벤트가 겹쳐
// 선택이 해제되는 것으로 보인다). 활성화를 기다린 뒤 DOM click 을 한 번만 보낸다.
async function domClick(selector) {
  const ok = await page.evaluate(sel => {
    const el = document.querySelector(sel);
    if (!el) return false;
    el.click();
    return true;
  }, selector);
  check(ok, `요소를 찾지 못함: ${selector}`);
}
async function domWhenEnabled(text, timeout = 15000) {
  const until = Date.now() + timeout;
  while (Date.now() < until && (await buttonState(text)) !== 'enabled') await sleep(400);
  check((await buttonState(text)) === 'enabled', `'${text}' 버튼이 활성화되지 않음(${await buttonState(text)})`);
  await page.evaluate(t => [...document.querySelectorAll('button')].find(x => x.innerText.trim() === t && !x.disabled)?.click(), text);
  await sleep(600);
}

await kase('위젯: 마법사로 데이터셋을 골라 표 위젯을 만든다', async () => {
  await go('/widget/create', 3500);
  await domClick('button[aria-label="sales_orders 선택"]');
  await sleep(500);
  await domWhenEnabled('다음');
  await waitText(/Data Grid/);
  await page.evaluate(() => [...document.querySelectorAll('span')].find(e => /Data Grid/.test(e.textContent) && e.children.length === 0)?.closest('button')?.click());
  await sleep(500);
  await domWhenEnabled('다음');
  await waitText(/위젯 이름/);
  await fillByPlaceholder('위젯의 이름을 입력해 주세요', '매출 표 e2e');
  await domClick('button[aria-label="항목 추가"]');
  await sleep(800);
  await setSelect({ hasOption: 'order_date' }, 'region');
  await domWhenEnabled('저장');
  await sleep(1500);
  await clickLast('저장'); // "위젯을 저장하시겠습니까?" 확인
  await sleep(3000);
  const token = await tokenFor(GUEST.id, GUEST.pw);
  const list = await api('GET', '/v1/widget', undefined, token);
  const w = (list.json?.data || []).filter(x => x.title === '매출 표 e2e').sort((a, b) => b.id - a.id)[0];
  check(w, `위젯 목록에 없음: ${JSON.stringify(list.json).slice(0, 200)}`);
  check(w.componentType === 'BOARD_TABLE', `componentType 키/값 이상: ${w.componentType}`);
  state.widgetId = w.id;
});

await kase('위젯: 마법사로 막대 차트 위젯을 만든다(지역별 합계)', async () => {
  await go('/widget/create', 3500);
  await domClick('button[aria-label="sales_orders 선택"]');
  await sleep(500);
  await domWhenEnabled('다음');
  await waitText(/Bar Chart/);
  await page.evaluate(() => [...document.querySelectorAll('span')].find(e => /Bar Chart/.test(e.textContent) && !/Stacked|Mixed/.test(e.textContent) && e.children.length === 0)?.closest('button')?.click());
  await sleep(500);
  await domWhenEnabled('다음');
  await waitText(/카테고리 설정/);
  await fillByPlaceholder('위젯의 이름을 입력해 주세요', '지역 막대 e2e');
  await setNthSelect(0, 'region');
  await setNthSelect(1, 'amount');
  await sleep(800);
  await domWhenEnabled('저장');
  await sleep(1500);
  await clickLast('저장');
  await sleep(3000);
  const list = await api('GET', '/v1/widget', undefined, await tokenFor(GUEST.id, GUEST.pw));
  const w = (list.json?.data || []).filter(x => x.title === '지역 막대 e2e').sort((a, b) => b.id - a.id)[0];
  check(w, `위젯 목록에 없음: ${(list.json?.data || []).map(x => x.title).join(',')}`);
  check(w.componentType === 'CHART_COLUMN' || w.componentType === 'CHART_BAR', `componentType 이상: ${w.componentType}`);
  state.barWidgetId = w.id;
});

await kase('위젯: 위젯 목록과 상세 화면이 열린다', async () => {
  await go('/widget', 3000);
  check(/매출 표 e2e/.test(await bodyText()), '위젯 목록에 보이지 않음');
  await go(`/widget/${state.widgetId}`, 3500);
  const t = await bodyText();
  check(/위젯 조회/.test(t) && /매출 표 e2e/.test(t), `위젯 상세가 열리지 않음: ${t.slice(0, 200)}`);
  check(!/조회에 실패했습니다/.test(t), '위젯 조회 실패 문구');
  const bad = await badRequests();
  check(bad.length === 0, `실패한 요청: ${bad.join(', ')}`);
});

await kase('클래식: 위젯으로 대시보드를 만들고 조회 화면이 위젯과 함께 열린다', async () => {
  await go('/dashboard/create', 2500);
  await fillByPlaceholder('대시보드의 이름을 입력해 주세요', '클래식 e2e');
  await domWhenEnabled('위젯 추가');
  await sleep(1500);
  await page.evaluate(() => [...document.querySelectorAll('span')].find(e => e.textContent.trim() === '지역 막대 e2e')?.click());
  await sleep(400);
  await clickLast('위젯 추가');
  await sleep(1500);
  await domWhenEnabled('저장');
  await sleep(1500);
  await clickLast('생성');
  await sleep(3500);
  const token = await tokenFor(GUEST.id, GUEST.pw);
  const list = await api('GET', '/v1/dashboard', undefined, token);
  const d = (list.json?.data || []).filter(x => x.title === '클래식 e2e').sort((a, b) => b.id - a.id)[0];
  check(d, `대시보드 목록에 없음: ${(list.json?.data || []).map(x => x.title).join(',')}`);
  state.classicId = d.id;
  await go(`/dashboard/${d.id}`, 4500);
  const t = await bodyText();
  check(/클래식 e2e/.test(t) && /지역 막대 e2e/.test(t), `조회 화면에 대시보드와 위젯이 보이지 않음: ${t.slice(0, 240)}`);
  check(!/조회에 실패했습니다/.test(t), `조회 실패 문구: ${t.slice(0, 200)}`);
  const bad = await badRequests([/\/v1\/ai\//]);
  check(bad.length === 0, `실패한 요청: ${bad.join(', ')}`);
});

// ============================================================================================
// 6. 조직과 등급(관리 모드): 가입 → 대기 → admin 이 viewer 로 추가 → 쓰기 거절 → editor 로 승급
// ============================================================================================
const MEMBER = { id: `e2em${Math.floor(Math.random() * 90000 + 10000)}`, pw: 'Passw0rd!x1' };
const MEMBER_EMAIL = `${MEMBER.id}@example.com`;

// 직원 추가 폼의 입력을 DOM 순서로 채운다(로그인 ID, 팀, 연결 코드 / 역할 select / 동의 체크).
async function fillStaffForm({ loginId, role, code }) {
  const out = await page.evaluate(
    ({ loginId, role, code }) => {
      const btn = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === '직원 추가');
      if (!btn) return '직원 추가 버튼 없음';
      let box = btn.parentElement;
      while (box && box.querySelectorAll('input:not([type=checkbox])').length < 3) box = box.parentElement;
      if (!box) return '직원 추가 폼을 찾지 못함';
      const inputs = [...box.querySelectorAll('input:not([type=checkbox])')];
      const set = (el, v) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      set(inputs[0], loginId);
      set(inputs[inputs.length - 1], code);
      const sel = box.querySelector('select');
      const opt = [...sel.options].find(o => o.textContent.trim().startsWith(role));
      if (!opt) return `역할 옵션 없음: ${role}`;
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, opt.value);
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      const cb = box.querySelector('input[type=checkbox]');
      if (cb && !cb.checked) cb.click();
      return 'ok';
    },
    { loginId, role, code },
  );
  check(out === 'ok', out);
}

await kase('조직: 새 계정이 가입하면 로그인 화면으로 간다', async () => {
  await clearSession();
  await go('/signup', 1500);
  await page.fill('loc=css:input[name="userId"]', MEMBER.id);
  await page.fill('loc=css:input[name="userPwd"]', MEMBER.pw);
  await page.fill('loc=css:input[name="userConfirmPwd"]', MEMBER.pw);
  await page.fill('loc=css:input[name="userEmail"]', MEMBER_EMAIL);
  await clickButton('가입하기');
  await page.waitForURL(/\/login/, { timeout: 15000 });
  await waitText(new RegExp(`${MEMBER.id}님 회원가입이 완료되었습니다`));
}, { anon: true });

await kase('조직: 조직 밖 계정은 대기 안내를 보고 조직 번호가 자동으로 채워진다', async () => {
  await clickButton('확인').catch(() => {});
  await page.fill('loc=css:input[name="userId"]', MEMBER.id);
  await page.fill('loc=css:input[name="userPwd"]', MEMBER.pw);
  await clickButton('Login');
  await page.waitForURL(/\/organization/, { timeout: 20000 });
  await waitText(/아직 조직에 연결되지 않았습니다/);
  const field = await page.evaluate(() => [...document.querySelectorAll('input')].map(i => i.value).find(v => /^\d+$/.test(v)));
  check(field === '1', `조직 번호가 자동 입력되지 않음: ${field}`);
}, { anon: true });

await kase('조직: 조직 밖 계정의 서비스 API 는 ORGANIZATION_REQUIRED 로 거절된다', async () => {
  const token = await tokenFor(MEMBER.id, MEMBER.pw);
  const r = await api('POST', '/v1/dashboard', { title: 'x', layout: [] }, token);
  check(r.status === 403 && /ORGANIZATION_REQUIRED/.test(JSON.stringify(r.json)), `기대 403 ORGANIZATION_REQUIRED, 실제 ${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
}, { anon: true });

await kase('조직: 조직 밖 계정이 연결 코드를 발급한다', async () => {
  await clickButton('조직 연결 코드 발급');
  await sleep(2000);
  state.joinCode = await page.evaluate(() => [...document.querySelectorAll('input')].map(i => i.value).find(v => /^[0-9a-f]{64}$/.test(v)));
  check(state.joinCode, '화면에 64자 연결 코드가 나오지 않음');
}, { anon: true });

await kase('조직: admin 이 연결 코드로 새 계정을 viewer 로 추가한다', async () => {
  await clearSession();
  await uiLogin(GUEST.id, GUEST.pw);
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
  state.loggedIn = true;
  await go('/organization', 3000);
  await fillStaffForm({ loginId: MEMBER.id, role: 'viewer', code: state.joinCode });
  await sleep(400);
  await clickWhenEnabled('직원 추가');
  // 화면 문구는 믿지 않는다: 동의 문구에 방금 입력한 ID 가 이미 들어 있어 서버가 처리하기 전에도 맞는다.
  // 직원 목록 API 에 viewer 로 실제 등록될 때까지 기다린다.
  const adminToken = await tokenFor(GUEST.id, GUEST.pw);
  let entry;
  let lastStatus;
  for (const _ of Array.from({ length: 30 })) {
    // 목록은 20명씩 페이지로 오므로 로그인 ID 로 검색한다(스택에 멤버가 쌓여도 첫 페이지에 의존하지 않는다).
    const list = await api('GET', `/v1/enterprise/members?q=${encodeURIComponent(MEMBER.id)}`, undefined, adminToken);
    lastStatus = list.status;
    const page1 = list.json?.entries ? list.json : list.json?.data;
    entry = (page1?.entries || []).find(e => e.userId === MEMBER.id);
    if (entry) break;
    await sleep(500);
  }
  check(entry, `직원 목록에 ${MEMBER.id} 가 등록되지 않음 (마지막 응답 ${lastStatus})`);
  check(entry.role === 'viewer', `viewer 로 등록되어야 함: ${entry.role}`);
});

await kase('등급: viewer 는 읽을 수 있고 쓰기는 ROLE_FORBIDDEN 이다', async () => {
  const token = await tokenFor(MEMBER.id, MEMBER.pw);
  const read = await api('GET', '/v1/dashboard', undefined, token);
  check(read.status === 200, `viewer 읽기 ${read.status} ${JSON.stringify(read.json).slice(0, 240)}`);
  const write = await api('POST', '/v1/dashboard', { title: 'x', layout: [] }, token);
  check(write.status === 403 && /ROLE_FORBIDDEN/.test(JSON.stringify(write.json)), `viewer 쓰기 기대 403 ROLE_FORBIDDEN, 실제 ${write.status}`);
  const admin = await api('PATCH', '/v1/enterprise/members/1', { role: 'admin', expectedVersion: 1 }, token);
  check(admin.status === 403, `viewer 가 등급을 바꿀 수 있음(${admin.status})`);
});

await kase('등급: viewer 로 로그인하면 아티팩트 목록은 열린다', async () => {
  await clearSession();
  await uiLogin(MEMBER.id, MEMBER.pw);
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
  state.loggedIn = false;
  await waitText(/아티팩트/);
  const t = await bodyText();
  check(!/조직에 연결되지 않았습니다/.test(t), '조직에 연결됐는데 대기 화면이 보임');
}, { anon: true });

await kase('등급: admin 이 editor 로 바꾸면 같은 토큰의 쓰기가 등급을 통과한다', async () => {
  const guestToken = await tokenFor(GUEST.id, GUEST.pw);
  const list = await api('GET', `/v1/enterprise/members?q=${encodeURIComponent(MEMBER.id)}`, undefined, guestToken);
  check(list.status === 200, `직원 목록 ${list.status}`);
  const page1 = list.json?.entries ? list.json : list.json?.data;
  const entries = page1?.entries || [];
  const row = entries.find(e => e.userId === MEMBER.id);
  check(row, `직원 목록에 ${MEMBER.id} 없음`);
  const memberToken = await tokenFor(MEMBER.id, MEMBER.pw);
  const patch = await api('PATCH', `/v1/enterprise/members/${row.id}`, { role: 'editor', team: row.team || '', active: true, expectedVersion: page1.organizationVersion }, guestToken);
  check(patch.status === 200, `등급 변경 ${patch.status} ${JSON.stringify(patch.json).slice(0, 160)}`);
  const after = await api('POST', '/v1/dashboard', { title: 'x', layout: 'invalid' }, memberToken);
  // 잘못된 본문이라 입력 검증에서 거절되는 것이 정상이다. 등급 거절 코드만 아니면 등급은 통과한 것이다.
  const body = JSON.stringify(after.json);
  check(after.status >= 400 && !/ROLE_FORBIDDEN|ORGANIZATION_REQUIRED/.test(body), `editor 인데 등급에서 거절됨: ${after.status} ${body.slice(0, 200)}`);
  check(/invalid layout/.test(body), `입력 검증까지 가지 못함: ${body.slice(0, 200)}`);
});

await kase('목록: 직원 추가와 등급 변경 뒤에도 admin 의 대시보드가 모두 목록에 남는다', () => expectListed(/지역별 매출/, '조직 작업 뒤'));

// ============================================================================================
// 7. AI 연결(원격 MCP): OAuth(PKCE) 승인 → 토큰 → 도구 호출 → 연결 해제
// ============================================================================================
const b64u = buf => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const MCP = CFG.mcp;
const pkce = { verifier: b64u(crypto.randomBytes(48)), state: b64u(crypto.randomBytes(12)) };
pkce.challenge = b64u(crypto.createHash('sha256').update(pkce.verifier).digest());
const MCP_RESOURCE = `${BASE}/v1/mcp`;

// MCP 는 상태 없는 JSON-RPC 한 건씩이다. 응답은 JSON 이다.
async function rpc(method, params, token) {
  if (!(await page.url()).startsWith(BASE)) await go('/ai-connections', 1500);
  return page.evaluate(
    async ({ method, params, token }) => {
      const res = await fetch('/v1/mcp', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      });
      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        const line = text.split('\n').find(l => l.startsWith('data:'));
        if (line) json = JSON.parse(line.slice(5));
      }
      return { status: res.status, json, text: text.slice(0, 300) };
    },
    { method, params, token },
  );
}

await kase('MCP: 인증 서버 메타데이터가 열린다', async () => {
  const r = await api('GET', '/.well-known/oauth-authorization-server/v1/mcp-oauth');
  check(r.status === 200, `메타데이터 ${r.status} (원격 MCP 설정이 꺼져 있을 수 있음)`);
  check(/\/v1\/mcp-oauth\/token/.test(r.json?.token_endpoint || ''), `token_endpoint 이상: ${JSON.stringify(r.json).slice(0, 160)}`);
  check((r.json?.code_challenge_methods_supported || []).includes('S256'), 'PKCE S256 미지원');
});

await kase('MCP: 토큰 없이 도구를 부르면 401 이다', async () => {
  const r = await rpc('tools/list', {}, null);
  check(r.status === 401, `기대 401, 실제 ${r.status} ${r.text}`);
});

// 브라우저로 승인하고 토큰까지 받아 오는 한 번의 연결. 코드는 한 번만 쓸 수 있으므로 연결마다 새로 한다.
async function connectClient(scope, { expectWriteUnchecked = false, approveAll = false } = {}) {
  const verifier = b64u(crypto.randomBytes(48));
  const state = b64u(crypto.randomBytes(12));
  const challenge = b64u(crypto.createHash('sha256').update(verifier).digest());
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: MCP.clientId,
    redirect_uri: MCP.redirect,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    resource: MCP_RESOURCE,
    scope,
  });
  await page.goto(`${BASE}/v1/mcp-oauth/authorize?${q}`);
  await page.waitForURL(/\/ai-connections\/approve\//, { timeout: 20000 });
  await waitText(/E2E 클라이언트/);
  if (expectWriteUnchecked) {
    // 쓰기 범위는 기본으로 선택되지 않는다. 읽기만 승인한다.
    const boxes = await page.evaluate(() => [...document.querySelectorAll('input[type=checkbox]')].map(c => ({ checked: c.checked, label: (c.closest('label') || c.parentElement)?.innerText.replace(/\s+/g, ' ').slice(0, 60) })));
    check(boxes.length >= 2, `범위 체크박스가 부족함: ${JSON.stringify(boxes)}`);
    check(boxes.some(b => b.checked) && boxes.some(b => !b.checked), `읽기만 선택되고 쓰기는 비선택이어야 함: ${JSON.stringify(boxes)}`);
  }
  if (approveAll) {
    // 사람이 쓰기 범위를 직접 체크해야 한다(기본은 비선택).
    await page.evaluate(() => [...document.querySelectorAll('input[type=checkbox]')].filter(c => !c.checked).forEach(c => c.click()));
    await sleep(400);
  }
  // 실제 AI 클라이언트처럼 redirect_uri 의 포트에서 콜백을 받는다.
  const http = await import('node:http');
  let callback = null;
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/callback')) callback = req.url; // 곧이어 오는 /favicon.ico 는 무시한다
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('연결이 승인되었습니다.');
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(Number(new URL(MCP.redirect).port), '127.0.0.1', resolve);
  });
  try {
    await clickWhenEnabled('연결 승인');
    const until = Date.now() + 20000;
    while (!callback && Date.now() < until) await sleep(300);
  } finally {
    server.closeAllConnections?.(); // 브라우저가 붙들고 있는 keep-alive 연결 때문에 close 가 오래 걸리지 않게 한다
    await new Promise(resolve => server.close(resolve));
  }
  check(callback, '콜백으로 리다이렉트되지 않음');
  const url = new URL(callback, MCP.redirect);
  check(url.searchParams.get('state') === state, `state 불일치: ${callback}`);
  const code = url.searchParams.get('code');
  check(/^[a-f0-9]{64}$/.test(code || ''), `인증 코드가 없음: ${callback}`);
  await go('/ai-connections', 1500);
  const exchange = (verifierValue, codeValue = code) =>
    page.evaluate(
      async ({ code, verifier, MCP, resource }) => {
        const res = await fetch('/v1/mcp-oauth/token', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: MCP.clientId, redirect_uri: MCP.redirect, code_verifier: verifier, resource }).toString(),
        });
        return { status: res.status, json: await res.json().catch(() => null) };
      },
      { code: codeValue, verifier: verifierValue, MCP, resource: MCP_RESOURCE },
    );
  const got = await exchange(verifier);
  check(got.status === 200, `올바른 verifier 가 거절됨: ${got.status} ${JSON.stringify(got.json).slice(0, 160)}`);
  check(got.json.access_token && got.json.refresh_token, '토큰 응답에 access/refresh 가 없음');
  return { code, verifier, exchange, access: got.json.access_token, refresh: got.json.refresh_token, scope: got.json.scope };
}

await kase('MCP: 브라우저에서 읽기 범위만 승인하고 토큰을 받는다(쓰기 범위는 기본 비선택)', async () => {
  state.conn = await connectClient('sources:read comments:write', { expectWriteUnchecked: true });
  check(/sources:read/.test(state.conn.scope) && !/comments:write/.test(state.conn.scope), `승인한 범위만 있어야 함: ${state.conn.scope}`);
});

await kase('MCP: 승인한 범위의 도구만 목록에 보인다(읽기 도구 O, 쓰기 도구 X)', async () => {
  const r = await rpc('tools/list', {}, state.conn.access);
  check(r.status === 200, `tools/list ${r.status} ${r.text}`);
  const names = (r.json?.result?.tools || []).map(t => t.name);
  check(names.includes('vm_list_sources') && names.includes('vm_describe_source'), `소스 읽기 도구가 없음: ${names.join(',')}`);
  check(!names.includes('vm_add_comment') && !names.includes('vm_share_report'), `승인하지 않은 쓰기 도구가 보임: ${names.join(',')}`);
});

await kase('MCP: vm_list_sources 가 올린 CSV 소스를 돌려준다', async () => {
  const r = await rpc('tools/call', { name: 'vm_list_sources', arguments: {} }, state.conn.access);
  check(r.status === 200 && !r.json?.result?.isError, `호출 실패 ${r.status} ${r.text}`);
  const text = JSON.stringify(r.json?.result);
  check(/sales/.test(text), `올린 소스(sales)가 목록에 없음: ${text.slice(0, 240)}`);
});

await kase('MCP: 인증 코드를 다시 쓰면 거절되고 그 코드로 발급된 연결도 철회된다', async () => {
  const replay = await state.conn.exchange(state.conn.verifier);
  check(replay.status >= 400, `같은 코드를 다시 쓸 수 있음(${replay.status})`);
  const r = await rpc('tools/list', {}, state.conn.access);
  check(r.status === 401, `코드 재사용 뒤에도 기존 토큰이 통과함: ${r.status}`);
});

await kase('MCP: 승인한 AI 연결이 연결 목록에 보이고, 해제하면 토큰이 거절된다', async () => {
  const conn = await connectClient('sources:read');
  const before = await rpc('tools/list', {}, conn.access);
  check(before.status === 200, `해제 전 토큰이 거절됨: ${before.status}`);
  await go('/ai-connections', 3000);
  check(/E2E 클라이언트/.test(await bodyText()), '연결 목록에 클라이언트가 없음');
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.innerText.trim() === '연결 해제')?.click());
  await clickWhenEnabled('연결 해제 확정');
  await sleep(2500);
  const after = await rpc('tools/list', {}, conn.access);
  check(after.status === 401, `해제 뒤에도 토큰이 통과함: ${after.status}`);
});

// MCP 도구 결과(structuredContent 또는 text JSON)를 꺼낸다.
const toolData = r => {
  const res = r.json?.result;
  if (res?.structuredContent) return res.structuredContent;
  const text = res?.content?.find(c => c.type === 'text')?.text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

await kase('MCP: 읽기·댓글 범위로 연결해 보고서를 읽고 댓글을 남긴다', async () => {
  const conn = await connectClient('reports:read comments:read comments:write', { approveAll: true });
  check(/comments:write/.test(conn.scope), `쓰기 범위가 승인되지 않음: ${conn.scope}`);
  const tools = (await rpc('tools/list', {}, conn.access)).json?.result?.tools?.map(t => t.name) || [];
  check(tools.includes('vm_add_comment') && tools.includes('vm_read_report'), `도구 목록: ${tools.join(',')}`);
  check(!tools.includes('vm_share_report'), '승인하지 않은 공유 도구가 보임');

  const list = toolData(await rpc('tools/call', { name: 'vm_list_reports', arguments: {} }, conn.access));
  const items = list?.reports || list?.items || (Array.isArray(list) ? list : []);
  const mine = items.find(r => (r.id || r.reportId) === state.reportId) || items.find(r => /검증 보고서/.test(r.title || ''));
  check(mine, `보고서 목록에 방금 만든 보고서가 없음: ${JSON.stringify(list).slice(0, 240)}`);

  const read = toolData(await rpc('tools/call', { name: 'vm_read_report', arguments: { reportId: mine.id || mine.reportId } }, conn.access));
  const text = JSON.stringify(read);
  check(text.includes(fmt(TOTAL)) || text.includes('총 매출'), `보고서 본문을 읽지 못함: ${text.slice(0, 240)}`);
  const version = read.version ?? mine.version;

  const body = `e2e MCP 댓글 ${Math.floor(Math.random() * 1e6)}`;
  const added = await rpc('tools/call', {
    name: 'vm_add_comment',
    arguments: { reportId: mine.id || mine.reportId, version, anchor: { kind: 'text', quote: '총 매출' }, body, requestId: crypto.randomUUID(), confirmWrite: true },
  }, conn.access);
  check(added.status === 200 && !added.json?.result?.isError, `댓글 쓰기 실패: ${added.text}`);

  const threads = toolData(await rpc('tools/call', { name: 'vm_list_comments', arguments: { reportId: mine.id || mine.reportId } }, conn.access));
  check(JSON.stringify(threads).includes(body), `남긴 댓글이 목록에 없음: ${JSON.stringify(threads).slice(0, 240)}`);
  state.mcpComment = body;
  state.mcpReportId = mine.id || mine.reportId;
});

await kase('MCP: AI 가 남긴 댓글이 앱의 보고서 화면에 보인다', async () => {
  check(state.mcpReportId && state.mcpComment, '앞 케이스가 댓글을 남기지 않음');
  await go(`/reports/${state.reportId}/read`, 3500);
  let t = await bodyText();
  if (!t.includes(state.mcpComment)) {
    // 댓글 패널이 접혀 있으면 펼친다.
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => /댓글/.test(b.innerText))?.click());
    await sleep(1500);
    t = await bodyText();
  }
  check(t.includes(state.mcpComment), `보고서 화면에 MCP 댓글이 없음: ${t.slice(0, 300)}`);
});

// ============================================================================================
// 8. 서버 AI 없이 동작, 내 작업물 삭제
// --- 대시보드 도구(dashboards:*) ---------------------------------------------------------------
// 도구를 부르고 결과(또는 {error})를 돌려준다. 오류는 isError 와 data.error 로 나온다.
async function tool(conn, name, args = {}) {
  const r = await rpc('tools/call', { name, arguments: args }, conn.access);
  const data = toolData(r);
  return { status: r.status, isError: !!r.json?.result?.isError, data, error: data && typeof data === 'object' ? data.error : undefined, text: r.text };
}
const dash = {};

await kase('MCP: 광고하는 범위는 설정된 클라이언트 범위의 합집합이고, 좁은 클라이언트는 넓은 범위를 받지 못한다', async () => {
  const meta = await api('GET', '/.well-known/oauth-protected-resource/v1/mcp');
  check(meta.status === 200, `보호 리소스 메타데이터 ${meta.status}`);
  const advertised = [...(meta.json?.scopes_supported || [])].sort();
  const configured = [...new Set([...MCP.scopes, ...MCP.narrowScopes])].sort();
  check(JSON.stringify(advertised) === JSON.stringify(configured), `광고 범위가 설정의 합집합이 아님: ${advertised.join(',')} / ${configured.join(',')}`);
  check(advertised.includes('dashboards:write') && advertised.includes('dashboards:delete'), '대시보드 범위가 광고되지 않음');
  const authz = scope => {
    const q = new URLSearchParams({ response_type: 'code', client_id: MCP.narrowId, redirect_uri: MCP.redirect, state: 'x', code_challenge: 'a'.repeat(43), code_challenge_method: 'S256', resource: MCP_RESOURCE, scope });
    return api('GET', `/v1/mcp-oauth/authorize?${q}`);
  };
  const wide = await authz('sources:read dashboards:write');
  check(wide.status >= 400 && /invalid_scope/.test(JSON.stringify(wide.json)), `좁은 클라이언트가 넓은 범위를 받음: ${wide.status} ${JSON.stringify(wide.json).slice(0, 160)}`);
});

await kase('MCP: 대시보드 범위는 기본 해제이고, 읽기만 승인하면 쓰기·삭제 도구는 보이지 않는다', async () => {
  const conn = await connectClient('dashboards:read dashboards:write dashboards:delete', { expectWriteUnchecked: true });
  check(/dashboards:read/.test(conn.scope) && !/dashboards:write|dashboards:delete/.test(conn.scope), `읽기만 승인되어야 함: ${conn.scope}`);
  const names = ((await rpc('tools/list', {}, conn.access)).json?.result?.tools || []).map(t => t.name).sort();
  check(JSON.stringify(names) === JSON.stringify(['vm_list_dashboards', 'vm_read_dashboard']), `읽기 범위의 도구가 정확하지 않음: ${names.join(',')}`);
  const mine = await tool(conn, 'vm_list_dashboards');
  check(!mine.isError && (mine.data?.dashboards || []).some(d => d.dashboardId === state.dashboardId), `내 대시보드 목록에 #${state.dashboardId} 가 없음: ${mine.text}`);
});

await kase('MCP: 저장 지표를 찾아 미리보기하고, 같은 값으로 대시보드를 만들면 앱 목록에 열린다', async () => {
  dash.conn = await connectClient('sources:read dashboards:read dashboards:write dashboards:delete', { approveAll: true });
  check(/dashboards:write/.test(dash.conn.scope) && /dashboards:delete/.test(dash.conn.scope), `쓰기·삭제 범위가 승인되지 않음: ${dash.conn.scope}`);
  const names = ((await rpc('tools/list', {}, dash.conn.access)).json?.result?.tools || []).map(t => t.name);
  for (const need of ['vm_list_metrics', 'vm_preview_dashboard', 'vm_create_dashboard', 'vm_update_dashboard', 'vm_restore_dashboard', 'vm_get_dashboard_removal', 'vm_remove_dashboard'])
    check(names.includes(need), `${need} 도구가 없음: ${names.join(',')}`);

  const sources = await tool(dash.conn, 'vm_list_sources');
  const list = sources.data?.sources || sources.data?.items || (Array.isArray(sources.data) ? sources.data : []);
  const sales = (state.sourceId && list.find(x => (x.id ?? x.sourceId) === state.sourceId)) || list.find(x => /sales/.test(x.name || ''));
  check(sales, `sales 소스를 찾지 못함: ${sources.text}`);
  dash.sourceId = sales.id ?? sales.sourceId;
  const described = await tool(dash.conn, 'vm_describe_source', { sourceId: dash.sourceId });
  check((described.data?.columns || []).every(c => typeof c.numeric === 'boolean' && typeof c.temporal === 'boolean'), `열 설명에 numeric/temporal 이 없음: ${described.text}`);

  const metrics = await tool(dash.conn, 'vm_list_metrics', { sourceId: dash.sourceId });
  check(!metrics.isError, `지표 목록 실패: ${metrics.text}`);
  const metric = (metrics.data?.metrics || []).find(m => m.label === '총 매출') || (metrics.data?.metrics || [])[0];
  check(metric && Number.isInteger(metric.id) && metric.definitionVersion !== undefined, `저장 지표를 찾지 못함: ${metrics.text}`);
  const allowedKeys = ['id', 'definitionVersion', 'label', 'aggregation', 'column', 'denominatorColumn', 'weightColumn', 'scale', 'unit', 'decimalPlaces', 'numberNotation'];
  for (const m of metrics.data.metrics) check(Object.keys(m).every(k => allowedKeys.includes(k)), `지표 목록에 허용하지 않은 키가 있음: ${Object.keys(m).join(',')}`);
  dash.blocks = [{ title: 'MCP 총 매출', kind: 'BOARD_NUMERIC', metric: { id: metric.id, definitionVersion: metric.definitionVersion } }];
  dash.title = `MCP 대시보드 ${Math.floor(Math.random() * 1e6)}`;

  const preview = await tool(dash.conn, 'vm_preview_dashboard', { sourceId: dash.sourceId, title: dash.title, blocks: dash.blocks });
  check(!preview.isError && /^[a-f0-9]{64}$/.test(preview.data?.previewDigest || ''), `미리보기 실패: ${preview.text}`);
  const block = preview.data.blocks[0];
  const value = Number(block.rows?.[0]?.[block.valueField]);
  check(Math.abs(value - TOTAL) < 0.01, `미리보기 값 ${value} 이 CSV 합계 ${TOTAL} 와 다름`);
  check(!/SELECT|FROM /i.test(JSON.stringify(preview.data)), '미리보기에 쿼리 문장이 들어 있음');

  dash.requestId = crypto.randomUUID();
  const create = args => tool(dash.conn, 'vm_create_dashboard', { sourceId: dash.sourceId, title: dash.title, blocks: dash.blocks, previewDigest: preview.data.previewDigest, expectedSourceRevision: preview.data.sourceRevision, requestId: dash.requestId, confirmWrite: true, ...args });
  const created = await create();
  check(!created.isError && Number.isInteger(created.data?.dashboardId), `생성 실패: ${created.text}`);
  dash.id = created.data.dashboardId;
  const again = await create();
  check(!again.isError && again.data.dashboardId === dash.id, `같은 요청 ID 재시도가 같은 대시보드를 돌려주지 않음: ${again.text}`);
  const other = await create({ title: `${dash.title} 다름` });
  check(other.isError && other.error?.code === 'REQUEST_REUSED', `다른 입력의 같은 요청 ID 가 REQUEST_REUSED 가 아님: ${other.text}`);
  const stale = await tool(dash.conn, 'vm_create_dashboard', { sourceId: dash.sourceId, title: `${dash.title} 변경`, blocks: dash.blocks, previewDigest: preview.data.previewDigest, expectedSourceRevision: preview.data.sourceRevision, requestId: crypto.randomUUID(), confirmWrite: true });
  check(stale.isError && stale.error?.detail?.reason === 'PREVIEW_STALE', `바뀐 입력이 PREVIEW_STALE 로 거절되지 않음: ${stale.text}`);

  const token = await tokenFor(GUEST.id, GUEST.pw);
  const mine = await api('GET', '/v1/dashboard', undefined, token);
  check((mine.json?.data || []).some(d => d.id === dash.id), `앱 대시보드 목록에 MCP 가 만든 #${dash.id} 가 없음`);
  await go('/dashboard', 3500);
  check((await bodyText()).includes(dash.title), '아티팩트 목록 화면에 MCP 대시보드가 보이지 않음');
});

await kase('MCP: AI 가 제목을 고치면 앱에 반영되고, 이력에 AI 연결 이름과 직전 상태가 남고, 복원이 되돌린다', async () => {
  check(dash.id, '앞 케이스가 대시보드를 만들지 않음');
  const read = await tool(dash.conn, 'vm_read_dashboard', { dashboardId: dash.id });
  check(!read.isError && read.data.document?.blocks?.length === 1, `읽기 실패: ${read.text}`);
  const renamed = `${dash.title} 수정`;
  dash.updateId = crypto.randomUUID();
  const update = args => tool(dash.conn, 'vm_update_dashboard', { dashboardId: dash.id, expectedRevision: read.data.revision, expectedSourceRevision: read.data.sourceRevision, changes: [{ type: 'renameDashboard', title: renamed }], requestId: dash.updateId, confirmWrite: true, ...args });
  const changed = await update();
  check(!changed.isError && changed.data.changed === true && changed.data.revision !== read.data.revision, `수정 실패: ${changed.text}`);
  const retry = await update();
  check(!retry.isError && retry.data.revision === changed.data.revision, `수정 재시도가 첫 응답과 다름: ${retry.text}`);

  const token = await tokenFor(GUEST.id, GUEST.pw);
  const mine = await api('GET', '/v1/dashboard', undefined, token);
  check((mine.json?.data || []).some(d => d.id === dash.id && d.title === renamed), '앱 목록에 수정한 제목이 반영되지 않음');

  const stale = await update({ requestId: crypto.randomUUID(), expectedRevision: read.data.revision });
  check(stale.isError && stale.error?.code === 'CONFLICT' && stale.error?.detail?.reason === 'REVISION_CHANGED', `낡은 revision 이 REVISION_CHANGED 로 거절되지 않음: ${stale.text}`);
  const rule = await update({ requestId: crypto.randomUUID(), expectedRevision: changed.data.revision, changes: [{ type: 'addBlock', block: { id: 'new:x' } }] });
  check(rule.isError && rule.error?.code === 'INVALID' && rule.error?.detail?.reason === 'UNSUPPORTED_CHANGE', `블록 추가가 UNSUPPORTED_CHANGE 로 거절되지 않음: ${rule.text}`);

  const after = await tool(dash.conn, 'vm_read_dashboard', { dashboardId: dash.id });
  const history = after.data.history || [];
  const ai = history.find(h => h.operation === 'save' && h.authorKind === 'external-ai');
  const created = history.find(h => h.operation === 'create');
  check(ai && ai.clientName === 'E2E 클라이언트', `이력에 AI 연결 이름이 없음: ${JSON.stringify(history).slice(0, 300)}`);
  // MCP 로 만든 대시보드는 생성 행이 이미 쓰기 직전 상태이므로 기준(baseline) 행이 따로 쌓이지 않는다. baseline 은 단위 테스트가 본다.
  check(created && created.authorKind === 'external-ai' && created.clientName === 'E2E 클라이언트', `생성 행이 AI 작성으로 남지 않음: ${JSON.stringify(history).slice(0, 300)}`);
  check(!history.some(h => h.operation === 'baseline'), `직전 상태가 이력에 있는데 baseline 이 또 쌓임: ${JSON.stringify(history).slice(0, 300)}`);
  check(!/studioDocument|aiGrantId|actorId/.test(JSON.stringify(history)), '이력 요약에 내부 값이 들어 있음');

  const restored = await tool(dash.conn, 'vm_restore_dashboard', { dashboardId: dash.id, revisionId: created.revisionId, expectedRevision: after.data.revision, requestId: crypto.randomUUID(), confirmWrite: true });
  check(!restored.isError && restored.data.changed === true, `복원 실패: ${restored.text}`);
  const mine2 = await api('GET', '/v1/dashboard', undefined, token);
  check((mine2.json?.data || []).some(d => d.id === dash.id && d.title === dash.title), '복원 뒤 앱 목록의 제목이 원래대로 돌아오지 않음');
  const final = await tool(dash.conn, 'vm_read_dashboard', { dashboardId: dash.id });
  check((final.data.history || []).some(h => h.operation === 'restore' && h.authorKind === 'external-ai'), '복원도 이력에 남아야 함');
});

await kase('MCP: 게시가 걸린 대시보드는 삭제가 사용처 목록과 함께 거절되고, 사용처 없는 내 대시보드는 삭제된다', async () => {
  check(dash.id && state.dashboardId, '앞 케이스가 돌지 않음');
  const used = await tool(dash.conn, 'vm_get_dashboard_removal', { dashboardId: state.dashboardId });
  check(!used.isError && used.data.canDelete === false && (used.data.dependencies || []).some(d => d.count > 0), `게시한 대시보드의 사용처가 보이지 않음: ${used.text}`);
  const refused = await tool(dash.conn, 'vm_remove_dashboard', { dashboardId: state.dashboardId, expectedRevision: used.data.revision, requestId: crypto.randomUUID(), confirmWrite: true });
  check(refused.isError && refused.error?.detail?.reason === 'HAS_DEPENDENCIES' && refused.error?.retryable === false && Array.isArray(refused.error?.detail?.dependencies), `사용처가 있는데 삭제가 거절되지 않거나 목록이 없음: ${refused.text}`);
  const token = await tokenFor(GUEST.id, GUEST.pw);
  check(((await api('GET', '/v1/dashboard', undefined, token)).json?.data || []).some(d => d.id === state.dashboardId), '거절된 삭제인데 대시보드가 사라짐');

  const free = await tool(dash.conn, 'vm_get_dashboard_removal', { dashboardId: dash.id });
  check(!free.isError && free.data.canDelete === true, `사용처 없는 대시보드가 삭제 불가로 나옴: ${free.text}`);
  const request = { dashboardId: dash.id, expectedRevision: free.data.revision, requestId: crypto.randomUUID(), confirmWrite: true };
  const removed = await tool(dash.conn, 'vm_remove_dashboard', request);
  check(!removed.isError && removed.data.deleted === true && removed.data.replayed === false, `삭제 실패: ${removed.text}`);
  const replay = await tool(dash.conn, 'vm_remove_dashboard', request);
  check(!replay.isError && replay.data.replayed === true, `삭제 재시도가 영수증으로 응답되지 않음: ${replay.text}`);
  check(!((await api('GET', '/v1/dashboard', undefined, token)).json?.data || []).some(d => d.id === dash.id), '삭제한 대시보드가 앱 목록에 남아 있음');
  const gone = await tool(dash.conn, 'vm_read_dashboard', { dashboardId: dash.id });
  check(gone.isError && ['FORBIDDEN', 'NOT_FOUND'].includes(gone.error?.code), `삭제한 대시보드의 읽기가 FORBIDDEN/NOT_FOUND 로 거절되지 않음: ${gone.text}`);
});

await kase('MCP: 연결을 해제하면 대시보드 쓰기 도구가 즉시 401 이다', async () => {
  check(dash.conn, '앞 케이스가 연결하지 않음');
  // 연결이 여러 개 있으므로 삭제 범위를 가진 연결 하나만 골라 해제한다.
  const token = await tokenFor(GUEST.id, GUEST.pw);
  const listed = await api('GET', '/v1/ai-connections', undefined, token);
  const target = (listed.json?.data?.connections || listed.json?.connections || []).find(c => (c.scopes || []).includes('dashboards:delete') && !c.revoked);
  check(target, `삭제 범위를 가진 연결을 찾지 못함: ${JSON.stringify(listed.json).slice(0, 240)}`);
  const off = await api('POST', `/v1/ai-connections/${encodeURIComponent(target.id)}/disconnect`, {}, token);
  check(off.status >= 200 && off.status < 300, `연결 해제 실패: ${off.status} ${JSON.stringify(off.json).slice(0, 160)}`);
  const r = await rpc('tools/call', { name: 'vm_create_dashboard', arguments: { sourceId: dash.sourceId, title: 'x', blocks: dash.blocks, previewDigest: 'a'.repeat(64), expectedSourceRevision: 'b'.repeat(64), requestId: crypto.randomUUID(), confirmWrite: true } }, dash.conn.access);
  check(r.status === 401, `해제 뒤에도 쓰기 도구가 통과함: ${r.status} ${r.text}`);
});


// ============================================================================================
await kase('AI 없음: 서버 AI 가 없으면 AI 제안만 꺼지고 안내가 나온다', async () => {
  await go('/studio/new', 3000);
  const t = await bodyText();
  check(/AI가 아직 연결되지 않았습니다/.test(t), `AI 미연결 안내가 없음: ${t.slice(0, 300)}`);
  check((await buttonState('지표와 차트 제안')) === 'disabled', 'AI 가 없는데 제안 버튼이 활성화됨');
  const status = await api('GET', '/v1/ai/status', undefined, await tokenFor(GUEST.id, GUEST.pw));
  check(status.status === 200 && status.json?.data?.configured === false, `서버 AI 가 꺼져 있다고 보고해야 함: ${JSON.stringify(status.json).slice(0, 160)}`);
});

// 숫자 카드 대시보드를 하나 더 만든다(삭제 시험용).
async function makeNumericDashboard(title) {
  await go(`/explore?sourceId=${state.sourceId}`, 3500);
  await setAfterLabel('저장된 지표', '총 매출');
  await sleep(800);
  await setAfterLabel('차트 제목', title, 'input');
  await clickWhenEnabled('결과 미리보기');
  await waitText(new RegExp(fmt(TOTAL)), 20000);
  await clickWhenEnabled('대시보드 저장');
  await page.waitForURL(/\/dashboard\/\d+$/, { timeout: 20000 });
  return Number((await page.url()).match(/\/dashboard\/(\d+)/)[1]);
}
const dialogText = () => page.evaluate(() => (document.querySelector('[role=dialog]')?.innerText || '').replace(/\s+/g, ' '));

await kase('삭제: 게시가 걸린 대시보드는 삭제가 막히고 실제 DELETE 도 거절된다', async () => {
  const token = await tokenFor(GUEST.id, GUEST.pw);
  const impact = await api('GET', `/v1/dashboard/${state.dashboardId}/delete-impact`, undefined, token);
  const info = impact.json?.data;
  check(impact.status === 200 && info, `삭제 영향 조회 ${impact.status}`);
  check(info.canDelete === false, `게시된 대시보드인데 삭제 가능으로 나옴: ${JSON.stringify(info).slice(0, 200)}`);
  check(info.dependencies.some(d => /Publications$/.test(d.kind) && d.count > 0), `게시 의존성이 집계되지 않음: ${JSON.stringify(info.dependencies)}`);
  // 화면: 삭제 대화상자가 열리고, 사용처 경고가 보이며, 삭제 버튼이 비활성이다.
  await go(`/dashboard/${state.dashboardId}`, 3500);
  await page.click('loc=css:button[aria-label="대시보드 삭제"]');
  await waitText(/사용처 설정이 남아 있어 삭제할 수 없습니다/, 15000);
  const dialogDelete = await page.evaluate(() => {
    const b = [...document.querySelectorAll('[role=dialog] button')].find(x => x.innerText.trim() === '대시보드 삭제');
    return b ? (b.disabled ? 'disabled' : 'enabled') : 'missing';
  });
  check(dialogDelete === 'disabled', `의존성이 있는데 대화상자의 삭제 버튼이 '${dialogDelete}' (비활성이어야 함)`);
  await page.keyboard.press('Escape');
  // 서버: 형식이 올바른 확정 요청을 직접 보내도 의존성 때문에 409 로 거절된다(400 형식 오류와 구분).
  const del = await api('DELETE', `/v1/dashboard/${state.dashboardId}`, {
    requestId: crypto.randomUUID(),
    expectedRevision: info.revision,
    expectedActorId: info.actorId,
    expectedOrganizationId: info.organizationId,
  }, token);
  check(del.status === 409 && /사용처가 남아 있습니다/.test(JSON.stringify(del.json)), `의존성 거절(409 사용처가 남아 있습니다)이어야 함: ${del.status} ${JSON.stringify(del.json).slice(0, 200)}`);
  const still = await api('GET', '/v1/dashboard', undefined, token);
  check((still.json?.data || []).some(d => d.id === state.dashboardId), '의존성이 있는 대시보드가 사라짐');
});

await kase('삭제: 의존성이 없는 내 대시보드는 삭제하면 목록에서 사라진다', async () => {
  const id = await makeNumericDashboard('삭제 시험');
  await sleep(2500);
  await page.click('loc=css:button[aria-label="대시보드 삭제"]');
  await sleep(2500);
  const dlg = await dialogText();
  check(dlg.length > 0, '삭제 대화상자가 열리지 않음');
  const clicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('[role=dialog] button')].find(x => /^(삭제|삭제 확정|대시보드 삭제)$/.test(x.innerText.trim()));
    if (!b) return `버튼 없음: ${[...document.querySelectorAll('[role=dialog] button')].map(x => x.innerText.trim()).join('/')}`;
    if (b.disabled) return '삭제 버튼이 비활성';
    b.click();
    return 'ok';
  });
  check(clicked === 'ok', `${clicked} (대화상자: ${dlg.slice(0, 200)})`);
  await sleep(3500);
  const token = await tokenFor(GUEST.id, GUEST.pw);
  const after = await api('GET', '/v1/dashboard', undefined, token);
  check(!(after.json?.data || []).some(d => d.id === id), `삭제한 대시보드 #${id} 가 목록에 남아 있음`);
});

// ============================================================================================
// 결과
// ============================================================================================
await clearSession().catch(() => {});
const failed = results.filter(r => !r.ok);
console.log('');
console.log(`E2E_RESULT total=${results.length} pass=${results.length - failed.length} fail=${failed.length}`);
for (const f of failed) console.log(`  FAIL ${f.name}: ${f.why}`);
await task.finish({ keep: [] }).catch(() => {});
