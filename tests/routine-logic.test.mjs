import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const match = html.match(/<script id="routine-logic">([\s\S]*?)<\/script>/);
assert.ok(match, 'routine-logic script block not found in index.html');
const { TIMER_MS, getRoutineState, canToggle, finishedInTime, drawAvatar } = vm.runInNewContext(
  match[1] + ';({TASKS,TIMER_MS,getRoutineState,canToggle,finishedInTime,drawAvatar})',
  {}
);

const T = 1_000_000;
const tasks = (s) => ({ ...s.tasks });

test('timer lasts 10 minutes', () => {
  assert.equal(TIMER_MS, 600_000);
});

test('past day is free', () => {
  const s = getRoutineState({ toilet: true }, T, false);
  assert.equal(s.phase, 'free');
  assert.deepEqual(tasks(s), { toilet: 'done', clothes: 'open', backpack: 'open', teeth: 'open' });
  assert.equal(canToggle(s, 'teeth'), true);
  assert.equal(canToggle(s, 'toilet'), true);
});

test('idle locks all but toilet', () => {
  const s = getRoutineState(undefined, T, true);
  assert.equal(s.phase, 'idle');
  assert.deepEqual(tasks(s), { toilet: 'open', clothes: 'locked', backpack: 'locked', teeth: 'locked' });
  assert.equal(canToggle(s, 'clothes'), false);
  assert.equal(canToggle(s, 'toilet'), true);
});

test('legacy toilet without timerStart is free', () => {
  const s = getRoutineState({ toilet: true }, T, true);
  assert.equal(s.phase, 'free');
});

test('legacy ticks without toilet and timerStart are free', () => {
  const s = getRoutineState({ teeth: true }, T, true);
  assert.equal(s.phase, 'free');
  assert.equal(s.tasks.teeth, 'done');
});

test('legacy day with everything unticked again locks back to idle', () => {
  const s = getRoutineState({ toilet: false, teeth: false }, T, true);
  assert.equal(s.phase, 'idle');
});

test('running after toilet', () => {
  const s = getRoutineState({ toilet: true, timerStart: T }, T + 60_000, true);
  assert.equal(s.phase, 'running');
  assert.equal(s.remainingMs, 540_000);
  assert.deepEqual(tasks(s), { toilet: 'done', clothes: 'open', backpack: 'locked', teeth: 'locked' });
  assert.equal(canToggle(s, 'toilet'), false);
  assert.equal(canToggle(s, 'backpack'), false);
  assert.equal(canToggle(s, 'clothes'), true);
});

test('clothes unlocks rest', () => {
  const s = getRoutineState({ toilet: true, clothes: true, timerStart: T }, T + 1, true);
  assert.equal(s.tasks.backpack, 'open');
  assert.equal(s.tasks.teeth, 'open');
  assert.equal(canToggle(s, 'clothes'), true);
});

test('unticked clothes keeps done later tasks', () => {
  const s = getRoutineState({ toilet: true, backpack: true, timerStart: T }, T + 1, true);
  assert.equal(s.tasks.backpack, 'done');
  assert.equal(s.tasks.teeth, 'locked');
});

test('all done before deadline', () => {
  const day = { toilet: true, clothes: true, backpack: true, teeth: true, timerStart: T };
  const s = getRoutineState(day, T + 1, true);
  assert.equal(s.phase, 'done');
  assert.equal(canToggle(s, 'teeth'), true);
  assert.equal(canToggle(s, 'toilet'), false);
});

test('finishing the last task before the deadline counts as in time', () => {
  const before = getRoutineState({ toilet: true, clothes: true, backpack: true, timerStart: T }, T + 1, true);
  const after = getRoutineState({ toilet: true, clothes: true, backpack: true, teeth: true, timerStart: T }, T + 1, true);
  assert.equal(finishedInTime(before, after), true);
});

test('ticking on a free day is not finishing in time', () => {
  const before = getRoutineState({ toilet: true, clothes: true, backpack: true }, T, false);
  const after = getRoutineState({ toilet: true, clothes: true, backpack: true, teeth: true }, T, false);
  assert.equal(finishedInTime(before, after), false);
});

test('ticking while still running is not finishing in time', () => {
  const before = getRoutineState({ toilet: true, timerStart: T }, T + 1, true);
  const after = getRoutineState({ toilet: true, clothes: true, timerStart: T }, T + 1, true);
  assert.equal(finishedInTime(before, after), false);
});

test('expired marks missed', () => {
  const s = getRoutineState({ toilet: true, clothes: true, timerStart: T }, T + TIMER_MS, true);
  assert.equal(s.phase, 'expired');
  assert.deepEqual(tasks(s), { toilet: 'done', clothes: 'done', backpack: 'missed', teeth: 'missed' });
  for (const id of ['toilet', 'clothes', 'backpack', 'teeth']) {
    assert.equal(canToggle(s, id), false);
  }
});

const AVATARS = ['mario', 'yoshi', 'pikachu', 'alex'];

function drawMany(n, rand = Math.random) {
  let queue = [];
  let last = null;
  const shown = [];
  for (let i = 0; i < n; i++) {
    const r = drawAvatar(queue, last, AVATARS, rand);
    queue = r.queue;
    last = r.id;
    shown.push(r.id);
  }
  return shown;
}

test('every avatar shows once before any repeats', () => {
  for (let run = 0; run < 50; run++) {
    const shown = drawMany(4);
    assert.deepEqual([...shown].sort(), [...AVATARS].sort());
  }
});

test('the same avatar never shows twice in a row, even across reshuffles', () => {
  for (let run = 0; run < 50; run++) {
    const shown = drawMany(40);
    for (let i = 1; i < shown.length; i++) assert.notEqual(shown[i], shown[i - 1]);
  }
});

test('drawAvatar does not mutate the queue it is given', () => {
  const queue = ['yoshi', 'alex'];
  const r = drawAvatar(queue, 'mario', AVATARS, Math.random);
  assert.equal(r.id, 'yoshi');
  assert.deepEqual(r.queue, ['alex']);
  assert.deepEqual(queue, ['yoshi', 'alex']);
});

test('stale queue entries that are not known avatars are skipped', () => {
  const r = drawAvatar(['luigi', 'alex'], null, AVATARS, Math.random);
  assert.equal(r.id, 'alex');
});
