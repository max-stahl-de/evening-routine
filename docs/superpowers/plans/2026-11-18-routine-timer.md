# Routine Order + 10-Minute Deadline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock tasks into the order toilet → Umziehen → rest, with a 10-minute deadline started by the toilet tick, shown in the progress ring as an iOS-style timer.

**Architecture:** All rules live in one pure function `getRoutineState(dayData, now, isTodayFlag)` inside a separate `<script id="routine-logic">` block in `index.html`. Rendering and tapping only read that state. `timerStart` (ms timestamp) is persisted in today's day data; everything else is derived. A dependency-free Node test extracts the logic block from `index.html` and runs it in `vm`.

**Tech Stack:** Vanilla HTML/CSS/JS (single file), Node 26 `node:test` for tests (no npm deps).

**Spec:** `docs/superpowers/specs/2026-11-18-routine-timer-design.md`

## Global Constraints

- `index.html` stays a single self-contained file. No build step, no npm dependencies.
- Duration: `TIMER_MS = 10 * 60 * 1000`.
- Copy (German, matching existing ASCII umlaut style where the file already uses it): timer label `übrig`, missed marker `⏰ Zeit um`.
- Locks/timer apply to today only. Past days keep free ticking.
- Storage key `abendroutine_data` and shape unchanged except new optional `days[key].timerStart: number`.

## Review Focus

- Reload/screen lock mid-timer → countdown continues from the stored start, not from 10:00. (Task 1 test: state computed from `timerStart` + `now`.)
- Day had toilet ticked before this update shipped (toilet done, no `timerStart`) → no lock-out; treat as `free`. (Task 1 test.)
- Unticking "Umziehen" after "Schulranzen" was ticked → Schulranzen stays done (done is never shown as locked); untouched later tasks re-lock. (Task 1 test.)
- Midnight passes while page open → "today" changes; past day must become freely editable, not stuck in timer. (Task 2: interval re-renders using `isToday(currentDate)`.)
- Timer hits zero while page open → ring switches back to points and cards show missed without a tap. (Task 2: 1s interval re-renders.)

---

### Task 1: Routine state logic + test harness

**Files:**
- Modify: `index.html` (add `<script id="routine-logic">` block before the main `<script>`; move `TASKS` into it)
- Create: `tests/routine-logic.test.mjs`

**Interfaces:**
- Produces (globals in the logic block):
  - `TASKS` (unchanged array, moved here)
  - `TIMER_MS: number`
  - `getRoutineState(dayData: object|undefined, now: number, today: boolean) -> { phase: 'free'|'idle'|'running'|'done'|'expired', remainingMs: number, tasks: { [taskId]: 'open'|'locked'|'done'|'missed' } }`
  - `canToggle(state, taskId: string) -> boolean`

Rules:
- `today === false`, or toilet done without `timerStart` → `free`: every task `done` or `open`, `remainingMs = 0`.
- No `timerStart` → `idle`: toilet `open`, others `locked`.
- `now >= timerStart + TIMER_MS` → `expired`: done stays `done`, rest `missed`.
- All four done (before deadline) → `done`.
- Otherwise `running`, `remainingMs = timerStart + TIMER_MS - now`. Toilet `done`; clothes `done`/`open`; backpack & teeth `done`, else `open` if clothes done, else `locked`.
- `canToggle`: `free` → true; `idle` → only `toilet`; `running`/`done` → status `open`, or status `done` and id ≠ `toilet`; `expired` → false.

