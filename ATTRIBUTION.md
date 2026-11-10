# Attribution

Planner Pro is original code. This file credits the ideas it borrows, the books
those ideas come from, and the tools used to build and test it.

## Ideas from books

The planner's structure is not invented from nothing — it follows well-known
planning methods. **No text from these books is reproduced anywhere in this
repository or app.** Titles and authors are used for attribution only; there is
no affiliation with, sponsorship by, or endorsement from any author or publisher.

| Feature in Planner Pro | Idea | Source |
|---|---|---|
| Brain dump / quick capture, weekly review, "next action" framing | Capture everything, clarify later, review weekly | David Allen, *Getting Things Done: The Art of Stress-Free Productivity* (2001) |
| Time blocks on the day view, deep-work blocks | Schedule work in blocks, protect long uninterrupted stretches | Cal Newport, *Deep Work: Rules for Focused Success in a Distracted World* (2016) |
| Streaks, small daily wins, "keep it going" | Habit formation through consistency and immediate reward | James Clear, *Atomic Habits* (2018) |
| Daily intention line, one highlight per day | Choose a single daily highlight that makes the day count | Jake Knapp & John Zeratsky, *Make Time* (2018) |
| Carry-over of unfinished tasks, monthly log, migration ritual | Migrate open items forward deliberately instead of letting them pile up | Ryder Carroll, *The Bullet Journal Method* (2018) |
| Weekly focus question ("if only one thing gets done…") | The focusing question; one thing at a time | Gary Keller & Jay Papasan, *The One Thing* (2013) |
| Saying no, fewer goals per month/year | Essentialism: less but better | Greg McKeown, *Essentialism: The Disciplined Pursuit of Less* (2014) |
| Realistic planning, accepting that the list never empties | Finitude, prioritising what matters over everything | Oliver Burkeman, *Four Thousand Weeks: Time Management for Mortals* (2021) |

If you want the actual methods, buy the books. They are worth far more than any
app, including this one.

## Software and standards

| Used for | Item | Licence / note |
|---|---|---|
| Week numbering | ISO 8601 week-date convention | Public standard |
| Week-start setting | Locale convention (`weekStart`) | User choice, defaults to Monday |
| Licence text | PolyForm Noncommercial License 1.0.0 | © PolyForm Project, CC BY 4.0 for the licence text itself |
| Icons | Hand-drawn inline SVG symbol set | Original work, part of this project |
| Type | System font stack (`-apple-system`, Segoe UI, Roboto, Noto Sans) | No font files bundled |
| App icon | Generated for this project with Pillow, using DejaVu Sans Bold | DejaVu fonts are under a permissive Bitstream Vera derivative licence; no font file ships with the app |
| Testing | Puppeteer + headless Chromium | Apache-2.0 / BSD-style |
| Android packaging | Capacitor | MIT |
| Desktop packaging | Electron, electron-builder | MIT |
| Hosting | GitHub Pages | GitHub Terms of Service |

## Design influences

- The information density of paper planners (Hobonichi, Leuchtturm weekly spreads).
- The restraint of terminal and code-editor UI: one accent colour, tabular numbers, borders instead of shadows.
- Apple's Human Interface Guidelines and Material's touch-target guidance for the mobile layout (44 px minimum, bottom navigation for primary destinations).

## Appreciation

To the people who write about attention, time and habit honestly — and to everyone
who still prefers a list on paper.

---

Questions about attribution, or a credit missing? Open an issue:
<https://github.com/drsamonline/planner-pro/issues>
