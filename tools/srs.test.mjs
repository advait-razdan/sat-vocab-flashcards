// Run: node --test tools/srs.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  review, recordAnswer, nextCard, newSession, shuffledIds, stats, mergeProgress, cardStatus,
  INTERVAL_DAYS, MAX_STEP, REINSERT_GAP,
} from "../docs/srs.js";

const DAY = 86400000;
const T0 = Date.UTC(2026, 9, 28, 12);

test("new word remembered -> step 1, due tomorrow", () => {
  const s = review(undefined, true, T0);
  assert.equal(s.step, 1);
  assert.equal(s.due, T0 + DAY);
  assert.equal(s.lapses, 0);
});

test("remembered on time climbs the ladder and caps at the top", () => {
  let s = review(undefined, true, T0);
  let now = T0;
  for (let i = 2; i <= MAX_STEP + 2; i++) {
    now = s.due;
    s = review(s, true, now);
    assert.equal(s.step, Math.min(i, MAX_STEP));
    assert.equal(s.due, now + INTERVAL_DAYS[s.step] * DAY);
  }
});

test("didn't remember resets to step 0, due now, counts a lapse", () => {
  const s3 = { step: 3, due: T0, lastReviewed: T0 - 7 * DAY, lapses: 1, updatedAt: T0 - 7 * DAY };
  const s = review(s3, false, T0);
  assert.deepEqual(s, { step: 0, due: T0, lastReviewed: T0, lapses: 2, updatedAt: T0 });
});

test("early review keeps the step and restarts the clock", () => {
  const s3 = { step: 3, due: T0 + 5 * DAY, lastReviewed: T0 - 2 * DAY, lapses: 0, updatedAt: T0 - 2 * DAY };
  const s = review(s3, true, T0);
  assert.equal(s.step, 3);
  assert.equal(s.due, T0 + 7 * DAY);
});

test("learning card (step 0) remembered moves to step 1", () => {
  const s = review({ step: 0, due: T0, lapses: 1, lastReviewed: T0, updatedAt: T0 }, true, T0 + 60000);
  assert.equal(s.step, 1);
});

test("shuffle is deterministic per seed and a permutation", () => {
  const ids = Array.from({ length: 312 }, (_, i) => String(i + 1));
  const a = shuffledIds(ids, 42), b = shuffledIds(ids, 42), c = shuffledIds(ids, 43);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.deepEqual([...a].sort(), [...ids].sort());
});

test("queue: due cards first (oldest due), then new, then study-ahead", () => {
  const order = ["a", "b", "c", "d"];
  const cards = {
    b: { step: 1, due: T0 - 2 * DAY },
    c: { step: 1, due: T0 - 5 * DAY },
    d: { step: 2, due: T0 + 3 * DAY },
  };
  const session = newSession();
  assert.equal(nextCard(order, cards, session, T0), "c");
  cards.c = { step: 2, due: T0 + 1 * DAY };
  recordAnswer(session, "c", true);
  assert.equal(nextCard(order, cards, session, T0), "b");
  cards.b = { step: 2, due: T0 + 2 * DAY };
  recordAnswer(session, "b", true);
  assert.equal(nextCard(order, cards, session, T0), "a", "new card once nothing is due");
  cards.a = { step: 1, due: T0 + 4 * DAY };
  recordAnswer(session, "a", true);
  assert.equal(nextCard(order, cards, session, T0), "c", "study ahead: soonest due");
});

test("missed card comes back after REINSERT_GAP other answers, not before", () => {
  const order = Array.from({ length: 10 }, (_, i) => String(i));
  const cards = {};
  const session = newSession();
  let now = T0;
  const first = nextCard(order, cards, session, now);
  cards[first] = review(undefined, false, now);
  recordAnswer(session, first, false);
  const shown = [];
  for (let i = 0; i < REINSERT_GAP; i++) {
    const id = nextCard(order, cards, session, now);
    shown.push(id);
    cards[id] = review(undefined, true, now);
    recordAnswer(session, id, true);
  }
  assert.ok(!shown.includes(first), "missed card must not show early");
  assert.equal(nextCard(order, cards, session, now), first);
});

test("never shows the same card twice in a row when others exist", () => {
  const order = ["a", "b"];
  const cards = { a: { step: 1, due: T0 + DAY }, b: { step: 3, due: T0 + 10 * DAY } };
  const session = newSession();
  recordAnswer(session, "a", true);
  assert.equal(nextCard(order, cards, session, T0), "b");
});

test("deck never runs out, even for one card", () => {
  const session = newSession();
  const cards = {};
  cards.x = review(undefined, false, T0);
  recordAnswer(session, "x", false);
  assert.equal(nextCard(["x"], cards, session, T0), "x");
});

test("stats", () => {
  const now = T0;
  const cards = {
    a: { step: 0, due: now, lastReviewed: now, updatedAt: now },
    b: { step: 4, due: now + 16 * DAY, lastReviewed: now - 20 * DAY, updatedAt: now - 20 * DAY },
  };
  assert.deepEqual(stats(["a", "b", "c"], cards, now), { new: 1, learning: 1, mastered: 1, today: 1 });
  assert.equal(cardStatus(undefined), "new");
});

test("merge: newest updatedAt wins per card, reset discards older states", () => {
  const phone = { resetAt: 0, settings: { seed: 1, seedUpdatedAt: 5 }, cards: {
    a: { step: 2, updatedAt: 200 }, b: { step: 1, updatedAt: 100 } } };
  const mac = { resetAt: 0, settings: { seed: 1, seedUpdatedAt: 5 }, cards: {
    a: { step: 1, updatedAt: 150 }, b: { step: 3, updatedAt: 300 }, c: { step: 1, updatedAt: 50 } } };
  const m = mergeProgress(phone, mac);
  assert.equal(m.cards.a.step, 2);
  assert.equal(m.cards.b.step, 3);
  assert.equal(m.cards.c.step, 1);
  const afterReset = mergeProgress(m, { resetAt: 250, cards: {} });
  assert.deepEqual(Object.keys(afterReset.cards), ["b"]);
});
