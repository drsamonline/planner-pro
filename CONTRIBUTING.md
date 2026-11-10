# Contributing

Thanks for looking. This is a small, deliberately boring codebase — no build step
for the app itself, no framework, no transpiler. Please keep it that way.

## Ground rules

1. **No new runtime dependencies.** The app ships zero. If a feature needs a
   library, it probably needs a smaller design instead.
2. **Keep the shell small.** The whole app is ~120 KB uncompressed. A pull request
   that adds 40 KB of CSS for one screen will be asked to shrink.
3. **Every view must survive 320 px.** Test with the browser at 320 px wide before
   opening a PR.
4. **Data changes need a migration.** Storage is versioned (`planner_v14`). If you
   change the shape, add a migration path in `app/assets/js/store.js` and a note in
   `CHANGELOG.md`.
5. **No telemetry, ever.** No analytics, no error reporting endpoints, no remote
   fonts.

## Getting set up

```bash
npm install                 # dev tooling only
npm test                    # 53 end-to-end checks (needs Chromium)
npm start                   # serve app/ at http://localhost:8080
npm run shots               # regenerate docs/screenshots (needs a seeded profile)
```

`npm test` boots the real app in headless Chromium and exercises every function:
profiles, tasks, blocks, week/year views, archive, search, palette, settings,
persistence, lock screen and four viewport sizes. If you add a feature, add a
check to `test/smoke.mjs` — the suite is the spec.

Set `CHROME_PATH` if Chromium is not at the default location:

```bash
CHROME_PATH=/usr/bin/chromium npm test
```

## Code style

- Vanilla ES5-flavoured JavaScript in IIFEs, loaded as classic scripts (so
  `file://` keeps working). No ES modules in `app/`.
- Views are pure functions returning an HTML string; interaction is handled by one
  delegated listener in `app/assets/js/app.js` using `data-act` attributes.
- Escape every user string with `UI.esc()`.
- CSS: design tokens first (`--surface`, `--line`, `--accent`), no hard-coded
  colours, no `!important` unless it is the print stylesheet.

## Reporting a bug

Include: what you did, what you expected, what happened, browser + version, and
whether the app was installed, served, or opened as a file. If the planner lost
data, export the JSON first and attach it with personal content removed.

## Ideas

[ENHANCEMENTS.md](ENHANCEMENTS.md) lists the accepted roadmap with IDs (A1, B3…).
Open an issue using one of those IDs so discussions stay short. Features in the
"deliberately not adding" section will be closed with a link to that section.

## Licence

By contributing you agree your work is licensed under the
[PolyForm Noncommercial 1.0.0](LICENSE), the same terms as the project.
