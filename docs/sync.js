// Progress storage: always saved on this device first, then synced to a
// secret GitHub gist when a token is connected and the network is up.
import { mergeProgress } from "./srs.js";

const PROGRESS_KEY = "satflash.progress.v1";
const TOKEN_KEY = "satflash.token";
const GIST_KEY = "satflash.gistId";
const GIST_DESC = "SAT Vocab progress (used by the flashcards app, do not delete)";
const GIST_FILE = "progress.json";
const API = "https://api.github.com";

function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key, value) {
  try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch {}
}

export function emptyProgress() {
  // seedUpdatedAt 0: any seed already stored in the gist wins over this one.
  return { version: 1, resetAt: 0, settings: { seed: Math.floor(Math.random() * 2 ** 31), seedUpdatedAt: 0 }, cards: {} };
}

export function loadLocal() {
  try {
    const p = JSON.parse(read(PROGRESS_KEY));
    if (p && p.cards && p.settings) return p;
  } catch {}
  const p = emptyProgress();
  saveLocal(p);
  return p;
}

export function saveLocal(progress) {
  write(PROGRESS_KEY, JSON.stringify(progress));
}

export const hasToken = () => !!read(TOKEN_KEY);

export class SyncError extends Error {
  constructor(kind, message) { super(message); this.kind = kind; } // kind: offline | auth | other
}

async function api(path, token, options = {}) {
  let res;
  try {
    res = await fetch(API + path, {
      ...options,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
    });
  } catch {
    throw new SyncError("offline", "No connection");
  }
  if (res.status === 401 || res.status === 403) throw new SyncError("auth", "GitHub rejected the token");
  if (!res.ok) throw new SyncError("other", `GitHub error ${res.status}`);
  return res.json();
}

async function findOrCreateGist(token, progress) {
  for (let page = 1; page <= 10; page++) {
    const gists = await api(`/gists?per_page=100&page=${page}`, token);
    const found = gists.find((g) => g.description === GIST_DESC && g.files[GIST_FILE]);
    if (found) return found.id;
    if (gists.length < 100) break;
  }
  // First device ever: this device's shuffle seed becomes the shared one.
  const initial = { ...progress, settings: { ...progress.settings, seedUpdatedAt: Date.now() } };
  const created = await api("/gists", token, {
    method: "POST",
    body: JSON.stringify({ description: GIST_DESC, public: false, files: { [GIST_FILE]: { content: JSON.stringify(initial) } } }),
  });
  return created.id;
}

async function pull(token, gistId) {
  const gist = await api(`/gists/${gistId}`, token);
  const file = gist.files[GIST_FILE];
  if (!file) throw new SyncError("other", "Progress file missing from gist");
  let content = file.content;
  if (file.truncated) {
    try { content = await (await fetch(file.raw_url, { cache: "no-store" })).text(); }
    catch { throw new SyncError("offline", "No connection"); }
  }
  return JSON.parse(content);
}

// JSON with sorted keys, so equal progress always serializes identically.
function stable(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
}

// Merge local progress with the gist and push the result back if it changed.
// Returns the merged progress (also saved locally by the caller).
export async function sync(local) {
  const token = read(TOKEN_KEY);
  if (!token) throw new SyncError("auth", "Not connected");
  let gistId = read(GIST_KEY);
  if (!gistId) {
    gistId = await findOrCreateGist(token, local);
    write(GIST_KEY, gistId);
  }
  let remote;
  try {
    remote = await pull(token, gistId);
  } catch (e) {
    if (e.message === "GitHub error 404") write(GIST_KEY, null); // gist deleted: find or recreate next time
    throw e;
  }
  const merged = mergeProgress(local, remote);
  if (stable(merged) !== stable(mergeProgress(remote, {}))) {
    await api(`/gists/${gistId}`, token, {
      method: "PATCH",
      body: JSON.stringify({ files: { [GIST_FILE]: { content: JSON.stringify(merged) } } }),
    });
  }
  return merged;
}

export async function connect(token, local) {
  write(TOKEN_KEY, token.trim());
  write(GIST_KEY, null);
  try {
    return await sync(local);
  } catch (e) {
    if (e.kind === "auth") write(TOKEN_KEY, null);
    throw e;
  }
}

export function disconnect() {
  write(TOKEN_KEY, null);
  write(GIST_KEY, null);
}
