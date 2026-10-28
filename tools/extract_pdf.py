"""Extract the vocabulary table from a PDF into JSON.

Usage: python extract_pdf.py <input.pdf> <output.json>
Requires pdfplumber (run from a throwaway venv).
"""
import json
import sys

import pdfplumber

FIELDS = ["no", "word", "meaning", "syn1", "syn2", "syn3", "sentence"]
DICT = {w.strip().lower() for w in open("/usr/share/dict/words")}


def is_word(s):
    return s.lower() in DICT


def join_lines(cell, log):
    """Join a cell's wrapped lines. A word split mid-way by a narrow column
    (e.g. 'Contemptuousl' + 'y') is glued back without a space."""
    lines = [l.strip() for l in (cell or "").split("\n") if l.strip()]
    if not lines:
        return ""
    out = lines[0]
    for nxt in lines[1:]:
        tail = out.split(" ")[-1]
        head = nxt.split(" ")[0]
        glued = tail + head
        if tail.isalpha() and head.isalpha() and is_word(glued) and not (is_word(tail) and is_word(head)):
            log.append(f"glued '{tail}' + '{head}' -> '{glued}'")
            out = out + nxt
        elif len(tail) > 1 and tail.endswith("—"):
            out = out + nxt  # dash attached to a word ("crowded—days") wraps without a space
        else:
            out = out + " " + nxt
    return out


def main(src, dst):
    rows, log = [], []
    with pdfplumber.open(src) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables():
                for raw in table:
                    if not raw or not raw[0] or not raw[0].strip().isdigit():
                        continue  # header row
                    cells = [join_lines(c, log) for c in raw]
                    rec = dict(zip(FIELDS, cells))
                    rec["no"] = int(rec["no"])
                    rows.append(rec)
    nums = [r["no"] for r in rows]
    assert nums == list(range(1, len(rows) + 1)), f"row numbering broken: {nums}"
    json.dump(rows, open(dst, "w"), indent=1, ensure_ascii=False)
    print(f"{len(rows)} rows -> {dst}")
    print("\n".join(log))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
