// Run: node --test tools/reading.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { mergeReading, pickNext, pickRedo, readingStats, history, timeline, addHighlight, emptyReading, DAY, PURGE_BEFORE } from "../docs/reading-core.js";

const Q = [
  { id: "a", type: "inferences", difficulty: "band7" },
  { id: "b", type: "inferences", difficulty: "band7" },
  { id: "c", type: "quantitative", difficulty: "band6" },
  { id: "d", type: "cross-text", difficulty: "band7" },
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
  for (let i = 0; i < 20; i++) assert.notEqual(pickNext(Q, attempts).id, "a");
  assert.equal(pickNext(Q, attempts, { type: "inferences" }).id, "b");
  assert.equal(pickNext(Q, { ...attempts, b: { correct: false, at: 2, ms: 1 } }, { type: "inferences" }), null);
  assert.equal(pickNext(Q, {}, {}, () => 0, "a").id, "b"); // skips the excluded question
});

test("pickNext serves banded questions before the older set and filters by band", () => {
  const O = Q.map((q) => ({ ...q, difficulty: "older" }));
  const B = [...O, { id: "e", type: "inferences", difficulty: "band7" }, { id: "f", type: "transitions", difficulty: "band6" }];
  for (let i = 0; i < 20; i++) assert.ok(["e", "f"].includes(pickNext(B, {}).id));
  assert.equal(pickNext(B, { e: { correct: true }, f: { correct: true } }, {}, () => 0).id, "a"); // then the older set
  assert.equal(pickNext(B, {}, { band: "band6" }).id, "f");
  assert.equal(pickNext(B, {}, { type: "inferences", band: "older" }, () => 0).id, "a");
  assert.equal(pickNext(B, {}, { type: "transitions", band: "band7" }), null);
});

test("pickRedo only returns questions answered wrong", () => {
  const attempts = { a: { correct: true }, b: { correct: false }, c: { correct: false } };
  assert.equal(pickRedo(Q, attempts, { type: "inferences" }).id, "b");
  assert.equal(pickRedo(Q, attempts, { type: "cross-text" }), null);
  assert.equal(pickRedo(Q, attempts, {}, () => 0, "b").id, "c");
  assert.equal(pickRedo(Q, attempts, { band: "band6" }).id, "c");
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
  assert.equal(s.byType.inferences.solved, 2);
  assert.equal(s.byType.inferences.accuracy, 0.5);
  assert.equal(s.byBand.band7.solved, 3);
  assert.equal(s.byBand.band6.solved, 1);
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

test("older-set answers never count in stats or the time chart", () => {
  const QO = [...Q, { id: "inf-001", type: "inferences", difficulty: "older" }];
  const attempts = { a: { correct: true, ms: 1000, at: 5 }, "inf-001": { correct: false, ms: 9000, at: PURGE_BEFORE + 1 } };
  const s = readingStats(QO, attempts, PURGE_BEFORE + 10);
  assert.equal(s.all.solved, 1);
  assert.equal(s.byType.inferences.solved, 1);
  assert.equal(s.byBand.older, undefined);
  assert.deepEqual(timeline(QO, attempts).map((a) => a.id), ["a"]);
});

test("merge deletes older-set data from before the purge but keeps later answers", () => {
  const before = PURGE_BEFORE - 1, after = PURGE_BEFORE + 1;
  const r = {
    attempts: { "inf-001": { correct: true, at: before }, "qnt-120": { correct: false, at: after }, "h-b1-01": { correct: true, at: before } },
    marks: { "str-003": { highlights: [], updatedAt: before }, "evi-010": { highlights: [], updatedAt: after } },
  };
  const m = mergeReading(r, {});
  assert.deepEqual(Object.keys(m.attempts).sort(), ["h-b1-01", "qnt-120"]);
  assert.deepEqual(Object.keys(m.marks), ["evi-010"]);
});

test("timeline is oldest first and filters by type", () => {
  const attempts = { a: { correct: true, ms: 1, at: 30 }, b: { correct: false, ms: 2, at: 10 }, c: { correct: true, ms: 3, at: 20 } };
  assert.deepEqual(timeline(Q, attempts).map((a) => a.id), ["b", "c", "a"]);
  assert.deepEqual(timeline(Q, attempts, "inferences").map((a) => a.id), ["b", "a"]);
});
