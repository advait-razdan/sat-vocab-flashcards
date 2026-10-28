"""Re-extract the final PDF (the reference source) and check it matches the corrected data.

Usage: python verify_final_pdf.py <final.pdf> data/corrected.json data/words.json docs/words.json
Requires pdfplumber (run from a throwaway venv).
"""
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).parent


def main(pdf, corrected, out, public_out):
    with tempfile.NamedTemporaryFile(suffix=".json") as tmp:
        subprocess.run([sys.executable, str(HERE / "extract_pdf.py"), pdf, tmp.name], check=True,
                       capture_output=True)
        from_pdf = json.load(open(tmp.name))
    expected = json.load(open(corrected))
    diffs = [(a["no"], k, a[k], b[k]) for a, b in zip(from_pdf, expected) for k in a if a[k] != b[k]]
    for d in diffs:
        print("MISMATCH", d)
    assert len(from_pdf) == len(expected) == 312, (len(from_pdf), len(expected))
    assert not diffs, f"{len(diffs)} mismatches between final PDF and corrected data"
    json.dump(from_pdf, open(out, "w"), indent=1, ensure_ascii=False)
    shutil.copy(out, public_out)
    print(f"final PDF matches corrected data: {len(from_pdf)} rows -> {out}, {public_out}")


if __name__ == "__main__":
    main(*sys.argv[1:5])
