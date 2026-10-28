import { review, recordAnswer, nextCard, newSession, shuffledIds, stats, cardStatus, mergeProgress } from "./srs.js";
import { loadLocal, saveLocal, sync, hasToken, connect, disconnect } from "./sync.js";

const $ = (id) => document.getElementById(id);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

const card = $("card");
const slot = $("card-slot");
const answers = $("answers");
const drawer = $("drawer");
const scrim = $("scrim");

let words = [];
let byId = new Map();
let order = [];
let progress = loadLocal();
let session = newSession();
let currentId = null;
let busy = false;

const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ---------- Card rendering ----------

function renderFaces(el, w, tag) {
  const hint = finePointer.matches ? "Click anywhere to flip" : "Tap anywhere to flip";
  const syns = [w.syn1, w.syn2, w.syn3].filter(Boolean).map(esc).join(" · ");
  el.innerHTML = `
    <div class="card-inner">
      <div class="face front">
        ${tag ? `<span class="tag" data-kind="${tag.kind}">${tag.label}</span>` : ""}
        <p class="word">${esc(w.word)}</p>
        <span class="hint">${hint}</span>
      </div>
      <div class="face back">
        <div class="back-scroll">
          <p class="word">${esc(w.word)}</p>
          <dl>
            <div><dt>Meaning</dt><dd>${esc(w.meaning)}</dd></div>
            <div><dt>Synonyms</dt><dd class="synonyms">${syns}</dd></div>
            <div><dt>Example</dt><dd class="example">${esc(w.sentence)}</dd></div>
          </dl>
        </div>
      </div>
    </div>`;
  el.setAttribute("aria-label", `Flashcard: ${w.word}. Press to flip.`);
}

function setFlipped(el, flipped, animate = true) {
  if (!animate) el.classList.add("no-anim");
  el.toggleAttribute("data-flipped", flipped);
  if (!animate) {
    void el.offsetWidth; // apply the instant state before re-enabling transitions
    el.classList.remove("no-anim");
  }
}

function setRevealed(on) {
  answers.toggleAttribute("data-revealed", on);
  answers.inert = !on;
}

function tagFor(id, now) {
  if (session.pending.some((p) => p.id === id && p.at <= session.served)) return { kind: "again", label: "Again" };
  const st = progress.cards[id];
  if (!st) return { kind: "new", label: "New" };
  if (st.due <= now) return { kind: "review", label: "Review" };
  return { kind: "ahead", label: "Studying ahead" };
}

function showNext() {
  const now = Date.now();
  currentId = nextCard(order, progress.cards, session, now);
  renderFaces(card, byId.get(currentId), tagFor(currentId, now));
  setFlipped(card, false, false);
  setRevealed(false);
}

function flipMain() {
  if (!currentId || busy) return;
  setFlipped(card, !card.hasAttribute("data-flipped"));
  if (card.hasAttribute("data-flipped")) setRevealed(true);
}

async function answer(remembered) {
  if (busy || !currentId || !answers.hasAttribute("data-revealed")) return;
  busy = true;
  const now = Date.now();
  progress.cards[currentId] = review(progress.cards[currentId], remembered, now);
  recordAnswer(session, currentId, remembered);
  saveLocal(progress);
  updateStats();
  scheduleSync();
  setRevealed(false);

  const dx = remembered ? 24 : -24;
  const reduce = reduceMotion.matches;
  const exit = slot.animate(
    [{ opacity: 1, transform: "none" }, { opacity: 0, transform: reduce ? "none" : `translateX(${dx}px)` }],
    { duration: 180, easing: EASE_OUT, fill: "forwards" },
  );
  await exit.finished.catch(() => {});
  showNext();
  exit.cancel();
  slot.animate(
    [{ opacity: 0, transform: reduce ? "none" : "scale(0.96)" }, { opacity: 1, transform: "none" }],
    { duration: 240, easing: EASE_OUT },
  );
  busy = false;
}

// ---------- Stats ----------

