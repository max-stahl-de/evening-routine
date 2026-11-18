# Abendroutine: Locked order + 10-minute deadline

## Intent
Give the evening routine a fixed order and a time pressure: toilet first, then changing clothes, then the rest — all within 10 minutes of the toilet. Unfinished tasks forfeit their points.

## Behavior (today only)
- Initially only "Auf Toilette gehen" is tappable; others are greyed out with 🔒.
- Ticking the toilet stores `timerStart` (timestamp) on today's entry, starts a 10-min countdown and unlocks "Umziehen".
- Ticking "Umziehen" unlocks "Schulranzen packen" and "Zaehne putzen".
- While the timer runs, the progress ring shows the remaining time (`m:ss`, label "übrig") and the ring drains like an iOS timer.
- All four ticked before the deadline → timer stops, ring shows points again; surprise/confetti logic unchanged.
- Deadline reached → ring shows points again; unticked tasks are marked "⏰ Zeit um" and can't be ticked today (points lost).
- Once the timer runs, the toilet can't be unticked. Other tasks can be unticked before the deadline. After the deadline everything is frozen.
- No sound/alarm on expiry.

## Non-goals
- Locks/timer on past days: they keep free ticking (parent corrections).
- Configurable duration.

## Approaches
- **Chosen:** persist `timerStart` in today's day data in localStorage; derive locks, countdown and expiry from it. Survives reload and screen lock.
- Rejected: in-memory timer — resets on reload.

## Left to the builder
Exact styling of locked/missed cards; tick interval (1s via setInterval, recomputed from timestamp).
