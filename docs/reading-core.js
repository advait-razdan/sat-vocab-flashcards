// Reading practice: pure functions, shared by the page and the tests.
// History shape: { version, attempts: { [qid]: { choice, correct, ms, at } },
//                  marks: { [qid]: { highlights: [{ start, end, note }], updatedAt } } }

export const DAY = 86400000;

// Answers, highlights and notes on the original question set ("older" ids such as
// inf-001) made before this moment were deleted at the user's request. Merging
// drops them, so they also disappear from the gist on the next sync. Later
// answers to older questions are kept only so those questions aren't repeated.
export const PURGE_BEFORE = 1794394319000;
export const isOlderId = (id) => /^(inf|evi|qnt|str)-\d+$/.test(id);
const purged = (id, t) => isOlderId(id) && !(t >= PURGE_BEFORE);

export function emptyReading() {
  return { version: 1, attempts: {}, marks: {} };
}

// Merge two devices' histories. Only the first attempt at a question counts,
// so the earliest attempt wins. For highlights and notes the newest edit wins.
export function mergeReading(a, b) {
  const attempts = {};
  const marks = {};
  for (const src of [a ?? {}, b ?? {}]) {
    for (const [id, at] of Object.entries(src.attempts ?? {})) {
      if (purged(id, at.at)) continue;
      if (!attempts[id] || at.at < attempts[id].at) attempts[id] = at;
    }
    for (const [id, m] of Object.entries(src.marks ?? {})) {
      if (purged(id, m.updatedAt)) continue;
      if (!marks[id] || m.updatedAt > marks[id].updatedAt) marks[id] = m;
    }
  }
  return { version: 1, attempts, marks };
}

// Whether a question passes the type and band filters ("all" or missing lets everything through).
export function matches(q, filter = {}) {
  const { type = "all", band = "all" } = filter;
  return (type === "all" || q.type === type) && (band === "all" || q.difficulty === band);
}

// A random question not yet attempted that passes the filters.
// With band "all", the new banded questions come before the older set.
// Returns null when every matching question has been done.
export function pickNext(questions, attempts, filter = {}, random = Math.random, exclude = null) {
  const pool = questions.filter((q) => !attempts[q.id] && matches(q, filter) && q.id !== exclude);
  const banded = pool.filter((q) => q.difficulty !== "older");
  const from = banded.length ? banded : pool;
  return from.length ? from[Math.floor(random() * from.length)] : null;
}

// A random question answered wrong, for redo practice once everything is done.
export function pickRedo(questions, attempts, filter = {}, random = Math.random, exclude = null) {
  const pool = questions.filter((q) => attempts[q.id] && !attempts[q.id].correct && matches(q, filter) && q.id !== exclude);
  return pool.length ? pool[Math.floor(random() * pool.length)] : null;
}

function startOfLocalDay(now) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function summarize(list) {
  const solved = list.length;
  const correct = list.filter((a) => a.correct).length;
  const ms = list.reduce((t, a) => t + a.ms, 0);
  return { solved, correct, accuracy: solved ? correct / solved : null, avgMs: solved ? ms / solved : null };
}

// Solved count, accuracy and average time for today (since local midnight),
// the last 7 days, the last 30 days and all time, plus all-time accuracy by type and by band.
// Answers to the older question set never count.
export function readingStats(questions, attempts, now) {
  const all = counted(questions, attempts);
  const since = (t) => all.filter((a) => a.at >= t);
  const byType = {};
  const byBand = {};
  for (const a of all) {
    (byType[a.type ?? "unknown"] ??= []).push(a);
    (byBand[a.band ?? "unknown"] ??= []).push(a);
  }
  return {
    today: summarize(since(startOfLocalDay(now))),
    week: summarize(since(now - 7 * DAY)),
    month: summarize(since(now - 30 * DAY)),
    all: summarize(all),
    byType: Object.fromEntries(Object.entries(byType).map(([t, l]) => [t, summarize(l)])),
    byBand: Object.fromEntries(Object.entries(byBand).map(([b, l]) => [b, summarize(l)])),
  };
}

// Attempts on banded (non-older) questions, with the question's type and band.
function counted(questions, attempts) {
  const byIdQ = new Map(questions.map((q) => [q.id, q]));
  return Object.entries(attempts)
    .filter(([id]) => byIdQ.has(id) && byIdQ.get(id).difficulty !== "older")
    .map(([id, a]) => ({ ...a, id, type: byIdQ.get(id).type, band: byIdQ.get(id).difficulty }));
}

// Counted attempts of one type (or "all"), oldest first, for the time chart.
export function timeline(questions, attempts, type = "all") {
  return counted(questions, attempts)
    .filter((a) => type === "all" || a.type === type)
    .sort((x, y) => x.at - y.at);
}

// Attempts newest first, for the history list.
export function history(attempts) {
  return Object.entries(attempts)
    .map(([id, a]) => ({ id, ...a }))
    .sort((x, y) => y.at - x.at);
}

// Add a highlight over [start, end) to a sorted, non-overlapping list.
// Overlapping or touching highlights are joined; their notes are kept.
export function addHighlight(list, start, end) {
  if (end <= start) return list;
  let s = start, e = end;
  const notes = [];
  const kept = [];
  for (const h of list) {
    if (h.end < s || h.start > e) kept.push(h);
    else {
      s = Math.min(s, h.start);
      e = Math.max(e, h.end);
      if (h.note) notes.push(h.note);
    }
  }
  kept.push({ start: s, end: e, note: notes.join("\n") });
  return kept.sort((a, b) => a.start - b.start);
}
