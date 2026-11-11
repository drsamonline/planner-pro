# Enhancements & function inventory

Two things live here:

1. **What the app does today** — every function, so nothing is a mystery.
2. **What could be added next** — sorted by value against cost, with a blunt
   "don't" list so the app stays small.

Effort is honest wall-clock time for one developer who already knows the code:
**S** ≈ under 2 hours, **M** ≈ half a day, **L** ≈ one to three days.
"Weight" is what it adds to the shipped app (JS + CSS + storage).

---

## 1. Function inventory (v14.0.0)

### Profiles & access
| Function | Where |
|---|---|
| Create profile with name + 4-digit PIN | Lock screen |
| Pick a profile, then enter its PIN | Lock screen |
| PIN required on launch (toggleable) | Settings |
| Change PIN, verified against the current PIN | Settings |
| Rename profile | Settings |
| Lock the app without closing it | Top bar, account menu |
| Delete a profile and all of its data (confirmed) | Settings |
| Separate, isolated data per profile | Everywhere |

### Today
| Function | Where |
|---|---|
| Greeting + full date + live clock | Hero |
| Completion ring, done/total count | Stat tile |
| Streak (consecutive days with a completed task) | Stat tile |
| Time-block count + next block / "no more blocks today" | Stat tile |
| Open-task count | Stat tile |
| Editable intention line | Intention card |
| Add / toggle / prioritise / edit / delete tasks | Task list |
| Clear completed tasks | Task list footer |
| Carry unfinished tasks from yesterday | Task list footer |
| Add / edit time / edit text / delete blocks, "now" highlight | Schedule card |
| Brain dump with live word count | Right column |
| 7-day completion bars + weekly total | Right column |

### Day
| Function | Where |
|---|---|
| Previous / next day, date picker, jump to today | Date bar |
| Relative label (Today / Tomorrow / Yesterday / weekday) | Date bar |
| Print the day | Date bar |
| Export the day as Markdown | Date bar |
| Intention, to-dos, blocks, notes & reflection | Body |
| Carry unfinished from the previous day | Task list footer |

### Week
| Function | Where |
|---|---|
| Previous / next week, "This week", ISO week number | Date bar |
| Weekly focus line | Focus card |
| Weekly goals (add / toggle / edit / delete) | Goals card |
| Week summary: tasks done, days planned, goals met | Focus card |
| Seven day columns with per-day counts and tasks | Grid |
| Tick a task straight from the week grid | Grid |
| Jump to any day from the grid | Grid |

### Year
| Function | Where |
|---|---|
| Previous / next year, "This year" | Date bar |
| Archive a past year manually | Date bar |
| Year theme line | Theme card |
| Year stats: days planned, tasks done, goals met | Theme card |
| Year goals (add / toggle / edit / delete) | Goals card |
| Twelve month cards with progress bars and task counts | Grid |
| Add and tick month goals | Month cards |

### Archive
| Function | Where |
|---|---|
| Automatic archiving of finished years (toggleable) | On launch |
| Archive the previous year in one click | Archive view |
| Open an archived year: goals, month-by-month progress | Archive view |
| Export one archived year as JSON | Archive list |
| Restore an archived year into the live planner | Archive list |
| Delete an archived year (confirmed) | Archive list |

### Search & commands
| Function | Where |
|---|---|
| Search tasks, intentions, notes, blocks, weekly/monthly/yearly goals, brain dump | Search view |
| Grouped results with highlighted matches and a jump link | Search view |
| Command palette over the same data plus 12 commands | `Ctrl/⌘ K` |
| Arrow-key selection, Enter to run, Esc to close | Palette |
| Quick add to any date with a priority flag | `N` / FAB |

### Data
| Function | Where |
|---|---|
| Debounced autosave with a "Saved" indicator | Everywhere |
| Export the whole database as JSON | Settings |
| Import a database (confirmed, replaces everything) | Settings |
| Export everything as Markdown | Settings |
| Storage usage readout | Settings |
| Migration from the v13 document, lossless | First launch |
| Corrupt-document quarantine instead of silent deletion | On load |
| Quota-failure warning instead of a silent failure | On save |

