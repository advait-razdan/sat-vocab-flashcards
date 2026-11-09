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
    # Wording review, applied on request on 2026-11-08
    (149, "meaning", "Expressive or affected, unwarranted or exaggerated importance, worth, or stature.",
     "Trying to appear more important than you actually are.", "garbled meaning; simplified on request"),
    (149, "sentence", "cleanlier", "cleaner", "nonstandard word"),
    (27, "syn1", "Belligerently", "Grudgingly", "synonym had the wrong meaning"),
    (27, "syn2", "Rudely", "Reluctantly", "synonym had the wrong meaning"),
    (27, "syn3", "Contemptuously", "Unwillingly", "synonym had the wrong meaning"),
    (127, "syn1", "Devise", "Commercialize", "synonym unrelated to the word"),
    (127, "syn2", "Fabricate", "Capitalize on", "synonym unrelated to the word"),
    (127, "syn3", "Provide", "Profit from", "synonym unrelated to the word"),
    (243, "sentence", "negated her old one", "negated his old one", "pronoun mismatch (he/her)"),
    (199, "sentence", "is now a thing of the past", "are now things of the past", "subject-verb agreement"),
    (168, "sentence",
     "The researchers carried out marking their observations with a scrupulous attention to detail to prevent capture of any faulty data.",
     "The researchers recorded their observations with scrupulous attention to detail to avoid capturing faulty data.",
     "garbled sentence"),
    (218, "sentence", "is an authentic copy of the original", "is authentic", "sentence contradicted the meaning ('not a copy')"),
    (192, "word", "Unpalatability", "Unpalatable", "meaning, synonyms and sentence are for the adjective"),
    (226, "meaning", "Used for emphasis, especially to express anger or annoyance.",
     "Caused surprise or confusion in (someone).", "meaning was a different sense from the sentence"),
    (171, "meaning", "Having the ability to see", "Caught sight of; glimpsed.",
     "meaning was a different sense from the sentence and synonyms"),
    (258, "meaning", "Not allowing fluid to pass through.",
     "Not allowing fluid to pass through; unable to be affected by something.", "added the sense the sentence uses"),
    (253, "syn1", "Pasturage", "Scavenge", "synonyms were nouns for animal feed"),
    (253, "syn2", "Herbage", "Rummage", "synonyms were nouns for animal feed"),
    (253, "syn3", "Fodder", "Hunt", "synonyms were nouns for animal feed"),
    (212, "syn1", "Exasperate", "Worsen", "synonyms were for the 'annoy' sense, not 'make worse'"),
    (212, "syn2", "Incense", "Exacerbate", "synonyms were for the 'annoy' sense, not 'make worse'"),
    (212, "syn3", "Antagonize", "Compound", "synonyms were for the 'annoy' sense, not 'make worse'"),
    (112, "sentence",
     "The speech was interjected often by hecklers with shouts of displeasure at the points being spoken about.",
     "The speech was punctuated by frequent interjections from hecklers.", "misused 'interjected'"),
    (276, "sentence", "the problem perpetuates.", "the problem perpetuates itself.", "'perpetuate' needs an object"),
    (174, "sentence", "to propel a propaganda", "to spread propaganda", "'propaganda' takes no article"),
    (308, "syn1", "Timider", "More timid", "nonstandard comparative"),
    (273, "sentence",
     "Since the past 2 years, careful planning, designing and nurturing have gone into creating the state of the art testing platform at Satnpaper.",
     "Over the past two years, careful planning, designing and nurturing have gone into creating the state-of-the-art testing platform.",
     "ungrammatical; removed company promo text"),
    (20, "syn1", "Reduced", "Reduce", "match verb form"),
    (20, "syn2", "Impaired", "Weaken", "match verb form"),
    (20, "syn3", "Enervated", "Diminish", "match verb form"),
    (33, "syn2", "Imbue", "Spur", "synonym had the wrong meaning"),
    (60, "syn2", "Ensue", "Issue", "synonym had the wrong meaning"),
    (72, "syn1", "Precise", "Precision", "noun for a noun"),
    (72, "syn2", "Accurate", "Accuracy", "noun for a noun"),
    (89, "syn1", "Teardown", "Tear down", "spacing"),
    (89, "syn3", "Chop Out", "Chop out", "capitalization"),
    (143, "syn2", "Cause to", "Spark", "incomplete synonym"),
    (158, "syn3", "Circumspect", "Circumspection", "noun for a noun"),
    (173, "syn2", "Periodical", "Irregular", "'periodical' means regular, the opposite"),
    (190, "syn3", "Popular", "Pervasive", "synonym had the wrong meaning"),
    (241, "syn2", "Dispense", "Disperse", "synonym had the wrong meaning"),
    (245, "syn1", "Inscrutable", "Mystery", "noun for a noun"),
    (245, "syn2", "Obscure", "Puzzle", "noun for a noun"),
    (249, "syn2", "Harnessing", "Harness", "match verb form"),
    (254, "syn1", "Anticipating", "Anticipation", "noun for a noun"),
    (68, "meaning", "Fair and Impartial", "Fair and impartial", "capitalization"),
    (185, "meaning", "Control or Influence", "Control or influence", "capitalization"),
    (191, "meaning", "; Unambiguous", "; unambiguous", "capitalization"),
    (223, "meaning", "; To make vulnerable", "; to make vulnerable", "capitalization"),
    (196, "meaning", "(Material or Structure)", "(of a material or structure)", "capitalization"),
    (196, "meaning", "(Of a person)", "(of a person)", "capitalization"),
    (87, "sentence", "Mock test", "mock test", "capitalization"),
    (33, "sentence", "E-commerce", "e-commerce", "capitalization"),
    (26, "sentence", "post match", "post-match", "hyphen"),
    (26, "sentence", "all time low", "all-time low", "hyphen"),
    (129, "meaning", "ill defined", "ill-defined", "hyphen"),
    (247, "sentence", "In high level team sports, teams conducted", "In high-level team sports, teams conduct",
     "hyphen; tense"),
    (154, "sentence", "cost prohibitive", "cost-prohibitive", "hyphen"),
    (44, "sentence", "now defunct", "now-defunct", "hyphen"),
    (120, "sentence", "on the sound of the bell", "at the sound of the bell", "preposition"),
    (135, "sentence", "in the battlefield", "on the battlefield", "preposition"),
    (119, "sentence", "to follow suit", "to follow", "redundant 'suit'"),
    (150, "sentence", "as they receive their formal education in.",
     "as the one in which they received their formal education.", "doubled 'in'"),
    (269, "sentence", "positive significant", "significant positive", "word order"),
    (244, "sentence", "endured through time so", "endured through time, so", "missing comma"),
    (291, "meaning", "If you resonate with something; it", "If you resonate with something, it", "comma, not semicolon"),
    (138, "meaning", "destructive: tending to a fatal issue: deadly.", "destructive; tending to a fatal issue; deadly.",
     "semicolons, not colons"),
    (16, "sentence", "acknowledgement", "acknowledgment", "British to American"),
    (297, "syn3", "Sizeable", "Sizable", "British to American"),
    (36, "sentence", '"affection deprivation",', '"affection deprivation,"', "quote punctuation"),
]