- [ ] **Step 1: Write failing tests** in `tests/routine-logic.test.mjs`. Harness: read `index.html`, regex-extract the `<script id="routine-logic">…</script>` body, run it with `vm.runInNewContext(code + ';({TASKS,TIMER_MS,getRoutineState,canToggle})', {})`. Tests (`T = 1_000_000`):
  - `past day is free`: `getRoutineState({toilet:true}, T, false)` → phase `free`, tasks `{toilet:'done', clothes:'open', backpack:'open', teeth:'open'}`; `canToggle(state,'teeth') === true`.
  - `idle locks all but toilet`: `getRoutineState(undefined, T, true)` → `idle`, `{toilet:'open', clothes:'locked', backpack:'locked', teeth:'locked'}`; `canToggle(s,'clothes') === false`, `canToggle(s,'toilet') === true`.
  - `legacy toilet without timerStart is free`: `({toilet:true}, T, true)` → `free`.
  - `running after toilet`: `({toilet:true, timerStart:T}, T + 60_000, true)` → `running`, `remainingMs === 540_000`, `{toilet:'done', clothes:'open', backpack:'locked', teeth:'locked'}`; `canToggle(s,'toilet') === false`.
  - `clothes unlocks rest`: `({toilet:true, clothes:true, timerStart:T}, T+1, true)` → backpack/teeth `open`; `canToggle(s,'clothes') === true`.
  - `unticked clothes keeps done later tasks`: `({toilet:true, backpack:true, timerStart:T}, T+1, true)` → backpack `done`, teeth `locked`.
  - `all done before deadline`: all four true, `now = T+1` → `done`; `canToggle(s,'teeth') === true`, `canToggle(s,'toilet') === false`.
  - `expired marks missed`: `({toilet:true, clothes:true, timerStart:T}, T + TIMER_MS, true)` → `expired`, backpack/teeth `missed`, clothes `done`; `canToggle` false for all.
- [ ] **Step 2: Run** `node --test tests/` → FAIL (no `routine-logic` block found).
- [ ] **Step 3: Implement** the logic block in `index.html` per the rules above; remove `TASKS` from the main script.
- [ ] **Step 4: Run** `node --test tests/` → all pass.
- [ ] **Step 5: Commit** `git add index.html tests && git commit -m "feat: routine order and deadline state logic"`

### Task 2: Wire state into UI (locks, missed, ring timer)

**Files:**
- Modify: `index.html` (CSS block; `renderTasks`, `toggleTask`, `updateProgressRing`, init)

**Interfaces:**
- Consumes: `getRoutineState`, `canToggle`, `TIMER_MS` from Task 1.
- Produces: `currentState()` helper → `getRoutineState(data[dateKey(currentDate)], Date.now(), isToday(currentDate))`.

- [ ] **Step 1: CSS** — `.task-card.locked` (opacity ~0.45, grayscale, no active scale, `cursor: default`), `.task-card.missed` (muted orange border `var(--orange)`, opacity ~0.6). Add `.progress-ring-fill.timer` that disables the 0.8s transition (use `transition: stroke-dashoffset 1s linear`).
- [ ] **Step 2: `renderTasks`** — compute state; card class from status (`done`/`locked`/`missed`); `onclick` only when `canToggle`. Points line: `🔒 + points` text when locked, `⏰ Zeit um` when missed.
- [ ] **Step 3: `toggleTask`** — return early unless `canToggle(currentState(), taskId)`. When ticking `toilet` on today with no `timerStart`, set `data[key].timerStart = Date.now()`. Points/surprise logic unchanged.
- [ ] **Step 4: `updateProgressRing`** — if `currentState().phase === 'running'`: offset = `circumference * (1 - remainingMs / TIMER_MS)`, text `m:ss` (ceil to seconds), `.label` = `übrig`, hide `.surprise-label`, add `.timer` class. Otherwise current points behavior, restore label `von 100`, show surprise label, remove `.timer`. Note: the existing label div needs an id (e.g. `ringLabel`).
- [ ] **Step 5: Ticker** — `setInterval(1000)`: if phase changed since last tick, call `renderTasks()`; always call `updateProgressRing()`. Also re-render on `visibilitychange` (visible). Date nav handlers also call `updateProgressRing()` (ring shows timer only when viewing today).
- [ ] **Step 6: Run** `node --test tests/` → still pass.
- [ ] **Step 7: Manual check** in a browser (`open index.html`): only toilet tappable → tick → ring shows `9:59`, Umziehen unlocks → tick → rest unlocks → reload keeps countdown. Then in devtools set `timerStart` to `Date.now() - 600000` in `abendroutine_data` for today, reload → unticked cards show `⏰ Zeit um`, not tappable, ring shows points. Previous day: all freely tappable.
- [ ] **Step 8: Commit** `git add index.html && git commit -m "feat: lock routine order and show 10-min deadline timer"`