### Interface
| Function | Where |
|---|---|
| Four themes: Midnight, Ocean, Light, System | Settings, top bar |
| Theme follows the OS when set to System | Everywhere |
| Sidebar → icon rail → bottom tab bar by width | Responsive |
| Floating quick-add button on phones | Mobile |
| Print stylesheet | Any view |
| Focus rings, `aria-current`, reduced-motion support | Everywhere |
| Deep links for day, week, year, archive | URL hash |
| Install as a PWA, works offline after first load | Manifest + SW |
| About screen with shortcuts and data model | About |

---

## 2. Enhancements worth adding

### Tier A — high value, small weight

> **Shipped:** 14.1.0 — A1 (undo), A2 (trash), A3 (backup reminder), A4 (PWA update
> prompt), A5 (inline editing), A7 (ICS export), A9 (palette date jump), A12
> (accessibility pass). 14.2.0 — A6 (drag to reorder), A8 (natural-language quick
> add), A10 (copy a day), A11 (keyboard list) and the minified build. **Tier A is
> complete. **14.3.0 — B1 (recurring tasks), B2 (templates), B5 (estimates).**

| # | Enhancement | Why it matters | Effort | Weight |
|---|---|---|---|---|
| A1 | ✅ **shipped in 14.1** — **Undo** for delete/clear/carry (toast with "Undo", 8-second window) | Deleting a task used to be permanent and instant — the single biggest safety gap in the app. | S | ~2 KB |
| A2 | ✅ **shipped in 14.1** — **Trash with 30-day retention** behind the undo toast | Recovers "I deleted the wrong day" a week later | S–M | ~4 KB |
| A3 | ✅ **shipped in 14.1** — **Backup reminder** — nudge if no export in 14 days, dismissible | Local-first apps die from forgotten backups | S | ~1 KB |
| A4 | ✅ **shipped in 14.1** — **PWA update prompt** — "A new version is ready · Reload" | Without it, users stay on an old cached build for weeks | S | ~1 KB |
| A5 | ✅ **shipped in 14.1** — **Inline task editing** (click text → edit in place, Enter to save) instead of a modal | Removes a whole round-trip for the most common action | S | ~2 KB |
| A6 | ✅ **shipped in 14.2** — **Drag to reorder** tasks and blocks (pointer events, no library) | Order is meaning in a plan; currently fixed by creation order | M | ~4 KB |
| A7 | ✅ **shipped in 14.1** — **ICS export** for a day or a week | Puts the plan into Google/Apple Calendar without any integration | S–M | ~3 KB |
| A8 | ✅ **shipped in 14.2** — **Natural-language quick add** — "call clinic tomorrow 4pm #health" fills date, time and tag | One keystroke instead of four fields | M | ~5 KB |
| A9 | ✅ **shipped in 14.1** — **Quick date jump** in the palette — type "next friday", "24 dec" | Fastest way to reach a distant day | S | ~2 KB |
| A10 | ✅ **shipped in 14.2** — **Duplicate day / copy yesterday's blocks** | Most days are variations of a routine | S | ~2 KB |
| A11 | ✅ **shipped in 14.2** — **Keyboard-navigable task list** (`j/k`, `x` to tick, `e` to edit) | Makes the app genuinely fast for heavy users | M | ~3 KB |
| A12 | ✅ **shipped in 14.1** — **Skip link + `aria-live` on counts** | Screen-reader correctness; small effort | S | ~1 KB |

### Tier B — valuable, medium weight

