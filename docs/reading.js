import { matches, pickNext, pickRedo, readingStats, history, timeline, addHighlight, mergeReading } from "./reading-core.js";
import { loadReading, saveReading, syncReading, hasToken, connect, disconnect, loadLocal, saveLocal } from "./sync.js";
import { mergeProgress } from "./srs.js";

const $ = (id) => document.getElementById(id);
const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
const LETTERS = ["A", "B", "C", "D"];
const TYPE_LABEL = {
  "central-ideas": "Central ideas and details",
  inferences: "Inferences",
  "textual-evidence": "Textual evidence",
  quantitative: "Graphs and tables",
  "words-in-context": "Words in context",
  "structure-purpose": "Structure and purpose",
  "cross-text": "Paired texts",
  "rhetorical-synthesis": "Rhetorical synthesis",
  transitions: "Transitions",
};
const BAND_LABEL = { band7: "Band 7", band6: "Band 6", older: "Older set" };
const FILTER_KEY = "satflash.readingFilter";
const BAND_KEY = "satflash.readingBand";
const CHART_KEY = "satflash.readingChart";
// Stats only ever count the banded questions; the older set is never shown there.
const STAT_BANDS = { band7: "Band 7", band6: "Band 6" };

let questions = [];
let byId = new Map();
let reading = mergeReading(loadReading(), {}); // drops deleted older-set data
saveReading(reading);
let view = "practice"; // practice | stats | review
// The question on screen in practice view.
let cur = null; // { q, redo, choice, struck: Set, checked, elapsed, since }
let filter = "all";
let band = "all";
try { filter = localStorage.getItem(FILTER_KEY) || "all"; band = localStorage.getItem(BAND_KEY) || "all"; } catch {}
if (filter !== "all" && !TYPE_LABEL[filter]) filter = "all";
if (band !== "all" && !BAND_LABEL[band]) band = "all";
const filters = () => ({ type: filter, band });

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// Passage markup: [u]underlined[/u], *title in italics*, \n line break.
const fmt = (s) => esc(s)
  .replace(/\[u\]([\s\S]*?)\[\/u\]/g, "<u>$1</u>")
  .replace(/\*([^*\n]+)\*/g, "<i>$1</i>")
  .replace(/\n/g, "<br>");
const clock = (ms) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const pct = (x) => (x == null ? "–" : `${Math.round(x * 100)}%`);

function saveAndSync() {
  saveReading(reading);
  scheduleSync();
}

// ---------- Figures ----------

function niceStep(range) {
  const raw = range / 5;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
}

const num = (v) => (Number.isInteger(v) ? String(v) : String(+v.toFixed(3)));

function dataTable(f) {
  const head = `<tr><th scope="col">${esc(f.xLabel || "")}</th>${f.series.map((s) => `<th scope="col">${esc(s.name)}</th>`).join("")}</tr>`;
  const body = f.categories.map((c, i) =>
    `<tr><th scope="row">${esc(c)}</th>${f.series.map((s) => `<td>${num(s.values[i])}</td>`).join("")}</tr>`).join("");
  return `<details class="fig-data"><summary>Show data as a table</summary><table class="fig-table"><thead>${head}</thead><tbody>${body}</tbody></table></details>`;
}

function legend(f) {
  if (f.series.length < 2) return "";
  return `<ul class="fig-legend">${f.series.map((s, i) => `<li><span class="sw" style="background:var(--s${i + 1})"></span>${esc(s.name)}</li>`).join("")}</ul>`;
}

