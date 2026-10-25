import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MISSIONS, createState, applyPuzzle, applyCare,
  rescueCount, restoreState, serializeState
} from '../src/missions.js';

for (const mission of MISSIONS) {
  test(`${mission.id}: incorrect puzzle and care choices never skip progress; completion is idempotent`, () => {
    const state = createState();
    const p = state.missions[mission.id];
    assert.equal(applyCare(state, mission.id, mission.careSteps[0].correct).ok, false);
    assert.equal(p.careStep, 0);
    for (const wrong of [null, undefined, {}, [], '', ['wrong'], 314, '__proto__']) {
      assert.equal(applyPuzzle(state, mission.id, wrong).ok, false);
      assert.equal(p.unlocked, false);
    }
    assert.equal(applyPuzzle(state, mission.id, mission.puzzle.solution).ok, true);
    assert.equal(p.unlocked, true);
    for (const [index, step] of mission.careSteps.entries()) {
      assert.equal(applyCare(state, mission.id, 'wrong').ok, false);
      assert.equal(p.careStep, index);
      const result = applyCare(state, mission.id, step.correct);
      assert.equal(result.ok, true);
      assert.equal(result.completed, index === mission.careSteps.length - 1);
      assert.equal(p.careStep, index + 1);
    }
    assert.equal(p.rescued, true);
    assert.equal(rescueCount(state), 1);
    const saved = serializeState(state);
    assert.equal(applyCare(state, mission.id, 'wrong').completed, true);
    assert.equal(applyPuzzle(state, mission.id, null).ok, true);
    assert.equal(serializeState(state), saved);
  });
}

test('all four rescues can finish in any order, with no cross-mission unlocking', () => {
  const state = createState();
  for (const [index, mission] of [...MISSIONS].reverse().entries()) {
    applyPuzzle(state, mission.id, mission.puzzle.solution);
    for (const step of mission.careSteps) applyCare(state, mission.id, step.correct);
    assert.equal(rescueCount(state), index + 1);
    for (const other of MISSIONS.filter(m => !state.missions[m.id].rescued)) {
      assert.equal(state.missions[other.id].unlocked, false);
    }
  }
  assert.equal(rescueCount(state), 4);
});

test('code leading/trailing whitespace is allowed; sequence order, type and length are exact', () => {
  assert.equal(applyPuzzle(createState(), 'tiger', ' 314 ').ok, true);
  assert.equal(applyPuzzle(createState(), 'pangolin', ['moon', 'moon', 'leaf', 'sun']).ok, false);
  assert.equal(applyPuzzle(createState(), 'pangolin', ['moon', 'leaf', 'moon', 'sun', 'sun']).ok, false);
  assert.equal(applyPuzzle(createState(), 'turtle', ['1', '3', '2']).ok, false);
  assert.equal(applyPuzzle(createState(), 'elephant', ['treat', 'secure', 'observe']).ok, false);
});

test('partial care progress, viewpoint, navigation and elapsed time survive a save', () => {
  const state = createState();
  applyPuzzle(state, 'tiger', '314');
  applyCare(state, 'tiger', MISSIONS[0].careSteps[0].correct);
  state.elapsed = 82.5;
  state.player = { x: -12, z: -13, yaw: 0.5 };
  state.cameraMode = 'first';
  state.selectedMission = 'turtle';
  assert.deepEqual(restoreState(serializeState(state)), state);
  const restored = restoreState(serializeState(state));
  applyCare(restored, 'tiger', MISSIONS[0].careSteps[1].correct);
  assert.equal(restored.missions.tiger.careStep, 2);
  assert.equal(state.missions.tiger.careStep, 1, 'restored object must not alias the original');
});

test('malformed, incomplete and inconsistent saves are rejected', () => {
  for (const raw of [null, undefined, '', '{', '[]', 'null', '{}', 'true', 1, []]) assert.equal(restoreState(raw), null);
  const mutations = [
    s => { s.version = 9; },
    s => { delete s.missions.tiger; },
    s => { s.missions.tiger.careStep = 1; },
    s => { s.missions.tiger.rescued = true; },
    s => { s.missions.tiger.unlocked = 'yes'; },
    s => { s.missions.tiger.careStep = -1; },
    s => { s.missions.tiger.careStep = 4; },
    s => { s.missions.tiger.careStep = 0.5; },
    s => { s.missions.tiger.attempts = -1; },
    s => { s.elapsed = NaN; },
    s => { s.elapsed = -1; },
    s => { s.player.x = Infinity; },
    s => { s.player.z = '12'; },
    s => { s.player = null; }
  ];
  for (const mutate of mutations) {
    const state = createState(); mutate(state);
    assert.equal(restoreState(state), null);
    assert.throws(() => serializeState(state), TypeError);
  }
});

test('valid saves clamp navigation to the playable area and strip extra fields', () => {
  const state = createState();
  state.player = { x: 1000, z: -1000, yaw: Math.PI * 5 };
  state.elapsed = 1e12;
  state.missions.tiger.attempts = 1e12;
  state.cameraMode = 'invalid';
  state.selectedMission = 'invalid';
  state.evil = 'discard';
  const restored = restoreState(state);
  assert.deepEqual(restored.player, { x: 36, z: -46, yaw: Math.atan2(Math.sin(Math.PI * 5), Math.cos(Math.PI * 5)) });
  assert.equal(restored.elapsed, 864000);
  assert.equal(restored.missions.tiger.attempts, 1000000);
  assert.equal(restored.cameraMode, 'third');
  assert.equal(restored.selectedMission, 'tiger');
  assert.equal('evil' in restored, false);
});

test('unknown mission identifiers fail without modifying state', () => {
  const state = createState();
  const before = serializeState(state);
  for (const id of ['missing', '__proto__', 'constructor', null]) {
    assert.equal(applyPuzzle(state, id, '314').ok, false);
    assert.equal(applyCare(state, id, 'clean').ok, false);
  }
  assert.equal(serializeState(state), before);
});

test('mission content provides valid answers, unique options and source links', () => {
  assert.equal(new Set(MISSIONS.map(m => m.id)).size, 4);
  for (const mission of MISSIONS) {
    assert.match(mission.source, /^https:\/\//);
    assert.ok(mission.fact.length > 30);
    for (const step of mission.careSteps) {
      assert.equal(step.options.filter(option => option.id === step.correct).length, 1);
      assert.equal(new Set(step.options.map(option => option.id)).size, step.options.length);
    }
  }
});
