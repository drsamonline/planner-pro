# Changelog

All notable changes to Planner Pro. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/).

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
