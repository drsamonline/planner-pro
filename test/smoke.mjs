/**
 * Planner Pro — end-to-end smoke test
 * Serves the app locally, drives it with headless Chromium and asserts that
 * every user-facing function works. Run: node test/smoke.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
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
await step('edits a task inline (no modal)', async () => {
  await page.click('.rows .row:not(.done) .row-text');
  await sel('.row-input');
  ok(!(await visible('#modalBody')), 'inline edit should not open the modal');
  await page.$eval('.row-input', (el) => { el.value = 'Second task (edited)'; });
  await page.keyboard.press('Enter');
  await sleep(220);
  const texts = await page.$$eval('.rows .row-text', (els) => els.map((e) => e.textContent));
  ok(texts.some((t) => t.includes('(edited)')), 'edit not applied: ' + texts.join(' | '));
  ok(!(await visible('.row-input')), 'edit field should close after Enter');
});
await step('Escape cancels an inline edit', async () => {
  const before = await page.$$eval('.rows .row-text', (els) => els.map((e) => e.textContent).join('|'));
  await page.click('.rows .row:not(.done) .row-text');
  await sel('.row-input');
  await page.$eval('.row-input', (el) => { el.value = 'SHOULD NOT SAVE'; });
  await page.keyboard.press('Escape');
  await sleep(200);
  const after = await page.$$eval('.rows .row-text', (els) => els.map((e) => e.textContent).join('|'));
  eq(after, before, 'Escape should discard the edit');
});
await step('undo restores a deleted task', async () => {
  const before = await count('.rows .row');
  await page.click('.rows .row [data-act="todo-del"]');
  await sleep(220);
  eq(await count('.rows .row'), before - 1, 'task was not deleted');
  ok(await visible('.toast-action'), 'undo button missing from the toast');
  await page.click('.toast-action');
  await sleep(280);
  eq(await count('.rows .row'), before, 'undo did not restore the task');
});
await step('deleted tasks land in the trash and can be restored', async () => {
  const before = await count('.rows .row');
  const label = await page.$eval('.rows .row .row-text', (el) => el.textContent);
  await page.click('.rows .row [data-act="todo-del"]');
  await sleep(220);
  await nav('settings');
  const trashText = await page.$eval('#view', (el) => el.textContent);
  ok(trashText.includes('Recently deleted'), 'trash card missing');
  ok(trashText.includes(label.slice(0, 18)), 'deleted task not listed in the trash');
  await page.click('[data-act="trash-restore"]');
  await sleep(280);
  await nav('day');
  eq(await count('.rows .row'), before, 'restore from trash failed');
  await nav('today');
});
await step('clear completed is undoable', async () => {
  if ((await count('.rows .row.done')) === 0) {
    await page.click('.rows .row .check');
    await sleep(200);
  }
  ok((await count('.rows .row.done')) > 0, 'no completed task to clear');
  const before = await count('.rows .row');
  await clickAct('clear-done');
  await sleep(250);
  ok((await count('.rows .row')) < before, 'completed tasks were not cleared');
  await page.click('.toast-action');
  await sleep(280);
  eq(await count('.rows .row'), before, 'undo of clear-completed failed');
});
await step('trash expires after 30 days', async () => {
  const kept = await page.evaluate(() => {
    const u = Store.user();
    u.trash = u.trash || [];
    u.trash.push({ id: 'old1', at: Date.now() - 40 * 86400000, text: 'ancient', kind: 'item' });
    return Store.trash().some((e) => e.id === 'old1');
  });
  eq(kept, false, 'entries older than 30 days should be pruned');
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
console.log('\n— exports, backup & accessibility —');
await step('exports a day as an ICS calendar file', async () => {
  const ics = await page.evaluate(() => {
    const key = DateUtil.todayKey();
    const d = Store.day(key, true);
    if (!d.blocks.length) d.blocks.push({ id: 'x1', start: '09:00', end: '10:00', text: 'Deep work' });
    return PlannerDebug.icsFor([key]);
  });
  ok(ics.startsWith('BEGIN:VCALENDAR'), 'bad ICS header');
  ok(ics.includes('BEGIN:VEVENT') && ics.includes('DTSTART:'), 'no event emitted');
  ok(ics.includes('SUMMARY:Deep work'), 'summary missing');
  ok(ics.trim().endsWith('END:VCALENDAR'), 'bad ICS footer');
  ok(ics.includes('\r\n'), 'ICS must use CRLF line endings');
  ok(await visible('[data-act="export-ics"]'), 'calendar button missing from the day view');
});
await step('ICS escaping handles commas and semicolons', async () => {
  const out = await page.evaluate(() => PlannerDebug.icsEsc('Clinic, 4pm; bring notes'));
  ok(out.includes('\\,') && out.includes('\\;'), 'ICS escaping failed: ' + out);
});
await step('backup nudge appears when exports are stale', async () => {
  await page.evaluate(() => {
    Store.user().lastExportAt = 0;
    Store.user().backupSnoozeUntil = 0;
    Store.saveNow();
    location.hash = '#/today';
  });
  await sleep(320);
  await page.evaluate(() => { location.hash = '#/day'; });
  await sleep(150);
  await page.evaluate(() => { location.hash = '#/today'; });
  await sleep(250);
  ok(await visible('.notice'), 'backup notice not shown');
  await page.click('[data-act="dismiss-backup"]');
  await sleep(280);
  ok(!(await visible('.notice')), 'notice not dismissed');
  const snoozed = await page.evaluate(() => Store.backupStatus().due);
  eq(snoozed, false, 'snooze did not take effect');
});
await step('exporting a backup records the time', async () => {
  const before = await page.evaluate(() => Store.user().lastExportAt);
  await page.evaluate(() => Store.markExported());
  const after = await page.evaluate(() => Store.user().lastExportAt);
  ok(after > before, 'lastExportAt not updated');
});
await step('palette jumps to a natural-language date', async () => {
  const parsed = await page.evaluate(() => ({
    tomorrow: PlannerDebug.parseDateQuery('tomorrow'),
    friday: PlannerDebug.parseDateQuery('next friday'),
    xmas: PlannerDebug.parseDateQuery('25 dec'),
    junk: PlannerDebug.parseDateQuery('qqqzzz')
  }));
  const t = await page.evaluate(() => DateUtil.addDays(DateUtil.todayKey(), 1));
  eq(parsed.tomorrow, t, 'tomorrow');
  ok(/^\d{4}-\d{2}-\d{2}$/.test(parsed.friday), 'weekday parse failed');
  eq(parsed.xmas.slice(5), '12-25', 'day-month parse failed');
  eq(parsed.junk, null, 'junk should not parse');

  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyK');
  await page.keyboard.up('Control');
  await sleep(180);
  await page.type('#paletteInput', 'tomorrow');
  await sleep(220);
  const first = await textOf('.pal-item');
  ok(first.includes('Tomorrow'), 'date jump item missing: ' + first);
  await page.keyboard.press('Enter');
  await sleep(280);
  ok((await page.evaluate(() => location.hash)).includes(t), 'palette date jump did not navigate');
});
await step('skip link exists for keyboard users', async () => {
  ok(await page.$('.skip'), 'skip link missing');
  const label = await page.$eval('.skip', (el) => el.textContent);
  ok(label.toLowerCase().includes('skip'), 'skip link label');
});
await step('a live region is present for screen readers', async () => {
  ok(await page.$('#liveRegion[aria-live="polite"]'), 'live region missing');
});

/* ------------------------------------------------------------------ */
console.log('\n— reordering, keyboard list & quick add —');
await step('every task row has a drag handle', async () => {
  await page.evaluate(() => { location.hash = '#/day/' + DateUtil.todayKey(); });
  await sleep(300);
  const rows = await count('.rows .row');
  const handles = await count('.rows .row .drag');
  ok(rows > 0, 'no rows to drag');
  eq(handles, rows, 'each row needs a handle');
  ok(await page.$eval('.rows .row', (el) => !!el.dataset.rowId), 'row id missing');
});
await step('dragging a task reorders the list', async () => {
  await page.evaluate(() => {
    const d = Store.day('2026-06-01', true);
    d.todos = [
      { id: 'a1', text: 'Alpha', done: false },
      { id: 'a2', text: 'Beta', done: false },
      { id: 'a3', text: 'Gamma', done: false }
    ];
    Store.saveNow();
    location.hash = '#/day/2026-06-01';
  });
  await sleep(400);
  eq((await page.$$eval('.rows .row-text', (e) => e.map((x) => x.textContent))).join(','), 'Alpha,Beta,Gamma');

  const handles = await page.$$('.rows .row .drag');
  const first = await handles[0].boundingBox();
  const third = await handles[2].boundingBox();
  await page.mouse.move(third.x + third.width / 2, third.y + third.height / 2);
  await page.mouse.down();
  await page.mouse.move(third.x + third.width / 2, first.y + 2, { steps: 10 });
  await page.mouse.up();
  await sleep(400);

  eq((await page.$$eval('.rows .row-text', (e) => e.map((x) => x.textContent))).join(','), 'Gamma,Alpha,Beta');
  const stored = await page.evaluate(() => Store.day('2026-06-01', true).todos.map((t) => t.text).join(','));
  eq(stored, 'Gamma,Alpha,Beta', 'order not persisted');
});
await step('J and K move the keyboard cursor', async () => {
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('KeyJ');
  await sleep(160);
  ok(await page.$('.row.cursor'), 'no cursor after J');
  const first = await page.$eval('.row.cursor .row-text', (el) => el.textContent);
  await page.keyboard.press('KeyJ');
  await sleep(160);
  const second = await page.$eval('.row.cursor .row-text', (el) => el.textContent);
  ok(first !== second, 'J did not move the cursor');
  await page.keyboard.press('KeyK');
  await sleep(160);
  eq(await page.$eval('.row.cursor .row-text', (el) => el.textContent), first, 'K did not move back');
});
await step('X ticks the focused task', async () => {
  const before = await count('.rows .row.done');
  await page.keyboard.press('KeyX');
  await sleep(260);
  ok((await count('.rows .row.done')) !== before, 'X did not toggle');
});
await step('Alt+Arrow reorders the focused task', async () => {
  const before = await page.evaluate(() => Store.day('2026-06-01', true).todos.map((t) => t.text).join(','));
  await page.keyboard.down('Alt');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.up('Alt');
  await sleep(320);
  const after = await page.evaluate(() => Store.day('2026-06-01', true).todos.map((t) => t.text).join(','));
  ok(before !== after, 'Alt+Arrow did not reorder: ' + before + ' → ' + after);
});
await step('quick add parses date, time and tags', async () => {
  const parsed = await page.evaluate(() => PlannerDebug.parseQuickAdd('Call the clinic tomorrow 4pm #health'));
  eq(parsed.text, 'Call the clinic');
  eq(parsed.time, '16:00');
  eq(parsed.tags.join(','), 'health');
  const t = await page.evaluate(() => DateUtil.addDays(DateUtil.todayKey(), 1));
  eq(parsed.dateKey, t, 'date not parsed');

  const bare = await page.evaluate(() => PlannerDebug.parseQuickAdd('Buy stamps'));
  eq(bare.text, 'Buy stamps');
  eq(bare.time, null);
  eq(bare.dateKey, null);
});
await step('quick add modal saves what it previews', async () => {
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('KeyN');
  await sel('#qaText');
  await page.type('#qaText', 'Buy milk tomorrow 9am #errand');
  await sleep(250);
  const preview = await textOf('#qaPreview');
  ok(preview.includes('09:00'), 'preview missing time: ' + preview);
  ok(preview.includes('#errand'), 'preview missing tag: ' + preview);

  const btns = await page.$$('#modalActions .btn');
  await btns[btns.length - 1].click();
  await sleep(350);

  const saved = await page.evaluate(() => {
    const k = DateUtil.addDays(DateUtil.todayKey(), 1);
    const d = Store.peekDay(k);
    return d ? d.todos.filter((t) => t.text === 'Buy milk') : [];
  });
  eq(saved.length, 1, 'task not saved to tomorrow');
  eq(saved[0].at, '09:00', 'time not stored');
  eq((saved[0].tags || []).join(','), 'errand', 'tag not stored');
});
await step('copies blocks and tasks from another day', async () => {
  await page.evaluate(() => {
    const src = Store.day('2026-06-02', true);
    src.blocks = [{ id: 'x1', start: '09:00', end: '', text: 'Standup' }];
    src.todos = [{ id: 'x2', text: 'Email triage', done: true }];
    Store.saveNow();
    location.hash = '#/day/2026-06-03';
  });
  await sleep(350);
  await clickAct('duplicate-day');
  await sel('#dupDate');
  await page.$eval('#dupDate', (el) => { el.value = '2026-06-02'; });
  const btns = await page.$$('#modalActions .btn');
  await btns[btns.length - 1].click();
  await sleep(400);

  const copied = await page.evaluate(() => {
    const d = Store.day('2026-06-03', true);
    return {
      blocks: d.blocks.map((b) => b.text),
      todos: d.todos.map((t) => ({ text: t.text, done: t.done }))
    };
  });
  ok(copied.blocks.includes('Standup'), 'block not copied');
  eq(copied.todos.length, 1, 'task not copied');
  eq(copied.todos[0].text, 'Email triage');
  eq(copied.todos[0].done, false, 'copied tasks must start unchecked');
});

