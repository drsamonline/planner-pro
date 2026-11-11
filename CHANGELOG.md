# Changelog

All notable changes to Planner Pro. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/).

## [14.9.0] — 2026-11-11

The last of the local features. Steps inside tasks, a way in for other people's
CSV, a check that the document is intact, and a blur for when someone walks up
behind you.

### Added

- **Subtasks.** One level of steps under any task: a chevron on every row opens an inline list with a done count and an add box. Subtasks travel with the task through bulk move, templates, copy-day and both Markdown exports.
- **CSV import.** `date,text,done,tags`, pasted or picked as a file. The parser handles quoted commas and embedded newlines (RFC 4180-ish), a header row is optional, dates must be `YYYY-MM-DD`, and a task already on that day with the same text is skipped — so importing twice is harmless.
- **Data health.** A check for missing ids, duplicate ids, tasks with no text, dangling `recurringId` links, malformed day keys and stale trash. Repair fills in missing ids, re-ids duplicates, unlinks dead repeats and prunes expired trash. It never deletes a day, a note or a task.
- **Panic blur.** Settings → "Blur the planner when the window loses focus". Focus is tracked from the window events rather than `document.hasFocus()`, which lies when another app steals focus.

### Removed from the plan

- Internationalisation (C3) and every networked feature — user-owned sync (C4) and a sync server (C7) — are out. The app has no networking code: `grep` for `fetch`, `XMLHttpRequest` or `WebSocket` returns nothing, and the README and landing page now say so.

### Verified

- The end-to-end suite grew from 104 to **108 checks**: adding, ticking and counting subtasks; the CSV parser keeping a quoted comma and the importer being idempotent; a deliberately broken document being reported (missing ids, duplicates, dangling repeat) and repaired to clean; and panic blur following the setting through blur and focus.

## [14.8.0] — 2026-11-11

Getting the work out of the app. The planner can now hand you a folder of plain
Markdown notes, time a focus block, and be swiped between days.

### Added

- **Markdown vault export.** One `.md` per day (`days/YYYY-MM-DD.md`) and per week (`weeks/YYYY-MM-DD.md`), plus a README, zipped in the browser. Tasks come out as Markdown checkboxes with time, estimate and tags in trailing italics; blocks, notes and reviews come out as sections. No dependency: `assets/js/zip.js` is a ~120-line store-only ZIP writer, verified with `unzip -t`.
- **Focus timer.** "Focus" on the Schedule card starts a 25-minute countdown labelled with the block you are in (or the next one). The chip in the top bar shows the remaining time with pause/resume and stop. Deliberately in memory only — closing the app ends the session rather than pretending a timer survives a reload.
- **Swipe between days.** A horizontal swipe on the Day or Today view moves to the previous/next day. Guarded so a 20 px drag or a vertical scroll does nothing, and ignored when the gesture starts on a field, a select or the drag handle.

### Verified

- The end-to-end suite grew from 99 to **104 checks**: the timer starting, pausing, resuming and stopping (state cleared), the vault containing a note per day plus a README and a week note with its focus, the ZIP's local-header signature and end-of-central-directory record, swipe left/right actually changing the day, and a short drag being ignored.
- The archive itself was checked outside the suite with `unzip -l`, `unzip -p` and `unzip -t` — it lists, extracts and reports no errors.

## [14.7.0] — 2026-11-11

Closing the loop. A planner that only pushes work forward eventually becomes a
list of guilt; this release gives the week and the day an ending.

### Added