// Bar and line charts are drawn at the container's real pixel width so text stays readable on a phone.
function chartSvg(f, width) {
  const all = f.series.flatMap((s) => s.values);
  let lo = Math.min(0, ...all);
  let hi = Math.max(0, ...all);
  if (hi === lo) hi = lo + 1;
  const step = niceStep(hi - lo);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(10));
  const tickW = Math.max(...ticks.map((t) => num(t).length)) * 7 + 10;
  const n = f.categories.length;
  const longest = Math.max(...f.categories.map((c) => c.length));
  const left = 18 + tickW;
  const plotW = width - left - 12;
  const rotate = longest * 7 > plotW / n - 6;
  const bottom = (rotate ? Math.min(longest, 18) * 5.2 + 18 : 26) + (f.xLabel ? 20 : 0);
  const top = 22;
  const plotH = Math.max(180, Math.min(300, width * 0.5));
  const height = top + plotH + bottom;
  const y = (v) => top + plotH - ((v - lo) / (hi - lo)) * plotH;
  const band = plotW / n;
  const cx = (i) => left + band * (i + 0.5);
  let g = "";
  for (const t of ticks) {
    g += `<line class="grid" x1="${left}" x2="${left + plotW}" y1="${y(t)}" y2="${y(t)}"/>`;
    g += `<text class="tick" x="${left - 6}" y="${y(t) + 4}" text-anchor="end">${num(t)}</text>`;
  }
  g += `<line class="axis" x1="${left}" x2="${left + plotW}" y1="${y(0)}" y2="${y(0)}"/>`;
  f.categories.forEach((c, i) => {
    const label = c.length > 18 && rotate ? c.slice(0, 17) + "…" : c;
    g += rotate
      ? `<text class="tick" transform="translate(${cx(i)},${top + plotH + 12}) rotate(-35)" text-anchor="end">${esc(label)}</text>`
      : `<text class="tick" x="${cx(i)}" y="${top + plotH + 18}" text-anchor="middle">${esc(label)}</text>`;
  });
  if (f.xLabel) g += `<text class="axis-label" x="${left + plotW / 2}" y="${height - 4}" text-anchor="middle">${esc(f.xLabel)}</text>`;
  if (f.yLabel) g += `<text class="axis-label" transform="translate(12,${top + plotH / 2}) rotate(-90)" text-anchor="middle">${esc(f.yLabel)}</text>`;

  if (f.kind === "bar") {
    const k = f.series.length;
    const groupW = band * 0.78;
    const gap = 2;
    const bw = Math.max(2, (groupW - gap * (k - 1)) / k);
    const showVals = bw >= 4 + Math.max(...all.map((v) => num(v).length)) * 6.2;
    f.series.forEach((s, si) => {
      s.values.forEach((v, i) => {
        const x = cx(i) - groupW / 2 + si * (bw + gap);
        const y0 = y(0), y1 = y(v);
        const h = Math.max(Math.abs(y1 - y0), 0.5);
        const r = Math.min(4, bw / 2, h);
        const yt = Math.min(y0, y1);
        // Rounded at the data end only, square on the baseline.
        const d = v >= 0
          ? `M${x},${y0}V${yt + r}Q${x},${yt} ${x + r},${yt}H${x + bw - r}Q${x + bw},${yt} ${x + bw},${yt + r}V${y0}Z`
          : `M${x},${y0}V${yt + h - r}Q${x},${yt + h} ${x + r},${yt + h}H${x + bw - r}Q${x + bw},${yt + h} ${x + bw},${yt + h - r}V${y0}Z`;
        g += `<path class="mark" d="${d}" style="fill:var(--s${si + 1})"><title>${esc(s.name)}, ${esc(f.categories[i])}: ${num(v)}</title></path>`;
        if (showVals) g += `<text class="val" x="${x + bw / 2}" y="${v >= 0 ? y1 - 5 : y1 + 13}" text-anchor="middle">${num(v)}</text>`;
      });
    });
  } else {
    const showVals = n * f.series.length <= 14 && band > 34;
    f.series.forEach((s, si) => {
      const pts = s.values.map((v, i) => [cx(i), y(v)]);
      g += `<polyline class="line" points="${pts.map((p) => p.join(",")).join(" ")}" style="stroke:var(--s${si + 1})"/>`;
      pts.forEach(([px, py], i) => {
        g += `<circle class="dot" cx="${px}" cy="${py}" r="4.5" style="fill:var(--s${si + 1})"><title>${esc(s.name)}, ${esc(f.categories[i])}: ${num(s.values[i])}</title></circle>`;
        if (showVals) g += `<text class="val" x="${px}" y="${py - 9}" text-anchor="middle">${num(s.values[i])}</text>`;
      });
    });
  }
  return `<svg class="chart" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(f.title || "Chart")}">${g}</svg>`;
}

function figureHtml(f) {
  if (!f) return "";
  const title = f.title ? `<figcaption>${esc(f.title)}</figcaption>` : "";
  const note = f.note ? `<p class="fig-note">${fmt(f.note)}</p>` : "";
  if (f.kind === "table") {
    const head = `<tr>${f.columns.map((c) => `<th scope="col">${esc(c)}</th>`).join("")}</tr>`;
    const body = f.rows.map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row">${esc(c)}</th>` : `<td>${esc(c)}</td>`)).join("")}</tr>`).join("");
    return `<figure class="fig">${title}<div class="fig-scroll"><table class="fig-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>${note}</figure>`;
  }
  return `<figure class="fig">${title}<div class="fig-chart"></div>${legend(f)}${note}${dataTable(f)}</figure>`;
}

function drawCharts(root) {
  root.querySelectorAll(".fig-chart").forEach((el) => {
    const q = byId.get(el.closest("[data-qid]").dataset.qid);
    el.innerHTML = chartSvg(q.figure, Math.max(300, Math.min(680, el.clientWidth)));
  });
}

let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => document.querySelectorAll("[data-qid]").forEach(drawCharts), 150);
});

// ---------- Highlights ----------

// Text nodes inside the passage text, in reading order. Highlights are stored as
// character offsets into this text, so they survive re-rendering.
function textNodes(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement.closest(".r-text") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  const out = [];
  while (walker.nextNode()) out.push(walker.currentNode);
  return out;
}

