// Spaced repetition: pure functions, shared by the app and the tests.
//
// A card's state: { step, due, lastReviewed, lapses, updatedAt } (times in ms).
// Words never seen have no state. Step 0 = learning; steps 1-7 map to INTERVAL_DAYS.

export const INTERVAL_DAYS = [0, 1, 3, 7, 16, 35, 75, 160];
export const MAX_STEP = INTERVAL_DAYS.length - 1;
export const MASTERED_STEP = 4; // 16+ day interval
export const REINSERT_GAP = 4; // a missed card comes back after this many other answers
const DAY = 86400000;

export function review(prev, remembered, now) {
  if (!remembered) {
    return { step: 0, due: now, lastReviewed: now, lapses: (prev?.lapses ?? 0) + 1, updatedAt: now };
  }
  // Studying ahead (reviewing before the due date) keeps the step, so early
  // reviews never inflate the interval; the clock simply restarts from now.
  const early = prev && prev.step > 0 && prev.due > now;
  const step = early ? prev.step : Math.min((prev?.step ?? 0) + 1, MAX_STEP);
  return { step, due: now + INTERVAL_DAYS[step] * DAY, lastReviewed: now, lapses: prev?.lapses ?? 0, updatedAt: now };
}

// Deterministic shuffle so every device introduces new words in the same order.
export function shuffledIds(ids, seed) {
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...ids];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function newSession() {
  return { served: 0, pending: [], lastId: null };
}

// Record an answer in the session (the card state itself comes from review()).
export function recordAnswer(session, id, remembered) {
  session.served += 1;
  session.lastId = id;
  session.pending = session.pending.filter((p) => p.id !== id);
  if (!remembered) session.pending.push({ id, at: session.served + REINSERT_GAP });
}

// Pick the next card id. Order: missed cards whose slot came up, due cards
// (oldest first), new cards (shuffled), then study-ahead (soonest due first).
// The deck never runs out.
export function nextCard(order, cards, session, now) {
  const ready = session.pending.filter((p) => p.at <= session.served).sort((x, y) => x.at - y.at);
  if (ready.length) return ready[0].id;

  const blocked = new Set(session.pending.map((p) => p.id));
  if (session.lastId != null) blocked.add(session.lastId);
  const seen = order.filter((id) => cards[id] && !blocked.has(id));

  const due = seen.filter((id) => cards[id].due <= now).sort((x, y) => cards[x].due - cards[y].due);
  if (due.length) return due[0];

  const fresh = order.find((id) => !cards[id] && !blocked.has(id));
  if (fresh != null) return fresh;

  const ahead = seen.sort((x, y) => cards[x].due - cards[y].due);
  if (ahead.length) return ahead[0];

  // Only blocked cards left (tiny decks): fall back to the earliest pending, then the last card.
  const anyPending = [...session.pending].sort((x, y) => x.at - y.at)[0];
  return anyPending ? anyPending.id : session.lastId;
}

export function cardStatus(state) {
  if (!state) return "new";
  return state.step >= MASTERED_STEP ? "mastered" : "learning";
}

export function stats(order, cards, now) {
  const today = new Date(now).toDateString();
  const s = { new: 0, learning: 0, mastered: 0, today: 0 };
  for (const id of order) {
    const st = cards[id];
    s[cardStatus(st)] += 1;
    if (st && new Date(st.lastReviewed).toDateString() === today) s.today += 1;
  }
  return s;
}

// Merge two progress snapshots. Per card, the newest updatedAt wins.
// A reset (resetAt) discards every card state recorded before it.
export function mergeProgress(a, b) {
  const resetAt = Math.max(a.resetAt ?? 0, b.resetAt ?? 0);
  const sa = a.settings ?? { seed: null, seedUpdatedAt: -1 };
  const sb = b.settings ?? { seed: null, seedUpdatedAt: -1 };
  const settings = sb.seedUpdatedAt > sa.seedUpdatedAt ? sb : sa;
  const cards = {};
  for (const src of [a.cards ?? {}, b.cards ?? {}]) {
    for (const [id, st] of Object.entries(src)) {
      if (st.updatedAt <= resetAt) continue;
      if (!cards[id] || st.updatedAt > cards[id].updatedAt) cards[id] = st;
    }
  }
  return { version: 1, resetAt, settings, cards };
}