function updateStats() {
  const s = stats(order, progress.cards, Date.now());
  $("stat-new").textContent = s.new;
  $("stat-learning").textContent = s.learning;
  $("stat-mastered").textContent = s.mastered;
  $("stat-today").textContent = s.today;
}

// ---------- Sync ----------

let syncTimer = null;
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
    case "local": return "Progress is saved on this device only.";
    case "syncing": return "Syncing with GitHub.";
    case "ok": return `Connected to GitHub. Last synced at ${time}.`;
    case "offline": return "Offline. Your answers are saved on this device and will sync when you're back online.";
    default: return `Sync problem: ${syncState.message}. Your answers are still saved on this device.`;
  }
}

function scheduleSync(delay = 800) {
  if (!hasToken()) return setSyncState("local");
  clearTimeout(syncTimer);
  syncTimer = setTimeout(runSync, delay);
}

async function runSync() {
  if (!hasToken()) return setSyncState("local");
  if (syncing) { syncAgain = true; return; }
  syncing = true;
  setSyncState("syncing");
  try {
    const merged = await sync(progress);
    applyProgress(mergeProgress(progress, merged)); // keeps answers made while the request was in flight
    setSyncState("ok");
  } catch (e) {
    setSyncState(e.kind === "offline" ? "offline" : "error", e.message);
  } finally {
    syncing = false;
    if (syncAgain) { syncAgain = false; scheduleSync(0); }
  }
}

function applyProgress(p) {
  progress = p;
  saveLocal(progress);
  order = shuffledIds(words.map((w) => w.id), progress.settings.seed);
  updateStats();
  if (drawer.classList.contains("open")) renderList();
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
    const merged = await connect(token, progress);
    applyProgress(mergeProgress(progress, merged));
    $("token-input").value = "";
    setSyncState("ok");
    if (currentId && !progress.cards[currentId] && !card.hasAttribute("data-flipped")) showNext();
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

// ---------- Word list drawer ----------

function dueText(st, now) {
  if (!st) return "";
  const days = Math.ceil((st.due - now) / 86400000);
  return days <= 0 ? "due now" : days === 1 ? "due tomorrow" : `due in ${days} days`;
}

function renderList() {
  const q = $("search-input").value.trim().toLowerCase();
  const now = Date.now();
  const shown = words.filter((w) => w.word.toLowerCase().includes(q));
  $("list-count").textContent = q ? `${shown.length} of ${words.length} words` : `${words.length} words`;
  const label = { new: "New", learning: "Learning", mastered: "Mastered" };
  $("word-list").innerHTML = shown.length
    ? shown.map((w) => {
        const st = progress.cards[w.id];
        const s = cardStatus(st);
        const due = dueText(st, now);
        return `<li><button type="button" data-id="${w.id}">
          <span class="w">${esc(w.word)}</span>
          <span class="status" data-s="${s}">${label[s]}${due ? `, ${due}` : ""}</span>
          <span class="m">${esc(w.meaning)}</span>
        </button></li>`;
      }).join("")
    : `<li class="empty">No words match "${esc(q)}".</li>`;
}

function openDrawer() {
  renderList();
  drawer.inert = false;
  drawer.setAttribute("aria-hidden", "false");
  drawer.classList.add("open");
  scrim.classList.add("open");
  if (finePointer.matches) $("search-input").focus();
}

function closeDrawer() {
  drawer.classList.remove("open");
  scrim.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  drawer.inert = true;
  $("open-list").focus();
}

function openPreview(id) {
  const el = $("preview-card");
  renderFaces(el, byId.get(id), null);
  setFlipped(el, false, false);
  $("preview").showModal();
  el.focus();
}

// ---------- Reset ----------

function doReset() {
  applyProgress({ version: 1, resetAt: Date.now(), settings: progress.settings, cards: {} });
  session = newSession();
  showNext();
  $("confirm-reset").close();
  closeDrawer();
  scheduleSync(0);
}

// ---------- Theme ----------

function effectiveTheme() {
  return document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}

function toggleTheme() {
  const next = effectiveTheme() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("satflash.theme", next); } catch {}
  const bg = next === "dark" ? "#12171C" : "#E9ECEF";
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", bg));
}