function offsetOf(root, container, offset) {
  const point = document.createRange();
  point.setStart(container, offset);
  let pos = 0;
  for (const n of textNodes(root)) {
    if (n === container) return pos + offset;
    if (point.comparePoint(n, 0) >= 0) return pos;
    pos += n.length;
  }
  return pos;
}

function passageText(root) {
  return textNodes(root).map((n) => n.data).join("");
}

function marksFor(qid) {
  return reading.marks[qid]?.highlights ?? [];
}

function applyHighlights(root, list) {
  if (!list.length) return;
  let pos = 0;
  for (const node of textNodes(root)) {
    const start = pos, end = pos + node.length;
    pos = end;
    const hits = list.map((h, i) => ({ ...h, i })).filter((h) => h.start < end && h.end > start);
    if (!hits.length) continue;
    const frag = document.createDocumentFragment();
    let at = start;
    for (const h of hits) {
      const s = Math.max(h.start, start), e = Math.min(h.end, end);
      if (s > at) frag.append(node.data.slice(at - start, s - start));
      const mark = document.createElement("mark");
      mark.className = "hl";
      mark.dataset.i = h.i;
      if (h.note && e === h.end) mark.classList.add("has-note");
      mark.textContent = node.data.slice(s - start, e - start);
      frag.append(mark);
      at = e;
    }
    if (at < end) frag.append(node.data.slice(at - start));
    node.replaceWith(frag);
  }
}

function notesHtml(qid) {
  const list = marksFor(qid).map((h, i) => ({ ...h, i })).filter((h) => h.note);
  if (!list.length) return "";
  return `<ul class="r-notes">${list.map((h) => `<li><button type="button" data-note="${h.i}"><span class="r-notes-q"></span><span class="r-notes-t">${esc(h.note)}</span></button></li>`).join("")}</ul>`;
}

// Re-render the passage of a card with its current highlights and notes.
function renderPassage(card) {
  const q = byId.get(card.dataset.qid);
  const root = card.querySelector(".r-passage");
  root.innerHTML = passageHtml(q);
  applyHighlights(root, marksFor(q.id));
  const text = passageText(root);
  card.querySelector(".r-notes-slot").innerHTML = notesHtml(q.id);
  card.querySelectorAll(".r-notes button").forEach((b) => {
    const h = marksFor(q.id)[+b.dataset.note];
    const quote = text.slice(h.start, h.end);
    b.querySelector(".r-notes-q").textContent = `“${quote.length > 60 ? quote.slice(0, 57) + "…" : quote}”`;
  });
}

function setMarks(qid, highlights) {
  reading.marks[qid] = { highlights, updatedAt: Date.now() };
  saveAndSync();
}

let pending = null; // selection waiting for the Highlight button: { card, start, end }
const pop = $("hl-pop");

function onSelection() {
  const sel = getSelection();
  pending = null;
  if (sel.rangeCount && !sel.isCollapsed) {
    const range = sel.getRangeAt(0);
    const root = (range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement).closest(".r-passage");
    if (root) {
      const start = offsetOf(root, range.startContainer, range.startOffset);
      const end = offsetOf(root, range.endContainer, range.endOffset);
      if (end > start && passageText(root).slice(start, end).trim()) {
        pending = { card: root.closest("[data-qid]"), start, end };
        const r = range.getBoundingClientRect();
        pop.hidden = false;
        const w = pop.offsetWidth;
        pop.style.left = `${Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8)}px`;
        pop.style.top = `${Math.min(r.bottom + 10, innerHeight - pop.offsetHeight - 8)}px`;
        return;
      }
    }
  }
  pop.hidden = true;
}

let selTimer = null;
document.addEventListener("selectionchange", () => {
  clearTimeout(selTimer);
  selTimer = setTimeout(onSelection, 120);
});
window.addEventListener("scroll", () => { if (!pop.hidden) onSelection(); }, { passive: true });
pop.addEventListener("pointerdown", (e) => e.preventDefault()); // keep the selection
pop.addEventListener("click", () => {
  if (!pending) return;
  const { card, start, end } = pending;
  const qid = card.dataset.qid;
  setMarks(qid, addHighlight(marksFor(qid), start, end));
  getSelection().removeAllRanges();
  pop.hidden = true;
  pending = null;
  renderPassage(card);
});

let editing = null; // { card, i }
function openNote(card, i) {
  const qid = card.dataset.qid;
  const h = marksFor(qid)[i];
  if (!h) return;
  editing = { card, i };
  $("note-quote").textContent = passageText(card.querySelector(".r-passage")).slice(h.start, h.end);
  $("note-input").value = h.note || "";
  $("note-dialog").showModal();
  if (finePointer.matches) $("note-input").focus();
}
$("save-note").addEventListener("click", () => {
  const qid = editing.card.dataset.qid;
  const list = marksFor(qid).map((h, i) => (i === editing.i ? { ...h, note: $("note-input").value.trim() } : h));
  setMarks(qid, list);
  renderPassage(editing.card);
  $("note-dialog").close();
});
$("remove-highlight").addEventListener("click", () => {
  const qid = editing.card.dataset.qid;
  setMarks(qid, marksFor(qid).filter((_, i) => i !== editing.i));
  renderPassage(editing.card);
  $("note-dialog").close();
});