NOT_CHANGED = [
    "#267 Lambast: kept; 'lambast' is an accepted variant of 'lambaste'.",
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
    periods = [r["no"] for r in rows if not r["meaning"].endswith(".")]
    for r in rows:
        if not r["meaning"].endswith("."):
            r["meaning"] += "."
    json.dump(rows, open(dst, "w"), indent=1, ensure_ascii=False)

    with open(log_path, "w") as f:
        f.write("# Corrections to Sat_Vocabulary_List.pdf\n\n")
        f.write("Applied when building `~/Downloads/Sat_Vocab_List_final.pdf`.\n\n")
        f.write("| No. | Column | Before | After | Reason |\n|---|---|---|---|---|\n")
        f.write("\n".join(log) + "\n\n")
        f.write("Final period added to meanings: " + ", ".join(f"#{n}" for n in periods) + ".\n\n")
        f.write("Other split words rejoined automatically: Contemptuously (#27), Indistinguishable (#96), "
                "Incomprehensible (#102), Insurmountable (#107), Understatement (#179), "
                "Incontrovertible (#191), Comprehensive (#247), Notwithstanding (#307).\n\n")
        f.write("## Noticed but not changed\n\n")
        f.write("\n".join(f"- {n}" for n in NOT_CHANGED) + "\n")
    print(f"{len(log)} corrections applied -> {dst}")


if __name__ == "__main__":
    main(*sys.argv[1:4])
