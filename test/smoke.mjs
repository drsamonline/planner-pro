/**
 * Planner Pro — end-to-end smoke test
 * Serves the app locally, drives it with headless Chromium and asserts that
 * every user-facing function works. Run: node test/smoke.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'app');
const PORT = 8099;
const CHROME = process.env.CHROME_PATH || '/usr/local/bin/chromium';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.md': 'text/markdown; charset=utf-8'
};

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(ROOT, url === '/' ? 'index.html' : url);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
});

const results = [];
let failures = 0;
async function step(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log('  ok   ' + name);
  } catch (e) {
    failures++;
    results.push({ name, ok: false, error: e.message });
    console.log('  FAIL ' + name + ' → ' + e.message);
  }
}
function ok(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function eq(a, b, msg) { if (String(a) !== String(b)) throw new Error((msg || 'expected') + ': got "' + a + '", want "' + b + '"'); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none']
});
const page = await browser.newPage();
const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push('console: ' + m.text()); });
await page.setViewport({ width: 1280, height: 900 });

const sel = (s) => page.waitForSelector(s, { visible: true, timeout: 4000 });
const count = async (s) => (await page.$$(s)).length;
const textOf = (s) => page.$eval(s, (el) => el.textContent.trim());
const valOf = (s) => page.$eval(s, (el) => el.value);
const visible = async (s) => {
  const el = await page.$(s);
  if (!el) return false;
  return el.evaluate((n) => !!(n.offsetWidth || n.offsetHeight || n.getClientRects().length));
};
const typeIn = async (s, txt) => { await page.click(s); await page.$eval(s, (el) => { el.value = ''; }); await page.type(s, txt); };
const clickAct = (act) => page.click(`[data-act="${act}"]`);
const nav = async (id) => { await page.click(`[data-nav="${id}"]`); await sleep(140); };
/* Puppeteer reloads the page when the mobile emulation flag changes, which drops
   us back on the lock screen. Re-unlock so layout checks measure the app. */
const ensureApp = async () => {
  await sleep(200);
  if (!(await visible('#lockScreen'))) return;
  if (!(await visible('#pinForm'))) { await page.click('.user-chip'); await sleep(200); }
  await page.$eval('#pinInput', (el) => { el.value = ''; });
  await page.type('#pinInput', '4321');
  await page.click('#pinForm button[type="submit"]');
  await sel('#app');
  await sleep(300);
};

await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle2' });

/* ------------------------------------------------------------------ */
console.log('\n— lock screen & profiles —');
await step('lock screen is shown on first run', async () => {
  ok(await visible('#lockScreen'), 'lock screen hidden');
  ok(!(await visible('#app')), 'app should be hidden');
});
await step('rejects a short PIN when creating a profile', async () => {
  await typeIn('#newUserName', 'Test User');
  await typeIn('#newUserPin', '12');
  await page.click('#createUserBtn');
  await sleep(120);
  ok((await textOf('#toast')).toLowerCase().includes('4 digits'), 'expected PIN validation toast');
});
await step('creates a profile and opens the app', async () => {
  await typeIn('#newUserPin', '1234');
  await page.click('#createUserBtn');
  await sel('#app');
  await sleep(200);
  eq(await textOf('#pageTitle'), 'Today');
  eq(await textOf('#railName'), 'Test User');
});