// ---------- Question card ----------

function passageHtml(q) {
  return q.passage.map((b) => `${b.label ? `<p class="r-label">${esc(b.label)}</p>` : ""}<p class="r-text">${fmt(b.text)}</p>`).join("");
}

// One card layout for practice and for reviewing a past question.
// st: { choice, struck, checked } — checked shows the answer and explanations.
function cardHtml(q, st, { review = false } = {}) {
  const ok = st.checked && st.choice === q.answer;
  const choices = q.choices.map((c, i) => {
    const result = st.checked ? (i === q.answer ? "correct" : i === st.choice ? "wrong" : "") : "";
    const badge = st.checked ? (i === q.answer ? `<span class="r-badge" data-k="correct">Correct answer</span>` : i === st.choice ? `<span class="r-badge" data-k="wrong">Your answer</span>` : "") : "";
    const struck = st.struck.has(i);
    return `<li class="r-choice" data-i="${i}" data-result="${result}" ${struck ? "data-struck" : ""} ${st.choice === i ? "data-selected" : ""}>
      <div class="r-choice-row">
        <button class="r-opt" type="button" aria-pressed="${st.choice === i}" ${st.checked || struck ? "disabled" : ""}>
          <span class="r-letter">${LETTERS[i]}</span><span class="r-opt-text">${fmt(c)}</span>${badge}
        </button>
        ${st.checked ? "" : `<button class="r-strike" type="button" aria-pressed="${struck}" aria-label="${struck ? "Undo cross out" : "Cross out"} choice ${LETTERS[i]}" title="${struck ? "Undo cross out" : "Cross out"}"><span>${LETTERS[i]}</span></button>`}
      </div>
      ${st.checked ? `<p class="r-why">${fmt(q.explanation.choices[i])}</p>` : ""}
    </li>`;
  }).join("");
  const time = review ? clock(st.ms) : "";
  const actions = review
    ? `<p class="r-result" data-ok="${ok}">${ok ? "Correct" : `Incorrect. The answer is ${LETTERS[q.answer]}.`} <span class="r-result-meta">${time} · ${new Date(st.at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</span></p>`
    : st.checked
      ? `<p class="r-result" data-ok="${ok}">${ok ? "Correct" : `Incorrect. The answer is ${LETTERS[q.answer]}.`}${cur.redo ? ` <span class="r-result-meta">Redo, not counted in stats</span>` : ""}</p><button class="btn btn-hit" id="next" type="button">Next question</button>`
      : `<button class="btn btn-hit" id="check" type="button" ${st.choice == null ? "disabled" : ""}>Check answer</button>`;
  return `
    <p class="r-meta">${esc(BAND_LABEL[q.difficulty])} · ${esc(TYPE_LABEL[q.type])}${!review && cur?.redo ? " · Redo" : ""}</p>
    ${q.intro ? `<p class="r-intro">${fmt(q.intro)}</p>` : ""}
    ${figureHtml(q.figure)}
    <div class="r-passage"></div>
    <div class="r-notes-slot"></div>
    <p class="r-hint">${finePointer.matches ? "Select" : "Press and hold on"} text to highlight it. Tap a highlight to add a note.</p>
    <p class="r-stem">${fmt(q.question)}</p>
    <ol class="r-choices">${choices}</ol>
    <div class="r-actions">${actions}</div>
    ${st.checked ? `<section class="r-explain"><h3>The passage, explained</h3><p>${fmt(q.explanation.passage)}</p></section>` : ""}`;
}

function renderCard(el, q, st, opts) {
  el.dataset.qid = q.id;
  el.innerHTML = cardHtml(q, st, opts);
  renderPassage(el);
  drawCharts(el);
}

// ---------- Practice ----------

const qEl = $("question");

function updateCount() {
  const pool = questions.filter((q) => matches(q, filters()));
  const done = pool.filter((q) => reading.attempts[q.id]).length;
  $("done-count").textContent = `${done} of ${pool.length} done`;
}

function elapsed() {
  return cur ? cur.elapsed + (cur.since ? Date.now() - cur.since : 0) : 0;
}

// The timer only runs while the question is on screen and unanswered.
function syncTimer() {
  if (!cur) return;
  const run = view === "practice" && !document.hidden && !cur.checked;
  if (run && !cur.since) cur.since = Date.now();
  if (!run && cur.since) { cur.elapsed += Date.now() - cur.since; cur.since = null; }
  $("timer").textContent = clock(elapsed());
}
setInterval(() => { if (cur?.since) $("timer").textContent = clock(elapsed()); }, 500);

function showQuestion(q, redo = false) {
  cur = { q, redo, choice: null, struck: new Set(), checked: false, elapsed: 0, since: null };
  renderCard(qEl, q, cur);
  syncTimer();
  updateCount();
}