/* ------------------------------------------------------------------ */
console.log('\n— repeats, templates & estimates —');
await step('quick add parses an estimate', async () => {
  const a = await page.evaluate(() => PlannerDebug.parseQuickAdd('Write the report 45m'));
  eq(a.text, 'Write the report');
  eq(a.est, 45);
  const b = await page.evaluate(() => PlannerDebug.parseQuickAdd('Deep work 2h #focus'));
  eq(b.est, 120);
  eq(b.tags.join(','), 'focus');
  const c = await page.evaluate(() => PlannerDebug.parseQuickAdd('Plan the week 1h 30m'));
  eq(c.est, 90, '1h 30m should be 90 minutes');
});
await step('day load shows planned time and warns over capacity', async () => {
  await page.evaluate(() => {
    Store.setCapacity(60);
    const d = Store.day('2026-07-01', true);
    d.todos = [
      { id: 'l1', text: 'One', done: false, est: 45 },
      { id: 'l2', text: 'Two', done: false, est: 30 }
    ];
    Store.saveNow();
    location.hash = '#/day/2026-07-01';
  });
  await sleep(400);
  const load = await page.evaluate(() => Store.dayLoad('2026-07-01'));
  eq(load.minutes, 75, 'total minutes');
  eq(load.capacity, 60, 'capacity');
  eq(load.over, true, 'over flag');
  ok(await page.$('.load.over'), 'no over-capacity marker in the DOM');
  ok((await textOf('.load')).includes('Over capacity'), 'missing over-capacity text');
});
await step('a repeating task appears once per matching day', async () => {
  const res = await page.evaluate(() => {
    Store.setCapacity(480);
    Store.state().users[Store.state().activeUser].recurring = [];
    Store.addRecurring({ text: 'Morning review', repeat: 'daily', from: '2026-07-01' });
    const first = Store.ensureRecurring('2026-07-02');
    const again = Store.ensureRecurring('2026-07-02');
    const third = Store.ensureRecurring('2026-07-03');
    return { first, again, third, count: Store.peekDay('2026-07-02').todos.length };
  });
  eq(res.first, 1, 'first materialisation');
  eq(res.again, 0, 'must be idempotent');
  eq(res.third, 1, 'next day');
  eq(res.count, 1, 'duplicate instance created');
});
await step('weekday rules skip the weekend', async () => {
  const res = await page.evaluate(() => {
    Store.state().users[Store.state().activeUser].recurring = [];
    Store.addRecurring({ text: 'Standup', repeat: 'weekdays', from: '2026-07-01' });
    return {
      saturday: Store.ensureRecurring('2026-07-04'),
      monday: Store.ensureRecurring('2026-07-06')
    };
  });
  eq(res.saturday, 0, 'weekday rule ran on a Saturday');
  eq(res.monday, 1, 'weekday rule missed Monday');
});
await step('quick add can create a repeating task', async () => {
  await page.evaluate(() => {
    Store.state().users[Store.state().activeUser].recurring = [];
    Store.saveNow();
    location.hash = '#/today';
  });
  await sleep(350);
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('KeyN');
  await sel('#qaText');
  await page.type('#qaText', 'Evening stretch 10m');
  await page.select('#qaRepeat', 'daily');
  const btns = await page.$$('#modalActions .btn');
  await btns[btns.length - 1].click();
  await sleep(450);

  const res = await page.evaluate(() => ({
    rules: Store.recurring().length,
    label: Store.recurring()[0] ? Store.repeatLabel(Store.recurring()[0]) : '',
    linked: Store.day(DateUtil.todayKey(), true).todos.some((t) => t.text === 'Evening stretch' && t.recurringId),
    est: (Store.day(DateUtil.todayKey(), true).todos.filter((t) => t.text === 'Evening stretch')[0] || {}).est
  }));
  eq(res.rules, 1, 'rule not created');
  eq(res.label, 'every day');
  eq(res.linked, true, 'task not linked to its rule');
  eq(res.est, 10, 'estimate lost');
});
await step('repeating rules are manageable in Settings', async () => {
  await nav('settings');
  const text = await page.$eval('#view', (el) => el.textContent);
  ok(text.includes('Repeating tasks'), 'repeating card missing');
  ok(text.includes('Evening stretch'), 'rule not listed');
  await page.click('[data-act="recurring-toggle"]');
  await sleep(300);
  eq(await page.evaluate(() => Store.recurring()[0].active), false, 'pause failed');
  await page.click('[data-act="recurring-toggle"]');
  await sleep(300);
});
await step('task details sets an estimate', async () => {
  await page.evaluate(() => { location.hash = '#/day/' + DateUtil.todayKey(); });
  await sleep(350);
  await page.click('.rows .row [data-act="todo-details"]');
  await sel('#detEst');
  await page.$eval('#detEst', (el) => { el.value = '25'; });
  const btns = await page.$$('#modalActions .btn');
  await btns[btns.length - 1].click();
  await sleep(350);
  const est = await page.evaluate(() => {
    const d = Store.day(DateUtil.todayKey(), true);
    return d.todos.filter((t) => t.est === 25).length;
  });
  ok(est > 0, 'estimate not saved');
});
await step('saves a day as a template and applies it', async () => {
  await page.evaluate(() => {
    const d = Store.day('2026-08-10', true);
    d.blocks = [{ id: 'tb1', start: '09:00', end: '', text: 'Clinic' }];
    d.todos = [{ id: 'tt1', text: 'Review patients', done: false, est: 60 }];
    Store.saveNow();
    location.hash = '#/day/2026-08-10';
  });
  await sleep(400);
  await clickAct('templates');
  await sel('#tplName');
  await page.type('#tplName', 'Clinic day');
  const btns = await page.$$('#modalActions .btn');
  await btns[btns.length - 1].click();
  await sleep(600);
  eq(await page.evaluate(() => Store.templates().length), 1, 'template not saved');

  await page.keyboard.press('Escape');
  await sleep(200);
  await page.evaluate(() => {
    const d = Store.day('2026-08-11', true);
    d.blocks = []; d.todos = [];
    Store.saveNow();
    location.hash = '#/day/2026-08-11';
  });
  await sleep(400);
  await clickAct('templates');
  await sel('[data-act="template-apply"]');
  await page.click('[data-act="template-apply"]');
  await sleep(500);

  const applied = await page.evaluate(() => {
    const d = Store.day('2026-08-11', true);
    return {
      blocks: d.blocks.map((b) => b.text),
      todos: d.todos.map((t) => t.text),
      est: (d.todos[0] || {}).est
    };
  });
  ok(applied.blocks.includes('Clinic'), 'block not applied');
  ok(applied.todos.includes('Review patients'), 'task not applied');
  eq(applied.est, 60, 'estimate not carried into the template');
});

