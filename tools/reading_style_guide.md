# SAT Reading question style guide

Used to write the bank in `docs/questions.json`. It is based on hard reference questions from the Digital SAT Reading and Writing section (three real College Board questions and about twenty from a prep platform). No reference question is copied into the bank; write new ones.

## The format of a Digital SAT reading question
- One short passage (usually 25–150 words; paired texts are about 60–110 words each), sometimes with an intro line in italics-style plain text such as "The following text is adapted from Willa Cather's 1913 novel *O Pioneers!*. Alexandra is speaking to her brother."
- One question, four choices A–D, exactly one defensibly correct.
- Everything needed is in the passage (and figure). No outside knowledge is needed, but passages sound like real academic writing: named researchers ("Lidya Tarhan et al.", "historian Henry Louis Gates Jr."), specific places, years, species and numbers.
- Passages are dense and formal. Hard questions use long sentences with qualifying clauses, concessions ("Although…", "however"), and technical terms defined in passing ("conspecifics (other members of the same species)").

## Question types and exact stem wording
Use these stems (they are the College Board's real wording; reusing a stem is fine).

### 1. inference — completes the text
- "Which choice most logically completes the text?" The passage ends with "______" (six underscores), usually after "which suggests that", "the researchers suggest that", "Together, these observations suggest that", or a colon.
- Hard version: the right answer is a careful two-step inference that combines two facts from the passage (e.g. sample deteriorated in Earth humidity + meteorites found on Earth lack the compound → the meteorites' lack of compound may come from Earth humidity). It is often worded abstractly or cautiously ("may be attributable to", "does not by itself indicate").
- Wrong choices: reverse the logic, overreach ("definitively", "all"), contradict a detail (e.g. says "independent of climate" when the passage controlled for it), bring in an alternative cause the passage rules out, or say something reasonable that the passage doesn't support.

### 2. evidence — support / weaken / illustrate (subtypes: `weaken`, `support`, `quotation`, `explains`)
- "Which finding, if true, would most directly weaken [X]'s argument / the conclusion…?"
- "Which finding, if true, would most directly support the researchers' hypothesis / the underlined claim?"
- "Which finding, if true, would most directly explain why [X] reject the common explanation presented in the text?"
- "Which finding, if true, would provide the best evidence that [X] were right to make the concession described in the text?"
- "Which quotation from [a work / a historian / an essay by X] would most directly support/illustrate the student's/historian's claim?" (choices are quotations)
- "Which choice most effectively uses a quotation from [work] to illustrate the claim?" (choices describe a character + quote)
- Hard weaken questions (model: real SAT obsidian question): the conclusion is "X stayed the same, which indicates Y". The right answer breaks the link between evidence and conclusion, often by showing the evidence is equally consistent with the other explanation (e.g. the methods were shared with the incoming culture, so continuity of methods doesn't show continuity of people). Wrong answers: support the conclusion, are true but irrelevant, compare something the argument doesn't depend on (efficiency, other regions), or address only one half of the claim.
- Hard support questions: the right answer must match every part of the claim (e.g. "aware of materials" AND "deliberately applied"). Wrong answers match only part, or match the topic but not the claim.
- Quotation questions: one quote matches the claim exactly; the others are on-topic but show the opposite, only part, or something neutral.

### 3. quantitative — graphs and tables (subtypes: `bar`, `line`, `table`)
- "Which choice most effectively uses data from the graph/table to complete the [statement/example]?"
- "Which choice best describes data from the graph that support/weaken [X]'s hypothesis?"
- "Which choice best describes the extent to which the student's claim is supported by data from the graph?"
- "Based on the information in the text and the graph, [X] could most reasonably draw which conclusion?"
- "Which consideration, if true, should make the [person] most hesitant to rely on what the table suggests is…?"
- Figure + passage must both be needed. Hard version: the reader must read the passage to know which part of the figure matters (e.g. "values above 1 mean insufficient land"), or compare two series.
- Wrong choices: accurately describe the figure but don't address the claim; misread a value; apply the claim to the wrong group; draw the reverse conclusion.
- Data must be internally consistent and the right answer must be checkable from the numbers given. Bars and lines need values written in the data (not guessed off a picture).

### 4. structure — structure, purpose, paired texts, literary (subtypes: `structure`, `purpose`, `cross-text`, `literary`, `main-idea`)
- "Which choice best describes the overall structure of the text?"
- "Which choice best describes the function of the underlined sentence in the text as a whole?" (underline with [u]…[/u])
- "Which choice best states the main purpose of the text?"
- "Based on the texts, how would the author of Text 2 most likely respond to the [claim/view] in Text 1?"
- "Based on the texts, the author of Text 2 would most likely agree with which statement about [term] discussed in Text 1?"
- "Which choice best describes a notable difference in focus between Text 1 and Text 2?"
- Literary: "Which choice best describes how [character] is presented in the text?", "Based on the text, what does the narrator most strongly suggest about [X]?", "Which choice best states the main idea of the text?" Use adapted public-domain fiction, poetry, plays or essays (before 1929) with an intro line naming author, year, work.
- Hard literary model (real SAT Tom Sawyer question): the right answer catches the narrator's tone (gentle irony about a character's mistaken self-image) and says it precisely; wrong answers get the trait slightly wrong (e.g. "intellectual" instead of "subtle"), add a trait not shown (nosy), or get the tone wrong.
- Hard cross-text model (real SAT Grande Terre question): Text 2 gives data that, combined with Text 1, implies something neither says directly. The right answer needs both texts; wrong answers misread a number or attribute a view to the wrong author.
- Structure answers are abstract ("It introduces a significant work, summarizes a noteworthy idea in that work, and then places that idea into a context that demonstrates its broader implications."). Wrong ones get one step wrong ("addresses a recent resurgence of interest", "characterizes a work as underappreciated").

## Hard-question traps to build in (each question should use at least two)
1. **Half right**: the first half matches, the second half is unsupported.
2. **Too strong**: "always", "all", "definitively", "only", "eliminates".
3. **True but irrelevant**: accurate to the passage but doesn't answer the question asked.
4. **Reversal**: swaps cause and effect, or which group did what.
5. **Topic match, claim miss**: right subject and words, wrong claim.
6. **Outside the scope**: plausible in the real world but not in the passage.
7. **Near-synonym swap**: one word changes the meaning (intellectual vs. subtle; nosy vs. scheming).
Wrong choices should be about as long and as formal as the right one. The right answer must not be the longest or the only one using words from the passage.

## Writing rules
- `difficulty`: about 80% "hard" (like the real SAT hard questions above), 20% "medium".
- Balance the correct letter: across each batch, about a quarter each for A, B, C, D.
- Vary topics: natural science (biology, ecology, geology, astronomy, chemistry), social science (economics, psychology, archaeology, linguistics, history), humanities (art, music, literature, philosophy, architecture), and literature.
- Facts may be adapted. Studies and quotations should sound real but don't need to be exact; never write anything offensive about a real living person.
- Use plain ASCII quotes or proper typographic quotes consistently; avoid HTML in text. Use [u]…[/u] only for underlined parts that the question refers to, and *…* for titles of works (rendered in italics).
- One right answer only. Before finishing each question, ask: "Could a careful student defend any other choice?" If yes, fix it.

## Explanations (the most important part for learning)
- `explanation.passage`: 3–6 plain-English sentences that walk through the passage: what it is about, what each sentence does, and what the question really asks you to find. Write it as a tutor talking to a student who found the passage hard. Define jargon.
- `explanation.choices[i]`: one entry per choice, in order. Start with "Correct." or "Incorrect." then explain specifically why, quoting or pointing to the exact part of the passage/figure. For wrong choices, name the trap (e.g. "This only matches half the claim: …").

## JSON format
```json
{
  "id": "inf-001",
  "type": "inference",
  "subtype": "completes-text",
  "difficulty": "hard",
  "intro": "",
  "passage": [{ "label": "", "text": "..." }],
  "figure": null,
  "question": "Which choice most logically completes the text?",
  "choices": ["...", "...", "...", "..."],
  "answer": 2,
  "explanation": { "passage": "...", "choices": ["Incorrect. ...", "Incorrect. ...", "Correct. ...", "Incorrect. ..."] }
}
```
- `type`: one of `inference`, `evidence`, `quantitative`, `structure`.
- `passage`: array of blocks. Normal passages have one block with label "". Paired texts have two blocks labelled "Text 1" and "Text 2". A poem can use one block per stanza with label "". A line break inside a block can be written as "\n".
- `intro`: "" when not used.
- `answer`: index 0–3.
- `figure` (only for quantitative; otherwise null), one of:
  - Table: `{ "kind": "table", "title": "...", "columns": ["Feeding system", "Milk (kg)", ...], "rows": [["Grazing", "705", ...], ...], "note": "" }`
  - Bar chart: `{ "kind": "bar", "title": "...", "xLabel": "...", "yLabel": "...", "categories": ["solar", "wind"], "series": [{ "name": "Poland", "values": [0.62, 1.74] }, ...], "note": "" }` (1–4 series)
  - Line chart: `{ "kind": "line", "title": "...", "xLabel": "...", "yLabel": "...", "categories": ["2000", "2005", ...], "series": [{ "name": "...", "values": [...] }], "note": "" }` (1–3 series)
  All numbers in `values` must be numbers (not strings), and `values.length` must equal `categories.length`. The chart shows the value labels, so readers can read exact numbers.