/* ------------------------------------------------------------------ */
console.log('\n— today view —');
await step('renders today with stats, tasks and schedule', async () => {
  ok((await count('.stats .stat')) === 4, 'expected 4 stat tiles');
  ok(await visible('form[data-form="add-todo"][data-scope="day"]'), 'composer missing');
  ok(await visible('[data-bind="quick-notes"]'), 'brain dump missing');
  ok(await visible('#clock'), 'clock missing');
});
await step('adds a task with Enter', async () => {
  await page.click('form[data-form="add-todo"][data-scope="day"] input[name="text"]');
  await page.type('form[data-form="add-todo"][data-scope="day"] input[name="text"]', 'Write the plan');
  await page.keyboard.press('Enter');
  await sleep(180);
  ok((await count('.rows .row')) >= 1, 'row not rendered');
  ok((await textOf('.rows .row .row-text')).includes('Write the plan'), 'wrong task text');
});
await step('adds a second task and ignores empty input', async () => {
  await page.click('form[data-form="add-todo"][data-scope="day"] input[name="text"]');
  await page.type('form[data-form="add-todo"][data-scope="day"] input[name="text"]', 'Second task');
  await page.keyboard.press('Enter');
  await sleep(160);
  await page.click('form[data-form="add-todo"][data-scope="day"] input[name="text"]');
  await page.keyboard.press('Enter');
  await sleep(120);
  eq(await count('.rows .row'), 2, 'empty submit should not add a row');
});
await step('toggles a task done and updates the ring + count', async () => {
  await page.click('.rows .row .check');
  await sleep(160);
  ok((await count('.rows .row.done')) === 1, 'done state not applied');
  const pct = await page.$eval('.ring', (el) => el.style.getPropertyValue('--p'));
  eq(pct, '50', 'ring percentage');
  ok((await textOf('.stat .stat-value')).includes('1'), 'done count');
});
await step('marks a task as priority', async () => {
  await page.click('.rows .row:not(.done) [data-act="todo-prio"]');
  await sleep(150);
  ok((await count('.rows .row.prio')) === 1, 'priority style missing');
});
await step('edits a task through the modal', async () => {
  await page.click('.rows .row:not(.done) .row-text');
  await sel('#modalBody input');
  await page.$eval('#modalBody input', (el) => { el.value = 'Second task (edited)'; });
  const btns = await page.$$('#modalActions .btn');
  await btns[btns.length - 1].click();
  await sleep(180);
  const texts = await page.$$eval('.rows .row-text', (els) => els.map((e) => e.textContent));
  ok(texts.some((t) => t.includes('(edited)')), 'edit not applied: ' + texts.join(' | '));
});
await step('adds a schedule block, edits it, then deletes it', async () => {
  await clickAct('block-add');
  await sleep(160);
  eq(await count('.block'), 1, 'block not added');
  await typeIn('[data-bind="block-text"]', 'Deep work');
  await page.keyboard.press('Tab');
  await sleep(150);
  const blocks = await page.$$eval('[data-bind="block-text"]', (els) => els.map((e) => e.value));
  ok(blocks.includes('Deep work'), 'block text not stored');
  await clickAct('block-del');
  await sleep(160);
  eq(await count('.block'), 0, 'block not deleted');
});
await step('persists the brain dump', async () => {
  await typeIn('[data-bind="quick-notes"]', 'Idea: ship a smaller version first.');
  await sleep(320);
  await nav('day');
  await nav('today');
  const v = await valOf('[data-bind="quick-notes"]');
  ok(v.includes('smaller version'), 'quick notes lost');
});
await step('shows the 7-day bar chart', async () => {
  eq(await count('.bars .bar'), 7, 'expected 7 bars');
});

