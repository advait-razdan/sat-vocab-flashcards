// Checks the structure of the reading question bank.
// Run: node tools/validate_questions.mjs [path]   (default docs/questions.json)
import { readFileSync } from "node:fs";

const path = process.argv[2] ?? new URL("../docs/questions.json", import.meta.url);
const qs = JSON.parse(readFileSync(path, "utf8"));
const TYPES = ["central-ideas", "inferences", "textual-evidence", "quantitative", "words-in-context", "structure-purpose", "cross-text", "rhetorical-synthesis", "transitions"];
const BANDS = ["band7", "band6", "older"];
const errors = [];
const ids = new Set();
const str = (v) => typeof v === "string" && v.trim().length > 0;

for (const [n, q] of qs.entries()) {
  const at = q.id ?? `#${n}`;
  const err = (m) => errors.push(`${at}: ${m}`);
  if (!str(q.id)) err("missing id");
  else if (ids.has(q.id)) err("duplicate id");
  ids.add(q.id);
  if (!TYPES.includes(q.type)) err(`bad type ${q.type}`);
  if (!BANDS.includes(q.difficulty)) err(`bad difficulty ${q.difficulty}`);
  if (typeof q.intro !== "string") err("intro must be a string");
  if (!Array.isArray(q.passage) || !q.passage.length || !q.passage.every((b) => typeof b.label === "string" && str(b.text))) err("bad passage");
  if (!str(q.question)) err("missing question");
  if (!Array.isArray(q.choices) || q.choices.length !== 4 || !q.choices.every(str)) err("need 4 choices");
  else if (new Set(q.choices).size !== 4) err("duplicate choices");
  if (![0, 1, 2, 3].includes(q.answer)) err("answer must be 0-3");
  const ex = q.explanation;
  if (!ex || !str(ex.passage) || !Array.isArray(ex.choices) || ex.choices.length !== 4 || !ex.choices.every(str)) err("need a passage explanation and 4 choice explanations");
  else {
    ex.choices.forEach((c, i) => {
      const says = /^\s*correct\b/i.test(c) ? "correct" : /^\s*incorrect\b/i.test(c) ? "incorrect" : null;
      if (!says) err(`explanation ${"ABCD"[i]} should start with Correct/Incorrect`);
      else if ((says === "correct") !== (i === q.answer)) err(`explanation ${"ABCD"[i]} says ${says} but answer is ${"ABCD"[q.answer]}`);
    });
  }
  const text = [q.intro, q.question, ...q.passage.map((b) => b.text), ...(q.choices ?? [])].join(" ");
  if ((text.match(/\[u\]/g) ?? []).length !== (text.match(/\[\/u\]/g) ?? []).length) err("unbalanced [u] tags");
  if (/<[a-z]/i.test(text)) err("contains HTML");

  const f = q.figure;
  if (q.type === "quantitative" && !f) err("quantitative question needs a figure");
  if (f) {
    if (f.kind === "table") {
      if (!Array.isArray(f.columns) || !Array.isArray(f.rows) || !f.rows.length) err("table needs columns and rows");
      else if (f.rows.some((r) => r.length !== f.columns.length || r.some((c) => typeof c !== "string"))) err("table rows must match columns and be strings");
    } else if (f.kind === "bar" || f.kind === "line") {
      if (!Array.isArray(f.categories) || !f.categories.length || !Array.isArray(f.series) || !f.series.length || f.series.length > 4) err("chart needs categories and 1-4 series");
      else if (f.series.some((s) => !str(s.name) || s.values.length !== f.categories.length || s.values.some((v) => typeof v !== "number" || !isFinite(v)))) err("chart series must have a name and one number per category");
    } else err(`bad figure kind ${f.kind}`);
  }
}

const count = (key) => qs.reduce((m, q) => ((m[q[key]] = (m[q[key]] ?? 0) + 1), m), {});
const letters = qs.reduce((m, q) => ((m["ABCD"[q.answer]] = (m["ABCD"[q.answer]] ?? 0) + 1), m), {});
console.log(`${qs.length} questions`, count("type"), count("difficulty"), "answers", letters);
const fresh = qs.filter((q) => q.difficulty !== "older");
if (fresh.length) {
  const by = (key) => fresh.reduce((m, q) => ((m[q[key]] = (m[q[key]] ?? 0) + 1), m), {});
  const freshLetters = fresh.reduce((m, q) => ((m["ABCD"[q.answer]] = (m["ABCD"[q.answer]] ?? 0) + 1), m), {});
  const longest = fresh.filter((q) => q.choices.every((c, i) => i === q.answer || c.length < q.choices[q.answer].length)).map((q) => q.id);
  console.log(`banded: ${fresh.length}`, by("type"), "answers", freshLetters);
  if (longest.length) console.log(`answer is the longest choice in ${longest.length}: ${longest.join(", ")}`);
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("OK");