function showDone() {
  cur = null;
  $("timer").textContent = "0:00";
  const wrong = pickRedo(questions, reading.attempts, filters());
  const kind = [band === "all" ? "" : BAND_LABEL[band], filter === "all" ? "" : TYPE_LABEL[filter].toLowerCase()].filter(Boolean).join(" ");
  const what = kind ? `every ${kind} question` : "every question";
  delete qEl.dataset.qid;
  qEl.innerHTML = `<div class="r-done">
    <h2>You've done ${what}.</h2>
    <p>${wrong ? "You can redo the ones you got wrong. Redos don't change your stats." : "And you got them all right. Ask for a new batch of questions to keep going."}</p>
    ${wrong ? `<button class="btn btn-hit" id="redo" type="button">Redo ones I got wrong</button>` : ""}
  </div>`;
  updateCount();
}

function nextQuestion() {
  const exclude = cur?.q.id;
  if (cur?.redo) {
    const r = pickRedo(questions, reading.attempts, filters(), Math.random, exclude) ?? pickRedo(questions, reading.attempts, filters());
    if (r) return showQuestion(r, true);
  }
  const q = pickNext(questions, reading.attempts, filters(), Math.random, exclude);
  if (q) showQuestion(q);
  else showDone();
  scrollTo({ top: 0 });
}

function select(i) {
  if (!cur || cur.checked || cur.struck.has(i)) return;
  cur.choice = i;
  rerenderChoices();
}

function strike(i) {
  if (!cur || cur.checked) return;
  if (cur.struck.has(i)) cur.struck.delete(i);
  else {
    cur.struck.add(i);
    if (cur.choice === i) cur.choice = null;
  }
  rerenderChoices();
}

// Update choices and the Check button without touching the passage (keeps highlights and selection).
function rerenderChoices() {
  const tmp = document.createElement("div");
  tmp.innerHTML = cardHtml(cur.q, cur);
  qEl.querySelector(".r-choices").replaceWith(tmp.querySelector(".r-choices"));
  qEl.querySelector(".r-actions").replaceWith(tmp.querySelector(".r-actions"));
}

function check() {
  if (!cur || cur.checked || cur.choice == null) return;
  cur.checked = true;
  syncTimer();
  if (!cur.redo && !reading.attempts[cur.q.id]) {
    reading.attempts[cur.q.id] = { choice: cur.choice, correct: cur.choice === cur.q.answer, ms: Math.round(cur.elapsed), at: Date.now() };
    saveAndSync();
  }
  const y = scrollY;
  renderCard(qEl, cur.q, cur);
  scrollTo({ top: y });
  qEl.querySelector(".r-actions").scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  updateCount();
}

qEl.addEventListener("click", (e) => {
  const mark = e.target.closest("mark.hl");
  if (mark && getSelection().isCollapsed) return openNote(qEl, +mark.dataset.i);
  const noteBtn = e.target.closest("[data-note]");
  if (noteBtn) return openNote(qEl, +noteBtn.dataset.note);
  const li = e.target.closest(".r-choice");
  if (e.target.closest(".r-strike")) return strike(+li.dataset.i);
  if (e.target.closest(".r-opt")) return select(+li.dataset.i);
  if (e.target.closest("#check")) return check();
  if (e.target.closest("#next")) return nextQuestion();
  if (e.target.closest("#redo")) {
    const r = pickRedo(questions, reading.attempts, filters());
    if (r) showQuestion(r, true);
  }
});

$("type-filter").addEventListener("change", (e) => {
  filter = e.target.value;
  try { localStorage.setItem(FILTER_KEY, filter); } catch {}
  // Swap the question unless it already fits or has been answered.
  if (!cur || (!cur.checked && !matches(cur.q, filters()))) nextQuestion();
  else updateCount();
});

$("band-filter").addEventListener("change", (e) => {
  band = e.target.value;
  try { localStorage.setItem(BAND_KEY, band); } catch {}
  if (!cur || (!cur.checked && !matches(cur.q, filters()))) nextQuestion();
  else updateCount();
});

// ---------- Stats and history ----------

// The opening of the passage identifies a question better than its stem, which is often generic.
function snippet(q) {
  const t = q.passage[0].text.replace(/\[\/?u\]|\*/g, "").replace(/\s+/g, " ").trim();
  return t.length > 110 ? t.slice(0, 107).trimEnd() + "…" : t;
}