- **Weekly review.** A guided review on the weekday you choose (Settings → "Weekly review on", off by default Sunday). It opens with a real summary — tasks done, days planned, weekly goals met — and four questions: what actually got done (pre-seeded with the week's completed tasks), what didn't happen and is still worth doing, what you will change, and the one thing for next week. That last answer becomes next week's focus if it is empty.
- **Review nudge.** On the review day, Today shows a one-line prompt with "Review the week" and a "Later" that hides it until tomorrow.
- **End-of-day review.** Three prompts on the Day view — what went well, what drained you, one thing for tomorrow. The last one creates tomorrow's first task if it isn't already there.
- **Reviews are data, not text.** They live on the week and the day objects, render as a read-only block with an Edit button, survive archiving, and appear in both Markdown exports.

### Changed

- The Week view gained a Review button in its header and a "Week in review" card that shows either the answers or a prompt to start.

### Verified

- The end-to-end suite grew from 94 to **99 checks**: due detection on the configured weekday, the summary strip, saving a review, the next-week focus handoff, the review rendering on the week view, the day review seeding tomorrow's task, and switching reviews off.

## [14.6.0] — 2026-11-11

The PIN stops being a secret written in the file. Profiles are now keyed by an
opaque id and the PIN is stored as a salted PBKDF2 hash — never in the clear,
never as the key. **This release migrates stored data; the app does it on first
launch, without asking.**

### Changed

- **Profile storage.** `state.users` is keyed by a generated id (`u_ab12cd34`) instead of the PIN. Each profile carries `pinHash`, `pinSalt` and `pinIter` (PBKDF2-SHA256, 120 000 iterations, 16-byte random salt, 256-bit derived key).
- **Unlock is asynchronous.** `Store.auth(id, pin)` resolves after the hash comparison (and, for a legacy profile, after the hash is written).
- `Store.addUser` still returns synchronously — the hash is computed in the background and lands within milliseconds.
- `Store.changePin` is now async and verifies the current PIN by hash before setting the new one; it also refuses a PIN another profile already uses (compared by hash, not by key).

### Added

- `Store.activate(id)` — switch profile without a PIN check, for internal use and tests.

### Migration

- A document written by 14.0–14.5 (PIN as the key) is rekeyed on load: each profile gets an id, the old PIN is parked in `legacyPin`, and `activeUser` is remapped.
- On the first successful unlock of such a profile the PIN is hashed, `legacyPin` is deleted, and the plaintext is gone from storage for good.
- If a browser has no WebCrypto, the profile keeps working on `legacyPin` (plaintext) — the app is honest about that rather than failing to open.

### Verified

- The end-to-end suite grew from 92 to **94 checks**: the stored document contains a hash and a salt but not the PIN and not a PIN-shaped key; the correct PIN verifies and a wrong one does not; a synthetic 14.5 document is rekeyed, unlocks, and has its plaintext replaced by a hash; plus the existing lock/reload flows now exercising the async path.

## [14.5.0] — 2026-11-11

Trust. The planner can now hand you a backup that is safe to leave in cloud
storage, and cleaning up a messy day is no longer one row at a time.

### Added

- **Encrypted backups.** Settings → Backup exports an AES-256-GCM envelope with a PBKDF2-derived key (SHA-256, 150 000 iterations, random 16-byte salt, 12-byte IV) — all in the browser via WebCrypto, no library. The file is plain JSON you can read the shape of, but the payload is unreadable without the passphrase. Restore detects the envelope, asks for the passphrase and refuses politely on a wrong one.
- **Bulk actions.** "Select" on the day list turns rows into checkboxes; pick several and move them to another date (estimates, times and tags travel with them) or delete them as one undoable action.

### Changed

- Backup copy now explains the difference between the plain JSON export and the encrypted one.

### Fixed

- **Action rows were invisible on desktop.** Several places outside a task row reused `.row-actions`, which stays at `opacity: 0` until hover: the Day view's "Carry unfinished" and "Clear completed", the Danger-zone delete button, "Empty trash", the About screen's GitHub and Sponsor links, and the new encrypted-backup buttons. They now use a `.btn-row` class. This was the same root cause as the invisible Insights footer fixed in 14.4.0.

### Verified

- The end-to-end suite grew from 86 to **92 checks**: an encrypt→decrypt round-trip that compares the full document, a wrong passphrase being rejected, strict envelope detection (valid / plain database / junk), the encrypted-backup dialog, bulk selection counting, bulk delete with undo, and bulk move across days.

## [14.4.0] — 2026-11-11

Looking back. The planner could tell you what to do today; now it can show you what
the year actually looked like. Data schema unchanged.

### Added

- **Insights view** (`I`, or the rail): a year heatmap where every square is a day and the shade is how much of it you finished, four headline numbers (done in the year, days planned, best streak, busiest weekday), a 30-day trend, and your most-used tags. Clicking a square opens that day.
- **Best streak** — the longest run of consecutive days with at least one completed task, computed across gaps rather than per-day.
- **Tag index and filtering** — `#tag` is now a first-class query. Click any tag pill on a task, or a tag in Insights, to see everything carrying it; typing `#health` in search filters to that tag alone.
- **Year view links to Insights** for the year you are looking at.

### Changed

- Search results and the palette now match tags as well as text.
- The Insights heatmap scrolls to the most recent weeks on narrow screens instead of starting in January.

### Fixed

- The 30-day trend bars all rendered at the same height: the bar used `class="empty"`, which collided with the app's `.empty` empty-state utility (26 px padding top and bottom → every bar was exactly 52 px). Bars are now sized in pixels and the class is `bar-zero`.
- The Insights footer row was invisible on desktop because it reused `.row-actions`, which is `opacity: 0` until a row is hovered.

### Verified

- The end-to-end suite grew from 81 to **86 checks**: heatmap length for a normal and a leap year, heatmap totals, aggregate maths on a known dataset (days planned, done, completion %, best streak stopping at a gap, tag counts), the 30-day window, tag-only search, clicking a tag pill, the Insights render, and the `I` shortcut.

## [14.3.0] — 2026-11-11

Routines. The planner stops assuming every day is hand-built from nothing.
Data schema is additive — existing v14 documents open as-is.

### Added

- **Repeating tasks.** A rule is `daily`, `weekdays`, or a set of weekdays. Instances are ordinary todos carrying `recurringId`, materialised lazily when a day is opened — so a missed day fills itself in, nothing is duplicated, and the stored document stays small. Set a repeat in quick add, or from any task's details.
- **Repeating-tasks manager** in Settings: pause/resume and delete rules, with the human label ("weekdays", "every Sun").
- **Day templates.** Save a day's time blocks and tasks (with their estimates, times and tags) under a name, then apply that template to any date. Duplicate task text is skipped.
- **Time estimates.** Tasks can carry an estimate in minutes; quick add reads `45m`, `2h` and `1h 30m`. The day and Today views show a planned-vs-capacity bar, which turns amber and names the overrun when you book more hours than the day has.
- **Daily capacity** setting (default 8 hours), so the bar measures against your day, not an assumption.

### Changed

- Task rows gained a details action (`⋯`) that opens estimate + repeat together, instead of one control per attribute.
- Row metadata now shows a repeat icon, the estimate and the time as compact pills.

### Verified

- The end-to-end suite grew from 73 to **81 checks**: estimate parsing (`45m`, `2h`, `1h 30m`), the over-capacity bar, idempotent materialisation (a rule creates exactly one instance per day, twice in a row), weekday rules skipping Saturday, repeat creation from quick add with the task linked to its rule, pause/resume in Settings, the details dialog, and template save → apply including estimates.

## [14.2.0] — 2026-11-11

Interaction. The list becomes something you can shape, and adding a task stops
feeling like filling in a form. Data schema unchanged; existing v14 data opens
as-is.

### Added

- **Drag to reorder.** Every task row has a handle. Dragging moves the row in the DOM for live feedback and the order is rebuilt from the final DOM on drop, so a partial drag can never corrupt the list. Works with pointer events, so mouse, pen and touch all behave.
- **Keyboard-first list.** `j` / `k` move a visible cursor through the list, `x` ticks, `e` edits, `Alt + ↑ / ↓` reorders. The cursor survives a re-render, so ticking a task does not throw you back to the top.
- **Natural-language quick add.** `call the clinic tomorrow 4pm #health` becomes a task on tomorrow at 16:00, tagged `health`. Understands `today`/`tomorrow`/`yesterday`, weekday names with `next`, `25 dec` / `dec 25`, `4pm` / `16:00`, `#tags` and `!!` for priority — with a live "Saves as:" preview before you commit.
- **Copy a day.** Bring another day's time blocks and tasks (added unchecked) into the current day, with per-type checkboxes and duplicate-text skipping.
- **Minified production build.** `npm run build:web` now minifies CSS and JS (whitespace and syntax only, identifiers untouched so cross-file globals keep working): 167 KB → 123 KB, −27 %.

### Changed

- Task rows now carry a drag handle, a metadata area for the time and tags, and a stable `data-row-id`.
- The quick-add dialog is one text field plus an optional date override, instead of two fields and a checkbox.
- `README`, `ENHANCEMENTS` and the About screen document the new keys and the copy-day action.

### Verified

- The end-to-end suite grew from 65 to **73 checks**: a real pointer drag that reorders and persists, `j`/`k`/`x`/`Alt+Arrow`, quick-add parsing (with and without matches), the preview matching what is saved, and copy-day semantics (blocks copied, tasks copied unchecked, duplicates skipped).
- The minified bundle was loaded in a browser and exercised separately — profile creation, task add, palette and parser all behave identically to the readable source.

## [14.1.0] — 2026-11-11

Safety and speed-of-use. No new concepts, only fewer ways to lose work and fewer
round trips to do the obvious thing. Data schema unchanged — existing v14 data
opens as-is.

### Added

- **Undo on every destructive action.** Deleting a task, removing a time block, clearing completed tasks and carrying tasks over all show an undo toast (8 seconds) that puts things back exactly where they were.
- **Recently deleted (30-day trash).** Anything you delete is kept for 30 days under Settings → Recently deleted, with per-item restore, permanent delete and "empty trash". The list prunes itself and is capped at 300 entries.
- **Backup nudge.** If you have never exported, or last exported more than 14 days ago, the Today view shows a one-line reminder with an export button and a "Later" snooze (3 days).
- **PWA update prompt.** When a new service worker is cached, the app offers "A new version is ready — Reload" instead of silently running yesterday's build.
- **ICS export.** Day and Week views export a real `.ics` calendar file (RFC 5545, CRLF, folded lines, escaped text) built from your time blocks, so a day can land in Google or Apple Calendar without any integration.
- **Date jumps in the command palette.** Type `tomorrow`, `yesterday`, `next friday`, `25 dec`, `dec 25` or `2026-12-24` and the palette offers to open that day.
- **Inline editing.** Clicking a task's text turns it into a field in place; Enter saves, Escape cancels, clicking away saves. The edit dialog is gone.
- **Accessibility.** A skip link, a polite live region that announces deletions, and `aria-live` on the toast.

### Changed

- Exports now record when the last backup happened (`lastExportAt`), which drives the nudge.
- The delete toast names the item ("Deleted “Walk 30 minutes”") instead of saying "Deleted".

### Fixed

- The command palette could show a stale item list while typing a date — the date jump is now built into the same list as the commands.

### Verified

- The end-to-end suite grew from 53 to **65 checks**, covering undo, trash restore and expiry, the backup nudge, ICS output and escaping, date parsing, inline editing (including Escape), the skip link and the live region.

## [14.0.0] — 2026-11-11

The rewrite. Same planner, rebuilt as a small offline app instead of a single
long page: split into modules, given a real layout system, a router, an automated
test suite, and a licence and attribution trail.

### Added

- **Router with deep links** (`#/day/2026-11-11`, `#/week/2026-11-09`, `#/year/2026`) — the back button, refresh and bookmarks all work.
- **Command palette** (`Ctrl/⌘ K`) — searches every task, note, block, goal and intention, and runs commands (jump, add, export, print, theme, lock).
- **Keyboard shortcuts** — `N`, `T`, `D`, `W`, `Y`, `A`, `/`, `1–5`, `Esc`.
- **Week navigation** with real calendar weeks, weekly focus line and weekly goals.
- **Month goals** on the year view, with per-month completion progress.
- **Archive view** — restore, export or delete an archived year; manual "Archive year" action; automatic archiving of finished years (toggleable).
- **Carry-over** of unfinished tasks from the previous day, in one click.
- **Search view** with grouped, highlighted results across all years.
- **Streak counter** and a 7-day completion bar chart.
- **Four themes** (Midnight, Ocean, Light, System) with a proper light palette and `prefers-color-scheme` support.
- **Responsive app shell** — sidebar on desktop, icon rail on tablets, bottom tab bar + FAB on phones, no horizontal scroll down to 320 px.
- **PWA** — manifest, service worker precache, install prompt, offline after first load.
- **Settings** — rename profile, change PIN (verified against the current PIN), week start, auto-archive, ask-for-PIN-on-launch, storage usage, full JSON import/export, Markdown export.
- **Markdown export** for a single day and for the entire planner.
- **Print stylesheet** for the current view.
- **About screen** with shortcuts, data model, licence and attribution.
- **Automated test suite** — `npm test` drives the real app in headless Chromium through 53 checks covering every function and four viewport sizes.
- Versioned storage (`planner_v14`) with automatic migration from `planner_v13_enterprise`.

### Changed

- Layout rewritten around an app shell: a persistent rail/tab bar instead of top tabs, a sticky top bar, and cards with a single accent colour instead of gradient headings.
- Type scale, spacing, borders and radii normalised into design tokens; tabular numbers for all counts.
- Touch targets raised to 44 px; visible focus rings; `aria-current` on navigation; reduced-motion support.
- Saves are debounced (220 ms) instead of writing the whole document on every keystroke, with a "Saved" indicator.
- Weeks are keyed by their start date (`2026-11-09`) instead of a weekday name, so a plan belongs to one week only.
- Days are keyed by full date instead of a per-year bucket.

### Fixed

- **Auto-login bypass.** v13 persisted `activeUser` and opened straight into the planner, so anyone with the device was inside the profile. The PIN is now required on launch by default (and can be turned off in Settings).
- **Time blocks wrote the wrong field.** `addTimeBlock()` stored `task`, the renderer read `s.task` while other paths wrote `text`, and a default block stored `text` — so block text could render as `undefined`.
- **Rendering mutated data.** The day view pushed an empty placeholder block into storage on every render of an empty schedule.
- **Cross-year editing wrote to the wrong year.** Daily data was fetched through `new Date().getFullYear()`, so editing any date in another year silently wrote into the current year's bucket.
- **Weekly plans repeated forever.** Weekly goals were keyed by weekday name with no week navigation, so the same "Monday" plan showed every week.
- **Year rollover was unreliable.** It ran only when the current year had no data at all, could not be triggered manually, and archived data was not viewable or recoverable.
- **Downloads failed in Firefox.** Export links were clicked without being attached to the document.
- **"Md" export was not Markdown.** It wrote plain text with a `.md` filename; real Markdown export now exists.
- **PIN change did not verify the current PIN**, so anyone in an unlocked session could change it.
- **Duplicate clock timers** were left running on every app re-entry.
- **Week header mutated `today`** via `setDate()` while computing Monday, which shifted subsequent date maths.
- **Archive rendering could throw** when a year's goal list was not an array.
- **Long task text was unreadable** — items were forced to one line with an ellipsis.
- **Blocking `prompt()`/`alert()`/`confirm()`** replaced with a styled dialog and inline validation.
- **No error handling for storage failures** — a full quota now warns instead of failing silently, and a corrupt document is quarantined rather than deleted.

### Removed

- The single-file 824-line `planner.html` (superseded by `app/`), the duplicated year-bucket helpers, and the unused `timerInterval`/`debounceSave` stubs.

### Migration

Existing v13 data is migrated on first launch: daily entries and time blocks are
carried over, archived years are carried over, and the old weekly/monthly plans
(which had no real dates) become year goals prefixed with `Weekly ·` or the month
name so nothing is lost. v13 remembered the logged-in user; v14 asks for the PIN.

---

## Earlier versions

v1–v13 existed as a single `planner.html` file with daily/weekly/yearly tabs,
multi-user PIN profiles and JSON export. No changelog was kept before 14.0.0.