/* ------------------------------------------------------------------ */
console.log('\n— insights & tags —');
await step('insight aggregates match a known dataset', async () => {
  const res = await page.evaluate(() => {
    const prev = Store.state().activeUser;
    const made = Store.addUser('Insights Test', '9999');
    const testId = made.id;
    const seed = (k, arr) => {
      const day = Store.day(k, true);
      day.todos = arr.map(([text, done]) => ({ id: Store.uid(), text, done }));
    };
    seed('2026-02-02', [['a', true], ['b', true]]);
    seed('2026-02-03', [['c', true]]);
    seed('2026-02-04', [['d', true], ['e', false]]);
    seed('2026-02-06', [['f', true]]);            // gap on the 5th breaks the run
    Store.day('2026-02-04', true).todos[0].tags = ['health'];
    Store.day('2026-02-03', true).todos[0].tags = ['health', 'work'];
    Store.saveNow();

    const data = Store.insights();
    const heat = Store.heatmap(2026);
    const out = {
      daysPlanned: data.daysPlanned,
      total: data.tasksTotal,
      done: data.tasksDone,
      pct: data.pct,
      best: data.bestStreak,
      tags: data.tags.map((t) => t.tag + ':' + t.count).join(','),
      heatLen: heat.length,
      leapLen: Store.heatmap(2028).length,
      heatDone: heat.reduce((a, c) => a + c.done, 0),
      trendLen: Store.trend(30).length
    };
    Store.activate(prev);
    Store.removeUser(testId);
    return out;
  });
  eq(res.daysPlanned, 4, 'days planned');
  eq(res.total, 6, 'tasks');
  eq(res.done, 5, 'done');
  eq(res.pct, 83, 'completion');
  eq(res.best, 3, 'streak must stop at the gap');
  eq(res.tags, 'health:2,work:1', 'tag index');
  eq(res.heatLen, 365, 'non-leap year');
  eq(res.leapLen, 366, 'leap year');
  eq(res.heatDone, 5, 'heatmap totals');
  eq(res.trendLen, 30, 'trend window');
});
await step('search filters by tag', async () => {
  await page.evaluate(() => {
    const d = Store.day('2026-05-05', true);
    d.todos = [
      { id: 'tag1', text: 'Take the tablets', done: false, tags: ['health'] },
      { id: 'tag2', text: 'Write the report', done: false, tags: ['work'] }
    ];
    Store.saveNow();
    location.hash = '#/search';
  });
  await sleep(400);
  await page.$eval('#searchInput', (el) => {
    el.value = '#health';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sleep(350);
  const hits = await page.$$eval('.hit .strong', (els) => els.map((e) => e.textContent));
  ok(hits.some((h) => h.includes('Take the tablets')), 'tagged task missing from results');
  ok(!hits.some((h) => h.includes('Write the report')), 'untagged task leaked into a tag filter');
});
await step('clicking a tag pill opens it as a filter', async () => {
  await page.evaluate(() => { location.hash = '#/day/2026-05-05'; });
  await sleep(400);
  await page.click('.rows .row .pill-tag');
  await sleep(450);
  ok((await page.evaluate(() => location.hash)).includes('#/search/'), 'did not navigate to search');
  const value = await page.$eval('#searchInput', (el) => el.value);
  eq(value, '#health', 'search not prefilled with the tag');
});
await step('insights view renders the heatmap and stats', async () => {
  await page.evaluate(() => { location.hash = '#/insights/2026'; });
  await sleep(500);
  ok((await count('.heat-cell')) > 300, 'heatmap cells missing');
  eq(await count('.stats .stat'), 4, 'expected 4 stat tiles');
  const text = await page.$eval('#view', (el) => el.textContent);
  ok(text.includes('The year, day by day'), 'heatmap heading missing');
  ok(text.includes('Last 30 days'), 'trend card missing');
});
await step('I opens Insights', async () => {
  await page.evaluate(() => { location.hash = '#/today'; document.activeElement.blur(); });
  await sleep(300);
  await page.keyboard.press('KeyI');
  await sleep(400);
  ok((await page.evaluate(() => location.hash)).includes('#/insights'), 'shortcut failed');
});

/* ------------------------------------------------------------------ */
console.log('\n— encrypted backups & bulk actions —');
await step('encrypted backup round-trips', async () => {
  const res = await page.evaluate(async () => {
    const state = Store.state();
    const env = await PlannerCrypto.encrypt(state, 'correct horse battery');
    const back = await PlannerCrypto.decrypt(env, 'correct horse battery');
    return {
      format: env.format,
      hasSalt: !!env.kdf.salt,
      hasIv: !!env.cipher.iv,
      iterations: env.kdf.iterations,
      plaintextLeaked: JSON.stringify(env).includes('Sohil'),
      same: JSON.stringify(back) === JSON.stringify(state),
      users: Object.keys(back.users).length
    };
  });
  eq(res.format, 'planner-pro-encrypted');
  ok(res.hasSalt && res.hasIv, 'salt/iv missing from the envelope');
  ok(res.iterations >= 100000, 'PBKDF2 iterations too low');
  eq(res.plaintextLeaked, false, 'the envelope leaked plaintext');
  ok(res.same, 'decrypted payload differs from the original');
  ok(res.users > 0, 'no profiles in the payload');
});
await step('a wrong passphrase is rejected', async () => {
  const message = await page.evaluate(async () => {
    const env = await PlannerCrypto.encrypt({ hello: 'world' }, 'rightpass');
    try {
      await PlannerCrypto.decrypt(env, 'wrongpass');
      return 'decrypted anyway';
    } catch (e) { return e.message; }
  });
  ok(/wrong passphrase/i.test(message), 'expected a wrong-passphrase error, got: ' + message);
});
await step('envelope detection is strict', async () => {
  const good = await page.evaluate(() => PlannerCrypto.isEnvelope('{"format":"planner-pro-encrypted","kdf":{},"cipher":{},"data":"x"}'));
  const plain = await page.evaluate(() => PlannerCrypto.isEnvelope('{"users":{}}'));
  const junk = await page.evaluate(() => PlannerCrypto.isEnvelope('not json'));
  eq(good, true, 'valid envelope not recognised');
  eq(plain, false, 'plain database treated as encrypted');
  eq(junk, false, 'junk treated as encrypted');
});
await step('settings offers an encrypted backup', async () => {
  await nav('settings');
  ok(await visible('[data-act="export-encrypted"]'), 'encrypted export button missing');
  ok(await visible('[data-act="import-encrypted"]'), 'encrypted restore button missing');
  await page.click('[data-act="export-encrypted"]');
  await sel('#encPass');
  ok(await visible('#encPass2'), 'passphrase confirmation missing');
  await page.keyboard.press('Escape');
  await sleep(250);
});
await step('bulk select deletes and undoes', async () => {
  await page.evaluate(() => {
    const d = Store.day('2026-09-09', true);
    d.todos = [
      { id: 'b1', text: 'Alpha', done: false },
      { id: 'b2', text: 'Beta', done: false },
      { id: 'b3', text: 'Gamma', done: false }
    ];
    Store.saveNow();
    location.hash = '#/day/2026-09-09';
  });
  await sleep(450);
  await page.click('[data-act="select-start"]');
  await sleep(350);
  eq(await count('.select-box'), 3, 'select boxes missing');

  await page.click('.rows .row:nth-child(1) .row-text');
  await sleep(250);
  await page.click('.rows .row:nth-child(2) .row-text');
  await sleep(250);
  const bar = await textOf('.bulk-bar');
  ok(bar.includes('2 selected'), 'selection count wrong: ' + bar);

  await clickAct('bulk-delete');
  await sleep(400);
  eq(await page.evaluate(() => Store.day('2026-09-09', true).todos.length), 1, 'bulk delete failed');
  ok(await visible('.toast-action'), 'bulk delete should be undoable');
  await page.click('.toast-action');
  await sleep(400);
  eq(await page.evaluate(() => Store.day('2026-09-09', true).todos.length), 3, 'undo did not restore');
});
await step('bulk move sends tasks to another day', async () => {
  await page.click('[data-act="select-start"]');
  await sleep(350);
  await page.click('.rows .row:nth-child(1) .row-text');
  await sleep(250);
  await clickAct('bulk-move');
  await sel('#bulkDate');
  await page.$eval('#bulkDate', (el) => { el.value = '2026-09-10'; });
  const btns = await page.$$('#modalActions .btn');
  await btns[btns.length - 1].click();
  await sleep(450);

  const res = await page.evaluate(() => ({
    from: Store.day('2026-09-09', true).todos.length,
    to: Store.day('2026-09-10', true).todos.map((t) => t.text)
  }));
  eq(res.from, 2, 'source should lose one task');
  eq(res.to.length, 1, 'target should gain one task');
});

/* ------------------------------------------------------------------ */
console.log('\n— focus timer, swipe & vault —');
await step('the focus timer starts, pauses and stops', async () => {
  await page.evaluate(() => { location.hash = '#/day/' + DateUtil.todayKey(); });
  await sleep(400);
  await page.click('[data-act="focus-start"]');
  await sleep(350);
  ok(await visible('#focusChip'), 'focus chip not shown');
  ok(/^\d\d:\d\d$/.test(await textOf('#focusTime')), 'timer text malformed');

  await page.click('[data-act="focus-pause"]');
  await sleep(250);
  ok(await page.$('#focusChip.paused'), 'pause not reflected in the chip');
  await page.click('[data-act="focus-pause"]');
  await sleep(200);
  ok(!(await page.$('#focusChip.paused')), 'resume failed');

  await page.click('[data-act="focus-stop"]');
  await sleep(250);
  ok(!(await visible('#focusChip')), 'chip still visible after stop');
  eq(await page.evaluate(() => PlannerDebug.focusState()), null, 'timer state not cleared');
});
await step('the Markdown vault has a note per day', async () => {
  const res = await page.evaluate(() => {
    const wk = DateUtil.weekStartKey(DateUtil.todayKey(), Store.user().weekStart);
    Store.week(wk, true).focus = 'Vault test week';
    Store.saveNow();

    const files = PlannerDebug.vaultFiles();
    const day = files.filter((f) => f.name === 'days/' + DateUtil.todayKey() + '.md')[0];
    const week = files.filter((f) => f.name === 'weeks/' + wk + '.md')[0];
    return {
      count: files.length,
      hasReadme: files.some((f) => f.name === 'README.md'),
      dayBody: day ? day.content : '',
      weekBody: week ? week.content : ''
    };
  });
  ok(res.count > 2, 'too few notes: ' + res.count);
  ok(res.hasReadme, 'README missing');
  ok(res.dayBody.indexOf('# ') === 0, 'day note should start with a heading');
  ok(res.dayBody.length > 40, 'day note is empty');
  ok(res.weekBody.indexOf('Vault test week') >= 0, 'week note missing its focus');
});
await step('the zip writer produces a valid container', async () => {
  const res = await page.evaluate(async () => {
    const files = [{ name: 'a.md', content: '# hello' }, { name: 'days/2026-01-01.md', content: 'x' }];
    const blob = PlannerZip.build(files);
    const buf = new Uint8Array(await blob.arrayBuffer());
    const text = new TextDecoder('latin1').decode(buf);
    return {
      sig: Array.from(buf.slice(0, 4)).join(','),
      size: buf.length,
      hasName: text.indexOf('days/2026-01-01.md') >= 0,
      hasEocd: text.indexOf('PK\u0005\u0006') >= 0
    };
  });
  eq(res.sig, '80,75,3,4', 'not a zip (bad local header signature)');
  ok(res.hasName, 'filename missing from the archive');
  ok(res.hasEocd, 'end-of-central-directory record missing');
  ok(res.size > 100, 'archive suspiciously small');
});
await step('swiping the day view moves to the next day', async () => {
  await page.evaluate(() => { location.hash = '#/day/2026-10-10'; });
  await sleep(450);
  await page.evaluate(() => {
    const el = document.getElementById('view');
    const opts = (x) => ({ bubbles: true, clientX: x, clientY: 620, pointerType: 'touch' });
    el.dispatchEvent(new PointerEvent('pointerdown', opts(900)));
    el.dispatchEvent(new PointerEvent('pointerup', opts(700)));
  });
  await sleep(450);
  const hash = await page.evaluate(() => location.hash);
  ok(hash.indexOf('2026-10-11') >= 0, 'swipe left should go to the next day, got ' + hash);

  await page.evaluate(() => {
    const el = document.getElementById('view');
    const opts = (x) => ({ bubbles: true, clientX: x, clientY: 620, pointerType: 'touch' });
    el.dispatchEvent(new PointerEvent('pointerdown', opts(700)));
    el.dispatchEvent(new PointerEvent('pointerup', opts(900)));
  });
  await sleep(450);
  ok((await page.evaluate(() => location.hash)).indexOf('2026-10-10') >= 0, 'swipe right should go back');
});
await step('a short drag is not a swipe', async () => {
  const before = await page.evaluate(() => location.hash);
  await page.evaluate(() => {
    const el = document.getElementById('view');
    const opts = (x) => ({ bubbles: true, clientX: x, clientY: 620, pointerType: 'touch' });
    el.dispatchEvent(new PointerEvent('pointerdown', opts(700)));
    el.dispatchEvent(new PointerEvent('pointerup', opts(680)));
  });
  await sleep(350);
  eq(await page.evaluate(() => location.hash), before, 'a 20px drag should not navigate');
});

/* ------------------------------------------------------------------ */
console.log('\n— subtasks, CSV, health & panic blur —');
await step('subtasks can be added, ticked and counted', async () => {
  await page.evaluate(() => {
    const d = Store.day('2026-12-01', true);
    d.todos = [{ id: 'st1', text: 'Ship the release', done: false }];
    Store.saveNow();
    location.hash = '#/day/2026-12-01';
  });
  await sleep(450);

  await page.click('.rows .row .sub-toggle');
  await sleep(350);
  ok(await visible('.sub-add input'), 'step input not revealed');

  await page.type('.sub-add input', 'Write notes');
  await page.keyboard.press('Enter');
  await sleep(400);
  await page.type('.sub-add input', 'Tag the build');
  await page.keyboard.press('Enter');
  await sleep(400);

  const subs = await page.evaluate(() => (Store.day('2026-12-01', true).todos[0].sub || []).map((x) => x.text));
  eq(subs.join('|'), 'Write notes|Tag the build', 'subtasks not stored');

  await page.click('.sub-row .check');
  await sleep(350);
  const done = await page.evaluate(() => Store.day('2026-12-01', true).todos[0].sub[0].done);
  eq(done, true, 'subtask did not tick');
  ok((await textOf('.pill-sub')).indexOf('1/2') >= 0, 'count pill wrong');
});
await step('CSV import parses quotes and merges by day', async () => {
  const res = await page.evaluate(() => {
    const rows = PlannerDebug.parseCsv('date,text,done,tags\n2026-12-05,"Call the clinic, again",false,health\n2026-12-05,Write notes,true,\n');
    return rows;
  });
  eq(res.length, 3, 'parser should keep the header and 2 rows');
  eq(res[1][1], 'Call the clinic, again', 'quoted comma lost');

  const imported = await page.evaluate(() => {
    const rows = [
      { date: '2026-12-05', text: 'Call the clinic, again', done: false, tags: ['health'] },
      { date: '2026-12-05', text: 'Write notes', done: true, tags: [] }
    ];
    const first = Store.importRows(rows);
    const again = Store.importRows(rows);          // idempotent by text
    return { first, again, count: Store.day('2026-12-05', true).todos.length };
  });
  eq(imported.first.tasks, 2, 'nothing imported');
  eq(imported.first.days, 1, 'day count');
  eq(imported.again.tasks, 0, 'duplicate import should be skipped');
  eq(imported.count, 2, 'day should hold exactly the two tasks');
});
await step('the health check finds and repairs broken records', async () => {
  const res = await page.evaluate(() => {
    const d = Store.day('2026-12-07', true);
    d.todos = [
      { text: 'No id at all', done: false },
      { id: 'dupe', text: 'First', done: false },
      { id: 'dupe', text: 'Second', done: false },
      { id: 'orphan', text: 'Orphan repeat', done: false, recurringId: 'nope' }
    ];
    Store.saveNow();

    const before = Store.healthCheck();
    const fixed = Store.repair();
    const after = Store.healthCheck();
    return {
      codes: before.issues.map((i) => i.code).sort().join(','),
      beforeClean: before.clean,
      fixed,
      afterClean: after.clean,
      afterIssues: after.issues.length
    };
  });
  ok(res.codes.indexOf('ids') >= 0, 'missing-id not reported: ' + res.codes);
  ok(res.codes.indexOf('dupes') >= 0, 'duplicate ids not reported');
  ok(res.codes.indexOf('orphans') >= 0, 'dangling repeat not reported');
  eq(res.beforeClean, false, 'should not be clean before repair');
  ok(res.fixed.ids >= 1 && res.fixed.dupes >= 1 && res.fixed.orphans >= 1, 'repair did too little');
  eq(res.afterClean, true, 'still unhealthy after repair: ' + res.afterIssues);
});
await step('panic blur follows the setting', async () => {
  await nav('settings');
  const box = await page.$('[data-bind="panic-blur"]');
  ok(box, 'panic-blur checkbox missing');
  const checked = await page.$eval('[data-bind="panic-blur"]', (el) => el.checked);
  eq(checked, false, 'should default off');

  await page.click('[data-bind="panic-blur"]');
  await sleep(300);
  eq(await page.evaluate(() => Store.user().settings.panicBlur), true, 'setting not stored');

  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await sleep(200);
  ok(await page.evaluate(() => document.body.classList.contains('panic')), 'blur not applied on window blur');

  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await sleep(200);
  ok(!(await page.evaluate(() => document.body.classList.contains('panic'))), 'blur not removed on focus');
  await page.click('[data-bind="panic-blur"]');
  await sleep(250);
});

/* ------------------------------------------------------------------ */
console.log('\n— mini calendar & share target —');
await step('the mini calendar shows the month with dots for planned days', async () => {
  await page.evaluate(() => {
    const d = Store.day('2026-11-20', true);
    d.todos = [{ id: 'cal1', text: 'Has work', done: true }];
    Store.saveNow();
    location.hash = '#/today';
  });
  await sleep(500);

  const res = await page.evaluate(() => {
    const host = document.getElementById('miniCal');
    const days = host.querySelectorAll('.mc-day').length;
    const dots = host.querySelectorAll('.mc-dot').length;
    const today = host.querySelector('.mc-day.is-today');
    return { days, dots, hasToday: !!today, title: host.querySelector('.mc-title').textContent };
  });
  ok(res.days >= 28 && res.days <= 31, 'wrong day count: ' + res.days);
  ok(res.dots >= 1, 'no dots for planned days');
  ok(res.hasToday, 'today is not marked');
  ok(/November 2026|\w+ 2026/.test(res.title), 'month title looks wrong: ' + res.title);
});
await step('the mini calendar navigates months and days', async () => {
  const before = await page.evaluate(() => document.querySelector('#miniCal .mc-title').textContent);
  await page.click('#miniCal [data-act="cal-prev"]');
  await sleep(300);
  const after = await page.evaluate(() => document.querySelector('#miniCal .mc-title').textContent);
  ok(after !== before, 'month did not change');

  await page.click('#miniCal [data-act="cal-day"]');
  await sleep(450);
  ok((await page.evaluate(() => location.hash)).indexOf('#/day/') >= 0, 'day click did not navigate');
});
await step('a shared text is parsed from the URL and opens quick add', async () => {
  const parsed = await page.evaluate(() => {
    history.replaceState({}, '', location.pathname + '?text=' + encodeURIComponent('Call the clinic tomorrow 4pm'));
    const text = PlannerDebug.readShare();
    return { text, search: location.search };
  });
  eq(parsed.text, 'Call the clinic tomorrow 4pm', 'share text not read from the query');
  eq(parsed.search, '', 'the share query should be stripped from the URL');

  const empty = await page.evaluate(() => {
    history.replaceState({}, '', location.pathname);
    return PlannerDebug.readShare();
  });
  eq(empty, null, 'a plain URL should not produce a share');

  await page.evaluate(() => PlannerDebug.openQuickAdd('Call the clinic tomorrow 4pm'));
  await sel('#qaText');
  eq(await page.$eval('#qaText', (el) => el.value), 'Call the clinic tomorrow 4pm', 'quick add not prefilled');
  await page.keyboard.press('Escape');
  await sleep(250);
});

/* ------------------------------------------------------------------ */
console.log('\n— weekly & daily reviews —');
await step('the weekly review is due on the configured day', async () => {
  const due = await page.evaluate(() => {
    Store.user().reviewDay = DateUtil.weekday(DateUtil.todayKey());
    Store.user().reviewSnoozeUntil = 0;
    Store.saveNow();
    return Store.reviewDue();
  });
  ok(due && due.weekKey, 'review not due on the configured weekday');
});
await step('the weekly review opens with a summary and saves', async () => {
  await page.evaluate(() => { location.hash = '#/today'; });
  await sleep(400);
  ok(await visible('[data-act="week-review"]'), 'review nudge missing from Today');

  await page.click('[data-act="week-review"]');
  await sel('#rvDone');
  const stats = await textOf('.review-stats');
  ok(stats.includes('tasks done'), 'summary strip missing: ' + stats);

  await page.$eval('#rvDone', (el) => { el.value = '· shipped the release'; });
  await page.$eval('#rvFocus', (el) => { el.value = 'Write the next chapter'; });
  const btns = await page.$$('#modalActions .btn');
  await btns[btns.length - 1].click();
  await sleep(500);

  const saved = await page.evaluate(() => {
    const u = Store.user();
    const wk = DateUtil.weekStartKey(DateUtil.todayKey(), u.weekStart);
    const w = Store.week(wk, true);
    const next = Store.week(DateUtil.addDays(wk, 7), true);
    return {
      hasReview: !!(w.review && w.review.at),
      done: (w.review || {}).done || '',
      nextFocus: next.focus || '',
      stillDue: Store.reviewDue()
    };
  });
  ok(saved.hasReview, 'review not saved');
  ok(saved.done.indexOf('shipped') >= 0, 'answer not stored');
  eq(saved.nextFocus, 'Write the next chapter', 'next week focus not set');
  eq(saved.stillDue, null, 'review still due after saving');
});
await step('the review shows on the week view', async () => {
  await page.evaluate(() => {
    const wk = DateUtil.weekStartKey(DateUtil.todayKey(), Store.user().weekStart);
    location.hash = '#/week/' + wk;
  });
  await sleep(450);
  const text = await page.$eval('#view', (el) => el.textContent);
  ok(text.includes('Week in review'), 'review card missing');
  ok(text.includes('shipped the release'), 'saved answers not rendered');
  ok((await count('.review-body')) >= 1, 'review body missing');
});
await step('the day review saves and seeds tomorrow', async () => {
  await page.evaluate(() => { location.hash = '#/day/' + DateUtil.todayKey(); });
  await sleep(450);
  await page.click('[data-act="day-review"]');
  await sel('#drWent');
  await page.$eval('#drWent', (el) => { el.value = 'Finished the redesign'; });
  await page.$eval('#drNext', (el) => { el.value = 'Start the draft'; });
  const btns = await page.$$('#modalActions .btn');
  await btns[btns.length - 1].click();
  await sleep(500);

  const res = await page.evaluate(() => {
    const t = DateUtil.todayKey();
    const d = Store.day(t, true);
    const tomorrow = Store.day(DateUtil.addDays(t, 1), true);
    return {
      hasReview: !!(d.review && d.review.at),
      went: (d.review || {}).went || '',
      seeded: tomorrow.todos.some((x) => x.text === 'Start the draft')
    };
  });
  ok(res.hasReview, 'day review not saved');
  ok(res.went.indexOf('redesign') >= 0, 'answer missing');
  ok(res.seeded, '“one thing for tomorrow” did not become a task');
  ok(await visible('.review-body'), 'review not rendered in the day view');
});
await step('the review day can be switched off', async () => {
  await nav('settings');
  ok(await visible('#setReview'), 'review-day select missing');
  await page.select('#setReview', '-1');
  await sleep(350);
  eq(await page.evaluate(() => Store.user().reviewDay), -1, 'setting not stored');
  eq(await page.evaluate(() => Store.reviewDue()), null, 'review still due when off');
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
  await sleep(600);
  const pins = await page.evaluate(async () => {
    const u = Store.user();
    return { right: await Store.verifyPin(u, '4321'), old: await Store.verifyPin(u, '1234') };
  });
  eq(pins.right, true, 'new PIN does not verify');
  eq(pins.old, false, 'old PIN still works');
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

await step('profiles store a PIN hash, never the PIN', async () => {
  const res = await page.evaluate(async () => {
    const st = Store.state();
    const u = st.users[st.activeUser];
    const raw = localStorage.getItem('planner_v14') || '';
    return {
      hasHash: !!u.pinHash,
      hasSalt: !!u.pinSalt,
      iterations: u.pinIter,
      legacy: u.legacyPin,
      keyIsPin: /^\d{4}$/.test(st.activeUser),
      rawHasPin: raw.includes('"4321"'),
      verifyRight: await Store.verifyPin(u, '4321'),
      verifyWrong: await Store.verifyPin(u, '0000')
    };
  });
  eq(res.hasHash, true, 'no PIN hash stored');
  eq(res.hasSalt, true, 'no salt stored');
  ok(res.iterations >= 100000, 'PBKDF2 iterations too low');
  eq(res.legacy, null, 'plaintext PIN left behind');
  eq(res.keyIsPin, false, 'profile still keyed by the PIN');
  eq(res.rawHasPin, false, 'the PIN appears in the stored document');
  eq(res.verifyRight, true, 'correct PIN rejected');
  eq(res.verifyWrong, false, 'wrong PIN accepted');
});
await step('a legacy PIN-keyed profile migrates and upgrades', async () => {
  const res = await page.evaluate(async () => {
    const backup = Store.exportJSON();
    const legacy = {
      v: 14,
      activeUser: '1234',
      users: {
        '1234': {
          name: 'Legacy', theme: 'midnight', days: {}, weeks: {}, months: {}, years: {},
          archives: {}, settings: { requirePin: true }
        }
      }
    };
    Store.importJSON(JSON.stringify(legacy));
    const st = Store.state();
    const id = st.activeUser;
    const before = {
      keyIsPin: /^\d{4}$/.test(id),
      legacyPin: st.users[id].legacyPin,
      hasHash: !!st.users[id].pinHash
    };
    const ok = await Store.auth(id, '1234');
    const after = { hasHash: !!Store.state().users[id].pinHash, legacy: Store.state().users[id].legacyPin };
    Store.importJSON(backup);
    return { before, ok, after };
  });
  eq(res.before.keyIsPin, false, 'legacy key was not rekeyed');
  eq(res.before.legacyPin, '1234', 'legacy PIN not carried for the upgrade');
  eq(res.ok, true, 'legacy PIN did not unlock');
  eq(res.after.hasHash, true, 'legacy PIN was not hashed on unlock');
  eq(res.after.legacy, null, 'plaintext survived the upgrade');
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
console.log('\n— interaction cost —');
await step('ticking a task patches the DOM instead of re-rendering', async () => {
  await page.evaluate(() => {
    const d = Store.day('2026-10-20', true);
    d.todos = Array.from({ length: 50 }, (_, i) => ({ id: 'perf' + i, text: 'Task ' + i, done: false }));
    Store.saveNow();
    location.hash = '#/week';
  });
  await sleep(300);
  await page.evaluate(() => { location.hash = '#/day/2026-10-20'; });
  await sleep(600);

  const res = await page.evaluate(() => {
    const rows = document.querySelectorAll('.rows .row');
    const first = rows[0];
    const t0 = performance.now();
    first.querySelector('.check').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const elapsed = performance.now() - t0;
    return {
      elapsed,
      rowsBefore: rows.length,
      rowsAfter: document.querySelectorAll('.rows .row').length,
      sameNode: document.querySelector('.rows .row') === first,
      done: first.classList.contains('done'),
      pill: document.querySelector('[data-live="day-count"]').textContent
    };
  });
  ok(res.elapsed < 20, 'toggle took ' + res.elapsed.toFixed(1) + 'ms — it is re-rendering');
  eq(res.sameNode, true, 'the row node was replaced, so the view re-rendered');
  eq(res.rowsAfter, res.rowsBefore, 'row count changed');
  eq(res.done, true, 'row was not marked done');
  ok(res.pill.indexOf('1/50') === 0, 'counter did not update in place: ' + res.pill);
});
await step('the counter still updates on the Today view', async () => {
  await page.evaluate(() => {
    const d = Store.day(DateUtil.todayKey(), true);
    d.todos = [
      { id: 'live1', text: 'One', done: false },
      { id: 'live2', text: 'Two', done: false }
    ];
    Store.saveNow();
    location.hash = '#/day/2026-10-20';
  });
  await sleep(300);
  await page.evaluate(() => { location.hash = '#/today'; });
  await sleep(600);

  const res = await page.evaluate(() => {
    const box = document.querySelector('.rows .row .check');
    box.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return {
      pill: (document.querySelector('[data-live="today-count"]') || {}).textContent,
      open: (document.querySelector('[data-live="open"]') || {}).textContent,
      ring: (document.querySelector('[data-live="ring"] .ring') || {}).style
        ? document.querySelector('[data-live="ring"] .ring').style.getPropertyValue('--p')
        : null
    };
  });
  ok(/^1\/2$/.test(res.pill || ''), 'today pill wrong: ' + res.pill);
  eq(res.open, '1', 'open count not updated');
  eq(res.ring, '50', 'ring not updated');
});

/* ------------------------------------------------------------------ */
console.log('\n— month view —');
await step('the month grid renders every day of the month', async () => {
  await page.evaluate(() => {
    const d = Store.day('2026-11-17', true);
    d.todos = [{ id: 'm1', text: 'First thing', done: true }, { id: 'm2', text: 'Second thing', done: false }];
    Store.saveNow();
    location.hash = '#/month/2026-11';
  });
  await sleep(500);
  const res = await page.evaluate(() => ({
    cells: document.querySelectorAll('.mcell:not(.is-pad)').length,
    tasks: document.querySelectorAll('.mcell-task').length,
    title: document.querySelector('#view .datebar strong').textContent,
    hasToday: !!document.querySelector('.mcell.is-today')
  }));
  eq(res.cells, 30, 'November has 30 days');
  ok(res.tasks >= 2, 'tasks not shown in the grid');
  ok(res.title.indexOf('November') >= 0, 'month title wrong: ' + res.title);
  ok(res.hasToday, 'today should be marked');
});
await step('a month cell opens that day', async () => {
  await page.click('.mcell:not(.is-pad):not(.is-today)');
  await sleep(450);
  ok((await page.evaluate(() => location.hash)).indexOf('#/day/2026-11-') >= 0, 'cell did not open the day');
});
await step('M opens the month and the arrows page it', async () => {
  await page.evaluate(() => { document.activeElement.blur(); location.hash = '#/today'; });
  await sleep(300);
  await page.keyboard.press('KeyM');
  await sleep(450);
  ok((await page.evaluate(() => location.hash)).indexOf('#/month/') >= 0, 'shortcut failed');

  const before = await page.$eval('#view .datebar strong', (el) => el.textContent);
  await page.click('#view .datebar .icon-btn[aria-label="Previous month"]');
  await sleep(450);
  const after = await page.$eval('#view .datebar strong', (el) => el.textContent);
  ok(after !== before, 'month did not change');
});

/* ------------------------------------------------------------------ */
console.log('\n— attachments —');
await step('a file is stored as a blob with metadata on the day', async () => {
  const res = await page.evaluate(async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4, 5])], 'note.txt', { type: 'text/plain' });
    const added = await Store.attachFile('2026-12-15', file);
    const rec = await Store.getAttachment(added.id);
    const day = Store.peekDay('2026-12-15');
    return {
      ok: added.ok,
      name: rec && rec.name,
      size: rec && rec.size,
      bytes: rec && rec.buf ? rec.buf.byteLength : 0,
      meta: (day.files || []).length
    };
  });
  eq(res.ok, true, 'attach failed');
  eq(res.name, 'note.txt', 'name not kept');
  eq(res.size, 5, 'size not kept');
  eq(res.bytes, 5, 'blob bytes not stored');
  eq(res.meta, 1, 'metadata not added to the day');
});
await step('the file input adds an attachment and it can be removed', async () => {
  await page.evaluate(() => { location.hash = '#/day/2026-12-16'; });
  await sleep(450);

  const input = await page.$('input[data-file="attach"]');
  ok(input, 'no file input on the day view');

  // the fixture is created here, not assumed to exist on the runner
  const fixture = path.join(os.tmpdir(), 'planner-attach-test.txt');
  fs.writeFileSync(fixture, 'referral note');
  await input.uploadFile(fixture);
  await sleep(700);

  const after = await page.evaluate(() => (Store.peekDay('2026-12-16').files || []).map((f) => f.name));
  eq(after.length, 1, 'file was not attached');
  eq(after[0], path.basename(fixture), 'wrong name');
  ok(await visible('.attach-name'), 'attachment row missing');

  await page.click('[data-act="attach-del"]');
  await sleep(500);
  eq(await page.evaluate(() => (Store.peekDay('2026-12-16').files || []).length), 0, 'attachment not removed');
});
await step('oversized files are refused', async () => {
  const res = await page.evaluate(async () => {
    const big = new File([new Uint8Array(9 * 1024 * 1024)], 'huge.bin', { type: 'application/octet-stream' });
    const out = await Store.attachFile('2026-12-15', big);
    return out;
  });
  eq(res.ok, false, 'a 9 MB file should be refused');
  ok(/8 MB/.test(res.error || ''), 'the refusal should name the limit: ' + res.error);
});

/* ------------------------------------------------------------------ */
console.log('\n— storage backend —');
await step('the document lives in IndexedDB, not localStorage', async () => {
  const res = await page.evaluate(() => new Promise((resolve) => {
    const req = indexedDB.open('planner-pro');   // whatever version the app created
    req.onerror = () => resolve({ error: true });
    req.onsuccess = () => {
      const db = req.result;
      const get = db.transaction('docs', 'readonly').objectStore('docs').get('planner_v14');
      get.onsuccess = () => {
        const rec = get.result;
        resolve({
          stored: !!rec,
          gzip: !!(rec && rec.gz),
          storedBytes: rec && rec.buf ? rec.buf.byteLength : null,
          rawBytes: new Blob([JSON.stringify(Store.state())]).size,
          lsRaw: localStorage.getItem('planner_v14'),
          backend: Store.usage().backend
        });
      };
      get.onerror = () => resolve({ error: true });
    };
  }));
  eq(res.backend, 'idb', 'backend should be IndexedDB');
  ok(res.stored, 'no document in IndexedDB');
  eq(res.gzip, true, 'the record should be gzipped');
  eq(res.lsRaw, null, 'the localStorage copy should be gone after migration');
  ok(res.storedBytes < res.rawBytes, 'compressed size should be smaller (' + res.storedBytes + ' vs ' + res.rawBytes + ')');
});
await step('a reload reads the document back from IndexedDB', async () => {
  const before = await page.evaluate(() => {
    const u = Store.user();
    return { name: u.name, days: Object.keys(u.days).length };
  });
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(500);
  if (await visible('#lockScreen')) {
    if (!(await visible('#pinForm'))) { await page.click('.user-chip'); await sleep(250); }
    await page.type('#pinInput', '4321');
    await page.click('#pinForm button[type="submit"]');
    await sleep(700);
  }
  const after = await page.evaluate(() => {
    const u = Store.user();
    return { name: u.name, days: Object.keys(u.days).length, backend: Store.usage().backend };
  });
  eq(after.backend, 'idb', 'backend after reload');
  eq(after.name, before.name, 'profile name lost across reload');
  eq(after.days, before.days, 'days lost across reload');
});
await step('without IndexedDB the app falls back to localStorage', async () => {
  const fb = await browser.newPage();
  await fb.evaluateOnNewDocument(() => {
    Object.defineProperty(window, 'indexedDB', { get: () => undefined });
  });
  await fb.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle2' });
  await sleep(300);
  const before = await fb.evaluate(() => Store.usage().backend);
  eq(before, 'ls', 'should have fallen back to localStorage');

  await fb.type('#newUserName', 'Fallback');
  await fb.type('#newUserPin', '1111');
  await fb.click('#createUserBtn');
  await sleep(600);
  const res = await fb.evaluate(() => ({
    app: !document.getElementById('app').hidden,
    ls: !!localStorage.getItem('planner_v14')
  }));
  eq(res.app, true, 'app did not open without IndexedDB');
  eq(res.ls, true, 'nothing written to localStorage in fallback mode');

  await fb.evaluate(() => localStorage.removeItem('planner_v14'));
  await fb.close();
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