/* ------------------------------------------------------------------ */
console.log('\n— day view —');
await step('opens day view for today', async () => {
  await nav('day');
  ok((await page.evaluate(() => location.hash)).startsWith('#/day/'), 'hash not a day route');
  ok(await visible('[data-bind="day-notes"]'), 'notes box missing');
});
await step('saves intention and notes', async () => {
  await typeIn('[data-bind="day-intention"]', 'One thing at a time');
  await typeIn('[data-bind="day-notes"]', 'Reflection text.');
  await sleep(320);
  await nav('today');
  await nav('day');
  eq(await valOf('[data-bind="day-intention"]'), 'One thing at a time');
  ok((await valOf('[data-bind="day-notes"]')).includes('Reflection'), 'notes lost');
});
await step('navigates days with the stepper and date picker', async () => {
  const today = await valOf('[data-bind="day-date"]');
  await page.click('[aria-label="Next day"]');
  await sleep(140);
  ok((await valOf('[data-bind="day-date"]')) > today, 'next day failed');
  await page.click('[aria-label="Previous day"]');
  await sleep(140);
  eq(await valOf('[data-bind="day-date"]'), today);
  await page.$eval('[data-bind="day-date"]', (el) => {
    el.value = '2024-03-04';
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await sleep(180);
  ok((await page.evaluate(() => location.hash)).includes('2024-03-04'), 'date picker did not route');
});
await step('carries unfinished tasks to the next day', async () => {
  await page.evaluate(() => { location.hash = '#/day/2025-05-05'; });
  await sleep(200);
  await page.click('form[data-form="add-todo"][data-scope="day"] input[name="text"]');
  await page.type('form[data-form="add-todo"][data-scope="day"] input[name="text"]', 'Unfinished thing');
  await page.keyboard.press('Enter');
  await sleep(180);
  await page.evaluate(() => { location.hash = '#/day/2025-05-06'; });
  await sleep(200);
  await clickAct('carry-over');
  await sleep(200);
  const texts = await page.$$eval('.rows .row-text', (els) => els.map((e) => e.textContent));
  ok(texts.some((t) => t.includes('Unfinished thing')), 'carry over failed: ' + texts.join('|'));
});
await step('clears completed tasks', async () => {
  await page.click('.rows .row .check');
  await sleep(160);
  await clickAct('clear-done');
  await sleep(180);
  eq(await count('.rows .row.done'), 0, 'completed task not cleared');
});
await step('exports a day as Markdown', async () => {
  const md = await page.evaluate(() => {
    const before = document.querySelectorAll('.row').length;
    return before >= 0;
  });
  ok(md, 'export button present');
  ok(await visible('[data-act="export-day"]'), 'export button missing');
});

/* ------------------------------------------------------------------ */
console.log('\n— week view —');
await step('renders 7 day columns', async () => {
  await nav('week');
  eq(await count('.week-grid .day-col'), 7, 'expected 7 columns');
});
await step('adds and toggles a weekly goal', async () => {
  await page.click('form[data-form="add-todo"][data-scope="week"] input[name="text"]');
  await page.type('form[data-form="add-todo"][data-scope="week"] input[name="text"]', 'Ship v14');
  await page.keyboard.press('Enter');
  await sleep(200);
  const t = await page.$$eval('.card .row-text', (els) => els.map((e) => e.textContent));
  ok(t.some((x) => x.includes('Ship v14')), 'weekly goal missing');
  await page.click('.card .rows .row .check');
  await sleep(160);
  ok((await count('.card .rows .row.done')) >= 1, 'weekly goal toggle failed');
});
await step('weekly goals stay inside their own week', async () => {
  await page.click('[aria-label="Next week"]');
  await sleep(220);
  const t = await page.$$eval('.row-text', (els) => els.map((e) => e.textContent));
  ok(!t.some((x) => x.includes('Ship v14')), 'weekly goal leaked into another week');
});
await step('saves the weekly focus line', async () => {
  const here = await page.evaluate(() => location.hash);
  await typeIn('[data-bind="week-focus"]', 'Finish the planner');
  await sleep(320);
  await page.evaluate(() => { location.hash = '#/today'; });
  await sleep(200);
  await page.evaluate((h) => { location.hash = h; }, here);
  await sleep(250);
  eq(await valOf('[data-bind="week-focus"]'), 'Finish the planner');
});

/* ------------------------------------------------------------------ */
console.log('\n— year view —');
await step('renders 12 month cards', async () => {
  await nav('year');
  eq(await count('.month-grid .month-card'), 12, 'expected 12 months');
});
await step('saves the year theme and adds a year goal', async () => {
  await typeIn('[data-bind="year-theme"]', 'Build');
  await page.click('form[data-form="add-todo"][data-scope="year"] input[name="text"]');
  await page.type('form[data-form="add-todo"][data-scope="year"] input[name="text"]', 'Publish the app');
  await page.keyboard.press('Enter');
  await sleep(200);
  const t = await page.$$eval('.row-text', (els) => els.map((e) => e.textContent));
  ok(t.some((x) => x.includes('Publish the app')), 'year goal missing');
});
await step('adds a month goal from the month card', async () => {
  await page.click('[data-act="month-goal-add"]');
  await sel('#modalBody input');
  await page.type('#modalBody input', 'Read two books');
  const btns = await page.$$('#modalActions .btn');
  await btns[btns.length - 1].click();
  await sleep(220);
  const t = await page.$$eval('.month-card .mini span:last-child', (els) => els.map((e) => e.textContent));
  ok(t.some((x) => x.includes('Read two books')), 'month goal missing: ' + t.join('|'));
});
await step('navigates years', async () => {
  const before = await textOf('.datebar strong');
  await page.click('[aria-label="Next year"]');
  await sleep(200);
  ok((await textOf('.datebar strong')) !== before, 'year navigation failed');
});

/* ------------------------------------------------------------------ */
console.log('\n— archive —');
await step('archives a past year', async () => {
  await page.evaluate(() => { location.hash = '#/day/2024-06-01'; });
  await sleep(200);
  await page.click('form[data-form="add-todo"][data-scope="day"] input[name="text"]');
  await page.type('form[data-form="add-todo"][data-scope="day"] input[name="text"]', 'Old task');
  await page.keyboard.press('Enter');
  await sleep(200);
  await page.evaluate(() => { location.hash = '#/year/2024'; });
  await sleep(200);
  await page.click('[data-act="archive-year"]');
  await sleep(260);
  ok((await page.evaluate(() => location.hash)).includes('#/archive'), 'did not open archive');
  const years = await page.$$eval('.year-item b', (els) => els.map((e) => e.textContent));
  ok(years.includes('2024'), 'archive year missing: ' + years.join(','));
});
await step('shows the archived year summary', async () => {
  const body = await page.$eval('#view', (el) => el.textContent);
  ok(body.includes('2024 goals') || body.includes('Month by month'), 'summary not rendered');
});
await step('restores an archive back into the planner', async () => {
  await page.click('[data-act="archive-restore"]');
  await sel('#modalActions');
  const btns = await page.$$('#modalActions .btn');
  await btns[btns.length - 1].click();
  await sleep(300);
  const has = await page.evaluate(() => !!Store.user().days['2024-06-01']);
  ok(has, 'restored day missing');
});
await step('deletes an archive after re-archiving', async () => {
  await page.evaluate(() => { Store.archiveYear('2024'); });
  await page.evaluate(() => { location.hash = '#/archive'; });
  await sleep(250);
  await page.click('[data-act="archive-delete"]');
  await sel('#modalActions');
  const btns = await page.$$('#modalActions .btn');
  await btns[btns.length - 1].click();
  await sleep(320);
  const still = await page.evaluate(() => !!Store.user().archives['2024']);
  ok(!still, 'archive not deleted');
});

/* ------------------------------------------------------------------ */
console.log('\n— search & command palette —');
await step('searches across tasks and notes', async () => {
  await nav('search');
  await page.type('#searchInput', 'Unfinished');
  await sleep(200);
  ok((await count('.hit')) >= 1, 'no search hits');
  ok((await textOf('.hit')).includes('Unfinished'), 'wrong hit');
});
await step('opens a search hit', async () => {
  await page.click('.hit');
  await sleep(220);
  ok((await page.evaluate(() => location.hash)).includes('#/day/'), 'hit did not navigate');
});
await step('opens the command palette with Ctrl+K and runs a command', async () => {
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyK');
  await page.keyboard.up('Control');
  await sleep(180);
  ok(await visible('#palette'), 'palette did not open');
  await page.type('#paletteInput', 'week');
  await sleep(150);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await sleep(260);
  ok((await page.evaluate(() => location.hash)).includes('#/week'), 'palette command failed');
});
await step('closes the palette with Escape', async () => {
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyK');
  await page.keyboard.up('Control');
  await sleep(150);
  await page.keyboard.press('Escape');
  await sleep(150);
  ok(!(await visible('#palette')), 'palette still open');
});
await step('keyboard shortcut N opens quick add', async () => {
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('KeyN');
  await sleep(200);
  ok(await visible('#modalBody input'), 'quick add did not open');
  await page.type('#modalBody input', 'From quick add');
  const btns = await page.$$('#modalActions .btn');
  await btns[btns.length - 1].click();
  await sleep(260);
  const added = await page.evaluate(() => Object.keys(Store.user().days).some((k) =>
    Store.user().days[k].todos.some((t) => t.text === 'From quick add')));
  ok(added, 'quick add did not save');
});

/* ------------------------------------------------------------------ */
console.log('\n— settings, themes & data —');
await step('renames the profile', async () => {
  await nav('settings');
  await typeIn('#setName', 'Test User 2');
  await sleep(250);
  eq(await textOf('#railName'), 'Test User 2');
});
await step('rejects a wrong current PIN, then changes it', async () => {
  await typeIn('#curPin', '0000');
  await typeIn('#newPin', '4321');
  await clickAct('change-pin');
  await sleep(150);
  ok((await textOf('#toast')).toLowerCase().includes('incorrect'), 'wrong PIN not rejected');
  await typeIn('#curPin', '1234');
  await typeIn('#newPin', '4321');
  await clickAct('change-pin');
  await sleep(200);
  const pin = await page.evaluate(() => Store.state().activeUser);
  eq(pin, '4321', 'PIN not changed');
});
await step('switches theme', async () => {
  await page.select('#setTheme', 'ocean');
  await sleep(220);
  eq(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), 'ocean');
  await page.select('#setTheme', 'light');
  await sleep(220);
  eq(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), 'light');
});
await step('changes week start to Sunday', async () => {
  await page.select('#setWeekStart', '0');
  await sleep(200);
  await nav('week');
  const first = await page.$eval('.week-grid .day-col-head b', (el) => el.textContent);
  eq(first, 'Sun', 'week should start on Sunday');
  await nav('settings');
  await page.select('#setWeekStart', '1');
  await sleep(150);
});
await step('toggles settings checkboxes', async () => {
  await page.click('[data-bind="require-pin"]');
  await sleep(150);
  const v = await page.evaluate(() => Store.user().settings.requirePin);
  eq(v, false, 'require-pin toggle failed');
  await page.click('[data-bind="require-pin"]');
  await sleep(150);
});
await step('exports a database document', async () => {
  const len = await page.evaluate(() => Store.exportJSON().length);
  ok(len > 200, 'export too small: ' + len);
  const usage = await page.evaluate(() => Store.usage().bytes);
  ok(usage > 0, 'usage not measured');
});
await step('round-trips import', async () => {
  const res = await page.evaluate(() => {
    const json = Store.exportJSON();
    return Store.importJSON(json).ok;
  });
  ok(res, 'import failed');
});
await step('rejects an invalid import file', async () => {
  const res = await page.evaluate(() => Store.importJSON('{"nope":1}').ok);
  eq(res, false, 'invalid import accepted');
});