function renderStats() {
  const s = readingStats(questions, reading.attempts, Date.now());
  const tiles = [["Today", s.today], ["Last 7 days", s.week], ["Last 30 days", s.month], ["All time", s.all]];
  $("stat-tiles").innerHTML = tiles.map(([label, t]) => `
    <div class="r-tile">
      <p class="r-tile-label">${label}</p>
      <p class="r-tile-num">${t.solved}</p>
      <p class="r-tile-sub">solved</p>
      <dl>
        <div><dt>Accuracy</dt><dd>${pct(t.accuracy)}</dd></div>
        <div><dt>Avg time</dt><dd>${t.avgMs == null ? "–" : clock(t.avgMs)}</dd></div>
      </dl>
    </div>`).join("");
  const meters = (labels, by, key) => Object.keys(labels).map((t) => {
    const x = by[t] ?? { solved: 0, correct: 0, accuracy: null };
    const total = questions.filter((q) => q[key] === t && q.difficulty !== "older").length;
    return `<div class="r-type">
      <p class="r-type-name">${labels[t]}</p>
      <p class="r-type-num">${pct(x.accuracy)} <span>${x.correct} of ${x.solved} right · ${x.solved} of ${total} done</span></p>
      <div class="r-meter" aria-hidden="true"><span style="width:${(x.accuracy ?? 0) * 100}%"></span></div>
    </div>`;
  }).join("");
  $("stat-bands").innerHTML = meters(STAT_BANDS, s.byBand, "difficulty");
  $("stat-types").innerHTML = meters(TYPE_LABEL, s.byType, "type");
  renderTimeChart();
  const h = history(reading.attempts).filter((a) => byId.has(a.id) && byId.get(a.id).difficulty !== "older");
  $("history").innerHTML = h.length
    ? h.map((a) => {
        const q = byId.get(a.id);
        const d = new Date(a.at);
        return `<li><button type="button" data-id="${a.id}">
          <span class="r-h-mark" data-ok="${a.correct}">${a.correct ? "Right" : "Wrong"}</span>
          <span class="r-h-text">${esc(snippet(q))}</span>
          <span class="r-h-meta">${BAND_LABEL[q.difficulty]} · ${TYPE_LABEL[q.type]} · ${clock(a.ms)} · ${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
        </button></li>`;
      }).join("")
    : `<li class="empty">No questions answered yet.</li>`;
}

function setView(v) {
  view = v;
  $("practice-view").hidden = v !== "practice";
  $("stats-view").hidden = v !== "stats";
  $("review-view").hidden = v !== "review";
  $("toggle-stats").setAttribute("aria-pressed", v !== "practice");
  $("toggle-stats").textContent = v === "practice" ? "Stats" : "Practice";
  if (v === "stats") renderStats();
  pop.hidden = true;
  syncTimer();
  scrollTo({ top: 0 });
}

$("toggle-stats").addEventListener("click", () => setView(view === "practice" ? "stats" : "practice"));
function openReview(id) {
  const a = reading.attempts[id];
  setView("review");
  renderCard($("review"), byId.get(id), { choice: a.choice, struck: new Set(), checked: true, ms: a.ms, at: a.at }, { review: true });
}

$("history").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-id]");
  if (b) openReview(b.dataset.id);
});

// ---------- Time chart ----------

let chartType = "all";
try { chartType = localStorage.getItem(CHART_KEY) || "all"; } catch {}
if (chartType !== "all" && !TYPE_LABEL[chartType]) chartType = "all";

// Time per question, oldest to newest, for one question type. Right answers are
// filled dots and wrong answers hollow rings, so right/wrong never relies on color alone.
function renderTimeChart() {
  const el = $("time-chart");
  const pts = timeline(questions, reading.attempts, chartType);
  if (!pts.length) {
    el.innerHTML = `<p class="r-chart-empty">No ${chartType === "all" ? "" : TYPE_LABEL[chartType].toLowerCase() + " "}questions answered yet.</p>`;
    return;
  }
  const width = Math.max(280, el.clientWidth || 600);
  const n = pts.length;
  const secs = pts.map((a) => a.ms / 1000);
  const avg = secs.reduce((t, v) => t + v, 0) / n;
  const step = niceStep(Math.max(...secs, 60));
  const tickStep = Math.max(30, Math.ceil(step / 30) * 30); // whole half-minutes
  const hi = Math.ceil(Math.max(...secs, avg) / tickStep) * tickStep || tickStep;
  const left = 46, right = 14, top = 14, bottom = 34;
  const plotW = width - left - right;
  const plotH = Math.max(170, Math.min(260, width * 0.45));
  const height = top + plotH + bottom;
  const x = (i) => left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v) => top + plotH - (v / hi) * plotH;
  let g = "";
  for (let t = 0; t <= hi + 0.1; t += tickStep) {
    g += `<line class="grid" x1="${left}" x2="${left + plotW}" y1="${y(t)}" y2="${y(t)}"/>`;
    g += `<text class="tick" x="${left - 8}" y="${y(t) + 4}" text-anchor="end">${clock(t * 1000)}</text>`;
  }
  g += `<line class="axis" x1="${left}" x2="${left + plotW}" y1="${y(0)}" y2="${y(0)}"/>`;
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / 36))));
  pts.forEach((_, i) => {
    if (i % every === 0 || i === n - 1) g += `<text class="tick" x="${x(i)}" y="${top + plotH + 18}" text-anchor="middle">${i + 1}</text>`;
  });
  g += `<text class="axis-label" x="${left + plotW / 2}" y="${height - 2}" text-anchor="middle">Question, oldest to newest</text>`;
  g += `<line class="avg" x1="${left}" x2="${left + plotW}" y1="${y(avg)}" y2="${y(avg)}"/>`;
  g += `<text class="avg-label" x="${left + plotW}" y="${y(avg) - 6}" text-anchor="end">avg ${clock(avg * 1000)}</text>`;
  if (n > 1) g += `<polyline class="line" points="${pts.map((_, i) => `${x(i)},${y(secs[i])}`).join(" ")}"/>`;
  pts.forEach((a, i) => {
    const label = `Question ${i + 1}, ${TYPE_LABEL[a.type]}, ${clock(a.ms)}, ${a.correct ? "right" : "wrong"}`;
    g += `<g class="pt" data-id="${a.id}" data-i="${i}" tabindex="0" role="button" aria-label="${esc(label)}">
      <circle class="hit" cx="${x(i)}" cy="${y(secs[i])}" r="14"/>
      <circle class="dot ${a.correct ? "ok" : "bad"}" cx="${x(i)}" cy="${y(secs[i])}" r="5.5"/>
    </g>`;
  });
  el.innerHTML = `<svg class="chart" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Time per question, ${esc(chartType === "all" ? "all types" : TYPE_LABEL[chartType])}">${g}</svg><div class="r-tip" hidden></div>`;
  el._pts = pts.map((a, i) => ({ a, i, px: x(i), py: y(secs[i]), width }));
}

