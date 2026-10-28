"""Render the corrected table to a PDF that mirrors the original layout.

Usage: python3 build_final_pdf.py data/corrected.json <output.pdf>
Uses Brave (Chromium) headless to print HTML to PDF.
"""
import html
import json
import os
import subprocess
import sys
import tempfile

BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"

CSS = """
@page { size: A4 landscape; margin: 14mm 12mm 16mm 12mm;
        @bottom-right { content: "Page " counter(page); font: 8pt Verdana, sans-serif; } }
body { font-family: Verdana, "DejaVu Sans", sans-serif; font-size: 8pt; color: #000; margin: 0; }
h1 { font-size: 15pt; margin: 0 0 8pt; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th, td { border: 0.75pt solid #000; padding: 3pt 5pt; text-align: left; vertical-align: top; line-height: 1.25; }
th { font-weight: bold; }
tr { break-inside: avoid; }
td.word { font-weight: bold; }
"""

COLS = [("No.", "3.6%"), ("Word", "12.4%"), ("Meaning", "23.4%"), ("Synonym 1", "9.5%"),
        ("Synonym 2", "9.5%"), ("Synonym 3", "9.5%"), ("Example Sentence", "32.1%")]


def build_html(rows):
    e = html.escape
    head = "".join(f'<th style="width:{w}">{e(n)}</th>' for n, w in COLS)
    body = "\n".join(
        f'<tr><td>{r["no"]}</td><td class="word">{e(r["word"])}</td><td>{e(r["meaning"])}</td>'
        f'<td>{e(r["syn1"])}</td><td>{e(r["syn2"])}</td><td>{e(r["syn3"])}</td><td>{e(r["sentence"])}</td></tr>'
        for r in rows
    )
    return (f'<!doctype html><html><head><meta charset="utf-8"><title>SAT Vocabulary List</title>'
            f"<style>{CSS}</style></head><body><h1>SAT Vocabulary List</h1>"
            f"<table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table></body></html>")


def main(src, dst):
    rows = json.load(open(src))
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False) as f:
        f.write(build_html(rows))
        page = f.name
    try:
        subprocess.run([BRAVE, "--headless", "--disable-gpu", "--no-pdf-header-footer",
                        f"--print-to-pdf={os.path.abspath(dst)}", f"file://{page}"],
                       check=True, capture_output=True, timeout=120)
    finally:
        os.unlink(page)
    print(f"wrote {dst}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