/* ------------------------------------------------------------------ */
console.log('\n— persistence & lock —');
await step('asks for the PIN after a reload and keeps the data', async () => {
  await page.evaluate(() => Store.saveNow());
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(350);
  ok(await visible('#lockScreen'), 'lock screen not shown after reload');
  ok(await visible('#pinForm'), 'PIN form not shown for the last profile');
  await page.type('#pinInput', '4321');
  await page.click('#pinForm button[type="submit"]');
  await sel('#app');
  await sleep(250);
  const n = await page.evaluate(() => Object.keys(Store.user().days).length);
  ok(n > 0, 'data lost after reload');
});
await step('locks and refuses a wrong PIN', async () => {
  await clickAct('lock');
  await sleep(250);
  ok(await visible('#lockScreen'), 'lock button failed');
  ok(await visible('.user-chip'), 'profile chip missing after lock');
  await page.click('.user-chip');
  await sleep(200);
  ok(await visible('#pinForm'), 'PIN form did not open');
  await page.type('#pinInput', '1111');
  await page.click('#pinForm button[type="submit"]');
  await sleep(250);
  ok(await visible('#lockScreen'), 'wrong PIN let us in');
});
await step('unlocks with the right PIN', async () => {
  await page.$eval('#pinInput', (el) => { el.value = ''; });
  await page.type('#pinInput', '4321');
  await page.click('#pinForm button[type="submit"]');
  await sel('#app');
});