function showTip(g) {
  const el = $("time-chart");
  const p = el._pts?.[+g.dataset.i];
  if (!p) return;
  const tip = el.querySelector(".r-tip");
  const q = byId.get(p.a.id);
  const d = new Date(p.a.at);
  tip.innerHTML = `<p class="r-tip-head"><span data-ok="${p.a.correct}">${p.a.correct ? "Right" : "Wrong"}</span> · ${clock(p.a.ms)}</p>
    <p>${esc(BAND_LABEL[q.difficulty])} · ${esc(TYPE_LABEL[q.type])}</p>
    <p class="r-tip-meta">${d.toLocaleDateString([], { month: "short", day: "numeric" })} · tap to review</p>`;
  tip.hidden = false;
  const tw = tip.offsetWidth;
  tip.style.left = `${Math.min(Math.max(p.px - tw / 2, 0), p.width - tw)}px`;
  tip.style.top = `${p.py - tip.offsetHeight - 14}px`;
}
function hideTip() {
  const tip = $("time-chart").querySelector(".r-tip");
  if (tip) tip.hidden = true;
}

$("time-chart").addEventListener("pointerover", (e) => { const g = e.target.closest(".pt"); if (g) showTip(g); });
$("time-chart").addEventListener("pointerout", (e) => { if (e.target.closest(".pt") && !e.relatedTarget?.closest?.(".pt")) hideTip(); });
$("time-chart").addEventListener("focusin", (e) => { const g = e.target.closest(".pt"); if (g) showTip(g); });
$("time-chart").addEventListener("focusout", hideTip);
$("time-chart").addEventListener("click", (e) => { const g = e.target.closest(".pt"); if (g) openReview(g.dataset.id); });
$("time-chart").addEventListener("keydown", (e) => {
  const g = e.target.closest(".pt");
  if (g && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openReview(g.dataset.id); }
});
$("chart-type").addEventListener("change", (e) => {
  chartType = e.target.value;
  try { localStorage.setItem(CHART_KEY, chartType); } catch {}
  renderTimeChart();
});
let chartResizeTimer;
addEventListener("resize", () => { clearTimeout(chartResizeTimer); chartResizeTimer = setTimeout(() => { if (view === "stats") renderTimeChart(); }, 150); });
$("back-to-stats").addEventListener("click", () => setView("stats"));
$("review").addEventListener("click", (e) => {
  const mark = e.target.closest("mark.hl");
  if (mark && getSelection().isCollapsed) return openNote($("review"), +mark.dataset.i);
  const noteBtn = e.target.closest("[data-note]");
  if (noteBtn) openNote($("review"), +noteBtn.dataset.note);
});

// ---------- Sync ----------

let syncTimeout = null;
let syncing = false;
let syncAgain = false;
let syncState = { kind: "local", at: null, message: "" };

function setSyncState(kind, message = "") {
  syncState = { kind, at: kind === "ok" ? Date.now() : syncState.at, message };
  const labels = { local: "Not synced", syncing: "Syncing", ok: "Synced", offline: "Offline", error: "Sync error" };
  $("sync-text").textContent = labels[kind];
  $("sync-icon").className = `icon ${kind === "ok" || kind === "syncing" ? "i-cloud-ok" : "i-cloud-off"}`;
  $("sync").title = describeSync();
  if ($("sync-dialog").open) renderSyncDialog();
}