| # | Enhancement | Why it matters | Effort | Weight |
|---|---|---|---|---|
| B1 | ✅ **shipped in 14.3** — **Recurring tasks** — `repeat: daily \| weekdays \| weekly \| mon,wed`; materialised lazily on open | Removes the biggest reason people abandon planners | M | ~6 KB |
| B2 | ✅ **shipped in 14.3** — **Templates** — save a day or a block set ("clinic day", "deep work morning") and apply it | Makes a routine a two-tap action | M | ~5 KB |
| B3 | **Tags** — `#health` parsed inline, filterable, shown as chips | Lightweight structure without projects/folders | M | ~5 KB |
| B4 | **Subtasks** (one level) with a parent progress count | "Publish release" usually has three steps | M | ~5 KB |
| B5 | ✅ **shipped in 14.3** — **Estimated minutes** per task + day total vs. available hours | Exposes over-planning, which is the real planning failure | S–M | ~3 KB |
| B6 | **Year heatmap** — GitHub-style grid of completion intensity | The one chart that makes a year feel real | M | ~4 KB |
| B7 | **Stats view** — 30/90-day completion trend, best streak, busiest weekday | Turns stored data into feedback | M | ~8 KB |
| B8 | **Encrypted backup** — AES-GCM via WebCrypto with a passphrase, `.planner` file | Makes it safe to keep the backup in Drive/Dropbox | M | ~6 KB |
| B9 | **Weekly review mode** — a guided 5-question card on a chosen weekday, answers saved into that week | The habit that makes the rest work | M | ~5 KB |
| B10 | **End-of-day review** — three prompts appended to the day's notes | Cheap reflection, no new screen | S | ~2 KB |
| B11 | **Mini calendar** in the sidebar with dot density per day | Orientation: "where am I, what's coming" | M | ~5 KB |
| B12 | **Bulk actions** — select several tasks, move to another day / delete | Fixes the "20 stale tasks" cleanup chore | M | ~6 KB |
| B13 | **Focus timer** on the current block (Pomodoro, no notifications) | Time-boxing without leaving the app | S–M | ~4 KB |
| B14 | **Markdown vault export** — one `.md` per day inside a zip (store-only zip, no dependency) | Makes the data readable by Obsidian/Logseq forever | M | ~6 KB |
| B15 | **Import from CSV** (Todoist, Google Tasks exports) | Lowers the cost of switching | M | ~7 KB |
| B16 | **Share target** — share text from another Android app into Planner Pro | Turns the phone share sheet into quick capture | S | ~2 KB |
| B17 | **Swipe left/right between days** on touch | Native feel for the most common navigation | S–M | ~3 KB |
| B18 | **PIN hashing + attempt throttling** (PBKDF2, 500 ms delay after 5 failures) | Stops shoulder-surfing a plaintext PIN in `localStorage` | S | ~2 KB |
| B19 | **Panic blur** — hide content when the tab loses focus | Privacy on a shared desk | S | ~1 KB |
| B20 | **Data health check** — validate the document, offer repair, show orphaned records | Confidence after a browser update | M | ~4 KB |

### Tier C — bigger, only if the app earns it

| # | Enhancement | Why it matters | Effort | Weight |
|---|---|---|---|---|
| C1 | **IndexedDB storage** behind the same API | localStorage caps around 5 MB; IndexedDB removes the ceiling and the `JSON.stringify` cost | L | ~8 KB |
| C2 | **Compression** (LZ-string or `CompressionStream`) for stored JSON | 3–5× more history in the same space | M | ~2 KB |
| C3 | **i18n** — string table + `Intl` formatting; Hindi, Marathi, Gujarati first | Most of this app's likely users don't plan in English | L | ~10 KB |
| C4 | **Optional sync** through a file the user owns (File System Access API, or a chosen folder) | Multi-device without a server or an account | L | ~10 KB |
| C5 | **Day attachments** — images/PDFs per day in IndexedDB | Appointment slips, prescriptions, sketches | L | ~12 KB |
| C6 | **Month calendar view** with blocks rendered as a real grid | Some people plan visually, not in lists | L | ~12 KB |
| C7 | **Self-hosted sync server** (separate repo, optional) | True multi-device for people who want it | L | separate |

---

## 3. Making it faster and more offline