// ---------- Events ----------

card.addEventListener("click", flipMain);
$("btn-miss").addEventListener("click", () => answer(false));
$("btn-hit").addEventListener("click", () => answer(true));
// After a mouse/touch click, drop focus from the button so Space flips the card
// instead of pressing that button again. Keyboard activation (detail 0) keeps focus.
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b && e.detail > 0 && !b.closest("dialog, .drawer")) b.blur();
});
$("theme-toggle").addEventListener("click", toggleTheme);
$("open-list").addEventListener("click", openDrawer);
$("close-list").addEventListener("click", closeDrawer);
scrim.addEventListener("click", closeDrawer);
$("search-input").addEventListener("input", renderList);
$("word-list").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-id]");
  if (b) openPreview(b.dataset.id);
});
$("preview-card").addEventListener("click", (e) => {
  const el = e.currentTarget;
  setFlipped(el, !el.hasAttribute("data-flipped"));
});
$("preview-card").addEventListener("keydown", (e) => {
  if (e.key === " " || e.key === "Enter") { e.preventDefault(); e.currentTarget.click(); }
});
$("close-preview").addEventListener("click", () => $("preview").close());
$("open-reset").addEventListener("click", () => $("confirm-reset").showModal());
$("cancel-reset").addEventListener("click", () => $("confirm-reset").close());
$("do-reset").addEventListener("click", doReset);
$("sync").addEventListener("click", () => { renderSyncDialog(); $("sync-dialog").showModal(); });
$("connect-sync").addEventListener("click", connectSync);
$("token-input").addEventListener("keydown", (e) => { if (e.key === "Enter") connectSync(); });
$("sync-now").addEventListener("click", () => scheduleSync(0));
$("disconnect-sync").addEventListener("click", () => { disconnect(); setSyncState("local"); renderSyncDialog(); });
document.querySelectorAll("dialog").forEach((d) => {
  d.addEventListener("click", (e) => { if (e.target === d) d.close(); }); // click on backdrop
  d.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => d.close()));
});

document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (document.querySelector("dialog[open]")) return; // dialogs handle their own keys (Esc closes)
  if (drawer.classList.contains("open")) {
    if (e.key === "Escape") closeDrawer();
    return;
  }
  if (e.target.closest("input")) return;
  if (e.key === " " || e.key === "Enter") {
    if (e.target.closest("button")) return; // let focused buttons work normally
    e.preventDefault();
    flipMain();
  } else if (e.key === "ArrowLeft" || e.key === "1") {
    answer(false);
  } else if (e.key === "ArrowRight" || e.key === "2") {
    answer(true);
  }
});

window.addEventListener("online", () => scheduleSync(0));
document.addEventListener("visibilitychange", () => scheduleSync(0)); // sync on open and before leaving

// ---------- Start ----------

async function start() {
  scrim.hidden = false;
  setRevealed(false);
  try {
    const res = await fetch("words.json");
    if (!res.ok) throw new Error(res.status);
    words = (await res.json()).map((w) => ({ ...w, id: String(w.no) }));
  } catch {
    card.innerHTML = `<p class="error">Couldn't load the word list. Check your connection and reload the page.</p>`;
    return;
  }
  byId = new Map(words.map((w) => [w.id, w]));
  order = shuffledIds(words.map((w) => w.id), progress.settings.seed);
  updateStats();
  if (hasToken()) {
    // Wait briefly for the first sync so the shared shuffle order is used from the first card.
    await Promise.race([runSync(), new Promise((r) => setTimeout(r, 2500))]);
  } else {
    setSyncState("local");
  }
  showNext();
}

if ("serviceWorker" in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js").catch(() => {});
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController) location.reload(); // a new version was installed
  });
}

start();
