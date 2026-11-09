// Run: node --test tools/reading.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { mergeReading, pickNext, pickRedo, readingStats, history, addHighlight, emptyReading, DAY } from "../docs/reading-core.js";

const Q = [
  { id: "a", type: "inference" },
  { id: "b", type: "inference" },
  { id: "c", type: "quantitative" },
  { id: "d", type: "structure" },
];

test("merge keeps the earliest attempt per question", () => {
  const a = { attempts: { a: { choice: 1, correct: true, ms: 1000, at: 200 } }, marks: {} };
  const b = { attempts: { a: { choice: 2, correct: false, ms: 5000, at: 100 }, b: { choice: 0, correct: true, ms: 1, at: 300 } }, marks: {} };
  const m = mergeReading(a, b);
  assert.equal(m.attempts.a.at, 100);
  assert.equal(m.attempts.a.correct, false);
  assert.ok(m.attempts.b);
  assert.deepEqual(mergeReading(a, b), mergeReading(b, a));
});

test("merge keeps the newest marks per question", () => {
  const a = { attempts: {}, marks: { a: { highlights: [{ start: 0, end: 3, note: "old" }], updatedAt: 10 } } };
  const b = { attempts: {}, marks: { a: { highlights: [], updatedAt: 20 } } };
  assert.deepEqual(mergeReading(a, b).marks.a.highlights, []);
  assert.deepEqual(mergeReading(b, a).marks.a.highlights, []);
});

test("merge tolerates missing or empty input", () => {
  assert.deepEqual(mergeReading(emptyReading(), {}), emptyReading());
  assert.deepEqual(mergeReading(undefined, null), emptyReading());
});

test("pickNext only returns unseen questions of the chosen type", () => {
  const attempts = { a: { correct: true, at: 1, ms: 1 } };
  for (let i = 0; i < 20; i++) assert.notEqual(pickNext(Q, attempts, "all").id, "a");
  assert.equal(pickNext(Q, attempts, "inference").id, "b");
  assert.equal(pickNext(Q, { ...attempts, b: { correct: false, at: 2, ms: 1 } }, "inference"), null);
  assert.equal(pickNext(Q, {}, "all", () => 0, "a").id, "b"); // skips the excluded question
});

test("pickRedo only returns questions answered wrong", () => {
  const attempts = { a: { correct: true }, b: { correct: false }, c: { correct: false } };
  assert.equal(pickRedo(Q, attempts, "inference").id, "b");
  assert.equal(pickRedo(Q, attempts, "structure"), null);
  assert.equal(pickRedo(Q, attempts, "all", () => 0, "b").id, "c");
});

test("stats split by today, 7 days, 30 days and all time", () => {
  const now = new Date(2026, 10, 9, 15, 0).getTime(); // 3 pm local
  const midnight = new Date(2026, 10, 9, 0, 0).getTime();
  const attempts = {
    a: { correct: true, ms: 60000, at: midnight + 1000 },  // today
    b: { correct: false, ms: 30000, at: midnight - 1000 }, // yesterday, inside 7 days
    c: { correct: true, ms: 90000, at: now - 10 * DAY },   // inside 30 days
    d: { correct: true, ms: 120000, at: now - 40 * DAY },  // only all time
  };
  const s = readingStats(Q, attempts, now);
  assert.deepEqual([s.today.solved, s.week.solved, s.month.solved, s.all.solved], [1, 2, 3, 4]);
  assert.equal(s.today.accuracy, 1);
  assert.equal(s.week.accuracy, 0.5);
  assert.equal(s.all.correct, 3);
  assert.equal(s.week.avgMs, 45000);
  assert.equal(s.byType.inference.solved, 2);
  assert.equal(s.byType.inference.accuracy, 0.5);
});

test("stats with no attempts have null accuracy", () => {
  const s = readingStats(Q, {}, Date.now());
  assert.equal(s.all.solved, 0);
  assert.equal(s.all.accuracy, null);
  assert.equal(s.all.avgMs, null);
});

test("history is newest first", () => {
  const h = history({ a: { at: 1 }, b: { at: 3 }, c: { at: 2 } });
  assert.deepEqual(h.map((x) => x.id), ["b", "c", "a"]);
});

test("addHighlight joins overlapping ranges and keeps notes", () => {
  let l = addHighlight([], 10, 20);
  l = addHighlight(l, 30, 40);
  l[0].note = "first";
  l = addHighlight(l, 15, 32);
  assert.deepEqual(l, [{ start: 10, end: 40, note: "first" }]);
  assert.deepEqual(addHighlight(l, 50, 50), l); // empty selection does nothing
  assert.deepEqual(addHighlight([{ start: 0, end: 5, note: "" }], 8, 9).map((h) => h.start), [0, 8]);
});