### Already done
- Zero runtime dependencies; no framework, no CDN, no web fonts, ~120 KB shell.
- Single string render per view with event delegation — no diffing, no per-row listeners.
- Service worker precaches the entire shell; navigations fall back to cache.
- Debounced saves (220 ms) instead of a write per keystroke.
- Static `Intl`-free date maths; no date library.

### Next, in order of payoff

| Change | Effect | Effort |
|---|---|---|
| **Partial DOM updates for toggles** — flip one row's class instead of re-rendering the view | Noticeably snappier on 100+ item lists; also keeps scroll and focus | M |
| **`content-visibility: auto`** on month cards and week columns | Skips layout/paint for offscreen cards; cheap win on the year view | S |
| **Cache `Intl.DateTimeFormat` instances** instead of `toLocaleDateString()` per render | Removes a surprising amount of work in long loops | S |
| ~~**Minify CSS/JS in the build** (esbuild, one pass)~~ ✅ done in 14.2 — assets 167 KB → 123 KB (−27 %) | Smaller shell, faster first paint | S |
| **`requestIdleCallback` for saves** | Saves stop competing with typing on slow phones | S |
| **IndexedDB + compression** (C1, C2) | Removes the 5 MB ceiling and the stringify pause at large sizes | L |
| **Preload the next/previous day's view** on hover/idle | Instant day stepping | S |
| **Ship a WebP/AVIF screenshot set for the landing page** | Faster first visit to the marketing page | S |

### Offline checklist
- [x] Service worker precaches the shell (html, css, js, icons, manifest)
- [x] Navigation requests fall back to the cached `index.html`
- [x] Works from `file://` with no server at all
- [x] No network calls after install (verify in DevTools → Network → Offline)
- [ ] Add an explicit "offline ready" toast on first successful cache
- [ ] Cache the landing page too (it is a separate document)

---

## 4. Deliberately **not** adding

The fastest way to ruin a small tool is to keep saying yes. These are out on
purpose, with the reason:

| Not doing | Why |
|---|---|
| Accounts, login servers, cloud sync by default | Turns a file you own into a service you depend on. Optional, user-owned sync only (C4). |
| Team/collaboration features | Different product; comments and permissions would triple the data model. |
| Push notifications / reminders | Requires a server and a permission prompt; the app is opened, not monitored. In-app "today" is enough. |
| An AI assistant inside the planner | Adds an API key, a network dependency and a privacy question to an app whose whole point is that nothing leaves the device. |
| A plugin system / theme editor | Every plugin API is a compatibility promise forever. Themes are 4 fixed palettes by design. |
| Gamification beyond streaks | Badges and points compete with the work. |
| Sounds, confetti, mascots | Noise in a tool that should disappear. |
| Full project management (boards, sprints, dependencies) | That is a different app. Day/week/month/year is the whole model. |
| A heavy rich-text editor | Markdown-ish plain text survives every export. |

---

## 5. Suggested release plan

**v14.1 — "safe and quick"** — ✅ shipped: undo + trash, backup reminder, PWA
update prompt, inline editing, ICS export, palette date jump, accessibility pass.
Still open from this batch: drag-to-reorder (A6), natural-language quick add (A8),
duplicate day (A10), keyboard-navigable list (A11), minified build.

**v14.2 — "routines"** — ✅ shipped: drag reorder, keyboard list, natural-language
quick add, copy day, minified build. **14.3.0** — ✅ recurring tasks (B1),
templates (B2), estimates + capacity (B5). Still open: tag filter (B3), weekly
review (B9), heatmap (B6), stats (B7), encrypted backup (B8).

**v15 — "insight"**: year heatmap, stats view, encrypted backups, Markdown vault
export, IndexedDB + compression, i18n groundwork.

**v16 — decide**: optional user-owned sync, attachments, month calendar. Only if
people are actually using v15 daily.

---

*Want one of these? Open an issue with the ID (e.g. "A1 undo") — the IDs exist so
discussions stay short.*