function describeSync() {
  const time = syncState.at ? new Date(syncState.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : null;
  switch (syncState.kind) {
    case "local": return "Your reading history is saved on this device only.";
    case "syncing": return "Syncing with GitHub.";
    case "ok": return `Connected to GitHub. Last synced at ${time}.`;
    case "offline": return "Offline. Your answers are saved on this device and will sync when you're back online.";
    default: return `Sync problem: ${syncState.message}. Your answers are still saved on this device.`;
  }
}

function scheduleSync(delay = 800) {
  if (!hasToken()) return setSyncState("local");
  clearTimeout(syncTimeout);
  syncTimeout = setTimeout(runSync, delay);
}

async function runSync() {
  if (!hasToken()) return setSyncState("local");
  if (syncing) { syncAgain = true; return; }
  syncing = true;
  setSyncState("syncing");
  try {
    const merged = await syncReading(reading);
    applyReading(mergeReading(reading, merged)); // keeps answers made while the request was in flight
    setSyncState("ok");
  } catch (e) {
    setSyncState(e.kind === "offline" ? "offline" : "error", e.message);
  } finally {
    syncing = false;
    if (syncAgain) { syncAgain = false; scheduleSync(0); }
  }
}

function applyReading(r) {
  const marksBefore = JSON.stringify(cur ? reading.marks[cur.q.id] : null);
  reading = r;
  saveReading(reading);
  updateCount();
  if (view === "stats") renderStats();
  // Another device may have changed highlights on the question on screen.
  if (cur && qEl.dataset.qid === cur.q.id && JSON.stringify(reading.marks[cur.q.id]) !== marksBefore && getSelection().isCollapsed) renderPassage(qEl);
}

function renderSyncDialog() {
  const connected = hasToken();
  $("sync-disconnected").hidden = connected;
  $("sync-connected").hidden = !connected;
  $("sync-detail").textContent = describeSync();
}

async function connectSync() {
  const token = $("token-input").value.trim();
  const err = $("token-error");
  err.hidden = true;
  if (!token) { err.textContent = "Paste your token first."; err.hidden = false; return; }
  const btn = $("connect-sync");
  btn.disabled = true;
  btn.textContent = "Connecting";
  try {
    const local = loadLocal();
    saveLocal(mergeProgress(local, await connect(token, local))); // vocab progress comes along too
    $("token-input").value = "";
    await runSync();
  } catch (e) {
    err.textContent = e.kind === "auth"
      ? "GitHub didn't accept that token. Check that the gist box was ticked and try again."
      : e.kind === "offline" ? "No connection. Try again when you're online." : e.message;
    err.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = "Connect";
    renderSyncDialog();
  }
}

$("sync").addEventListener("click", () => { renderSyncDialog(); $("sync-dialog").showModal(); });
$("connect-sync").addEventListener("click", connectSync);
$("token-input").addEventListener("keydown", (e) => { if (e.key === "Enter") connectSync(); });
$("sync-now").addEventListener("click", () => scheduleSync(0));
$("disconnect-sync").addEventListener("click", () => { disconnect(); setSyncState("local"); renderSyncDialog(); });
document.querySelectorAll("dialog").forEach((d) => {
  d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
  d.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => d.close()));
});

window.addEventListener("online", () => scheduleSync(0));
document.addEventListener("visibilitychange", () => {
  syncTimer();
  scheduleSync(0);
});

// ---------- Theme ----------

function toggleTheme() {
  const now = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const next = now === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("satflash.theme", next); } catch {}
  const bg = next === "dark" ? "#12171C" : "#E9ECEF";
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", bg));
}
$("theme-toggle").addEventListener("click", toggleTheme);

// ---------- Keyboard ----------

document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (document.querySelector("dialog[open]")) return;
  if (e.target.closest("input, textarea, select")) return;
  if (view !== "practice" || !cur) return;
  const i = LETTERS.indexOf(e.key.toUpperCase());
  if (i >= 0) { select(i); return; }
  if (e.key === "Enter" && !e.target.closest("button")) {
    e.preventDefault();
    if (cur.checked) nextQuestion();
    else check();
  }
});

// ---------- Start ----------

async function start() {
  $("type-filter").value = filter;
  $("band-filter").value = band;
  $("chart-type").innerHTML = `<option value="all">All types</option>` + Object.entries(TYPE_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
  $("chart-type").value = chartType;
  try {
    const res = await fetch("questions.json");
    if (!res.ok) throw new Error(res.status);
    questions = await res.json();
  } catch {
    qEl.innerHTML = `<p class="error">Couldn't load the questions. Check your connection and reload the page.</p>`;
    return;
  }
  byId = new Map(questions.map((q) => [q.id, q]));
  if (hasToken()) await Promise.race([runSync(), new Promise((r) => setTimeout(r, 2500))]);
  else setSyncState("local");
  nextQuestion();
}

if ("serviceWorker" in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js").catch(() => {});
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController) location.reload();
  });
}

start();