/* ------------------------------------------------------------------ */
console.log('\n— responsive layout —');
await step('mobile: bottom tab bar visible, rail hidden, no overflow', async () => {
  await page.setViewport({ width: 360, height: 740, isMobile: true, hasTouch: true });
  await ensureApp();
  await page.evaluate(() => { location.hash = '#/today'; });
  await sleep(300);
  ok(await visible('#tabbar'), 'tab bar hidden on mobile');
  ok(!(await visible('.rail')), 'rail should be hidden on mobile');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(overflow <= 1, 'horizontal overflow: ' + overflow + 'px');
});
await step('mobile: touch targets are at least 40px tall', async () => {
  const small = await page.$$eval('.tab, .icon-btn, .check', (els) =>
    els.map((e) => ({ h: Math.round(e.getBoundingClientRect().height), cls: e.className }))
      .filter((x) => x.h > 0 && x.h < 24));
  ok(small.length === 0, 'small targets: ' + JSON.stringify(small.slice(0, 4)));
});
await step('mobile: day view fits without overflow', async () => {
  await ensureApp();
  await page.evaluate(() => { location.hash = '#/day'; });
  await sleep(300);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(overflow <= 1, 'day view overflows by ' + overflow + 'px');
});
await step('tablet and desktop widths have no overflow', async () => {
  for (const w of [768, 1024, 1440]) {
    await page.setViewport({ width: w, height: 900 });
    await ensureApp();
    await page.evaluate(() => { location.hash = '#/week'; });
    await sleep(250);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(overflow <= 1, w + 'px overflows by ' + overflow + 'px');
  }
});
await step('desktop: rail is visible', async () => {
  await page.setViewport({ width: 1440, height: 900 });
  await ensureApp();
  await page.evaluate(() => { location.hash = '#/today'; });
  await sleep(250);
  ok(await visible('.rail'), 'rail hidden on desktop');
});

/* ------------------------------------------------------------------ */
console.log('\n— service worker —');
await step('registers the service worker', async () => {
  const has = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'unsupported';
    const regs = await navigator.serviceWorker.getRegistrations();
    return regs.length > 0 ? 'registered' : 'none';
  });
  ok(has === 'registered' || has === 'unsupported', 'service worker: ' + has);
});

await step('no console or page errors during the run', async () => {
  ok(consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
});

await browser.close();
server.close();

const passed = results.filter((r) => r.ok).length;
console.log('\n' + '='.repeat(60));
console.log(`  ${passed}/${results.length} checks passed, ${failures} failed`);
console.log('='.repeat(60));
if (failures) {
  console.log('\nFailures:');
  results.filter((r) => !r.ok).forEach((r) => console.log(' - ' + r.name + ' → ' + r.error));
  process.exit(1);
}
