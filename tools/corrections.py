"""Apply spelling corrections to the extracted table and log them.

Usage: python3 corrections.py data/raw_extract.json data/corrected.json CORRECTIONS.md
"""
import json
import sys

# (row no., field, old text, new text, reason)
CORRECTIONS = [
    # Column-wrap artifact the extractor could not rejoin (word not in system dictionary)
    (193, "syn1", "Groundbreakin g", "Groundbreaking", "line-wrap split"),
    # Misspellings
    (14, "word", "Anamalous", "Anomalous", "misspelling"),
    (37, "syn3", "Auxillary", "Auxiliary", "misspelling"),
    (43, "syn2", "Counterveil", "Countervail", "misspelling"),
    (45, "syn1", "Seperate", "Separate", "misspelling"),
    (133, "syn2", "Noticible", "Noticeable", "misspelling"),
    (156, "syn2", "Propogate", "Propagate", "misspelling"),
    (185, "syn3", "Ascendency", "Ascendancy", "misspelling (variant)"),
    (200, "syn1", "Potrait", "Portrait", "misspelling"),
    (255, "word", "Forgone Conclusion", "Foregone Conclusion", "misspelling (matches sentence)"),
    (262, "syn1", "Prevalance", "Prevalence", "misspelling"),
    (263, "syn2", "Propogandize", "Propagandize", "misspelling"),
    (267, "syn3", "Critisize", "Criticize", "misspelling"),
    # Wrong headword: meaning and sentence are for "induce"
    (99, "word", "Inducement", "Induce", "duplicate headword; row defines 'induce'"),
    # Table errors (not spelling), fixed on request on 2026-10-29
    (36, "syn1", "Conversational vernacular", "Idiom", "table error; noun synonyms chosen"),
    (36, "syn2", "Synonyms", "Slang", "table error (leftover header text)"),
    (36, "syn3", "Dialectal", "Vernacularism", "table error; noun synonyms chosen"),
    (98, "sentence", "treachery was irrefutable", "treachery was indisputable", "sentence used a different word"),
    (161, "sentence",
     "It is estimated that over one-third of sub-prime borrowers could have qualified for cheaper, conventional loans.",
     "With its red phone boxes and black cabs, the street looked like the quintessential London scene.",
     "sentence did not use the word; replaced"),
    (229, "syn1", "Concord Clear Peer", "Contemporaneous", "table error; synonyms per Wiktionary/WordNet"),
    (229, "syn2", "Fellow", "Coexistent", "synonym for the 'same time' sense per Wiktionary"),
    # British -> American
    (6, "meaning", "skilful", "skillful", "British to American"),
    (24, "meaning", "favourable", "favorable", "British to American"),
    (28, "meaning", "defence", "defense", "British to American"),
    (32, "meaning", "behaviour", "behavior", "British to American"),
    (151, "meaning", "unspoilt", "unspoiled", "British to American"),
    (164, "syn1", "Catalogue", "Catalog", "British to American"),
    (172, "meaning", "mollusc", "mollusk", "British to American"),
    (212, "meaning", "offence", "offense", "British to American"),
    (226, "sentence", "behaviour", "behavior", "British to American"),
    (235, "sentence", "liberalisation", "liberalization", "British to American"),
    (269, "meaning", "behaviour", "behavior", "British to American"),
]

NOT_CHANGED = [
    "#267 Lambast: kept; 'lambast' is an accepted variant of 'lambaste'.",
    "#273 Nurture: 'Satnpaper' kept as written (likely a company name).",
    "'amongst' (#150) and 'towards' (#55, #120, #162): kept; both are standard in American English.",
    "Em-dashes and en-dashes inside example sentences (#10, #15, #24, #78): kept as in the source.",
]


def main(src, dst, log_path):
    rows = json.load(open(src))
    log = []
    for no, field, old, new, why in CORRECTIONS:
        row = rows[no - 1]
        assert row["no"] == no
        assert old in row[field], f"#{no} {field}: '{old}' not found in '{row[field]}'"
        row[field] = row[field].replace(old, new)
        log.append(f"| {no} | {field} | {old} | {new} | {why} |")
    json.dump(rows, open(dst, "w"), indent=1, ensure_ascii=False)

    with open(log_path, "w") as f:
        f.write("# Corrections to Sat_Vocabulary_List.pdf\n\n")
        f.write("Applied when building `~/Downloads/Sat_Vocab_List_final.pdf`.\n\n")
        f.write("| No. | Column | Before | After | Reason |\n|---|---|---|---|---|\n")
        f.write("\n".join(log) + "\n\n")
        f.write("Other split words rejoined automatically: Contemptuously (#27), Indistinguishable (#96), "
                "Incomprehensible (#102), Insurmountable (#107), Understatement (#179), "
                "Incontrovertible (#191), Comprehensive (#247), Notwithstanding (#307).\n\n")
        f.write("## Noticed but not changed\n\n")
        f.write("\n".join(f"- {n}" for n in NOT_CHANGED) + "\n")
    print(f"{len(log)} corrections applied -> {dst}")


if __name__ == "__main__":
    main(*sys.argv[1:4])
