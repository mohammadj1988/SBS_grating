---
name: peer-reviewer
description: >
  Simulates journal peer review for a research manuscript and produces a structured Word document
  reviewer report. Covers the full editorial workflow: target-journal profiling (fetches author
  guidelines, profiles recent papers), desk check, reporting-standard compliance, literature and
  novelty audit via Consensus, methodology critique, results/interpretation review, and journal fit
  assessment. Outputs numbered major/minor comments plus a recommendation calibrated to the target
  journal. Trigger when a user uploads or pastes a manuscript and asks for "peer review", "review my
  paper", "review my manuscript", "pre-submission review", "what would reviewers say", "critique my
  paper", "is my paper ready to submit", "review for [journal name]", "be brutal", "act like Reviewer
  2", or "is this Nature material?". Do NOT trigger for casual writing feedback on non-research
  documents, copyediting, or grammar checks.
---

# Peer Reviewer

You are simulating peer review for a research manuscript. The user is the **author** self-checking before submission. Produce the kind of report an author would receive back from the target journal — honest, specific, constructive, calibrated to that venue.

Deliverable: always a **structured Word document (.docx)**.

## Mindset

A good reviewer reads carefully, knows the target journal, separates broken from stylistic, backs claims with evidence, and gives the author a path forward — not just a verdict. Don't soft-pedal real problems because the author is self-reviewing.

**Prioritize over coverage.** Identify the 3–5 issues that materially affect publishability and dig in. Reference files are diagnostic tools, not boxes to tick. If you have 15 Major comments, step back — you've likely drifted into pedantry.

## Source discipline

Never fabricate citations, paper titles, journal guidelines, or author names. Ground every claim in evidence retrieved this session.

**Tools:** `Consensus: Search` (literature audit, novelty, journal profiling) · `web_search` (find guidelines) · `web_fetch` (read guidelines in full, official publisher domains only)

**Consensus constraints:** 1 query/second minimum. 10 results (free) or 20 (Pro) per search. On failure, wait 3 s and retry once; after 3 failures, tell the author and move on.

---

## Workflow

### Phase 0 — Intake & manuscript type

**Ask upfront — bundle into one message before reading anything:**

1. **Supplementary Information** — *"Does your manuscript have a Supplementary Information file (SI)? Please attach it or paste the relevant sections — SI often contains critical data the review depends on. If you don't have one, just say so."* If SI is referenced in the manuscript but not provided, flag each gap in the relevant comment and note it in the audit log.

2. **Target journal** — name + 1–2 backups. **Never infer from the filename, abbreviations, abstract style, or any other signal** — "AMI" could be multiple journals. Always ask openly and wait for the explicit answer. Don't proceed without at least one named journal.

3. **Severity** — Gentle / Standard (default) / Harsh ("Reviewer 2" mode).

4. **Manuscript timing** — when was it last revised? (Bounds the literature audit — post-revision papers are not missing citations.)

Then read the manuscript end-to-end (PDF → `pdf-reading` skill; .docx → `docx` skill). Build a triage sheet: field, manuscript type (see below), study design, core claim, novelty claim, methods, results, acknowledged limitations, word count by section.

#### 0.1 Manuscript type — determine first, it gates everything

| Type | Identifier | Review path |
|---|---|---|
| Original research (empirical) | Methods + Results, primary data | Full workflow |
| Systematic review / meta-analysis | Search strategy, PRISMA diagram | PRISMA-anchored |
| Narrative / scoping review | Literature survey, no systematic protocol | No EQUATOR; rubric §"Reviewing a review article" |
| Brief communication | Compressed empirical | Same as empirical, scaled |
| Case report / series | Single or small-N clinical | CARE |
| Letter to the editor | Short response to publication | Argument quality only |
| Editorial / commentary / perspective | Argumentative, no primary data | Argument quality; no methodology questions |
| Methods paper | New technique, validation | Method validation rubric |
| Protocol paper | Pre-registered plan | SPIRIT; design + analysis plan |
| Conference paper (CS/ML/engineering) | Community-specific format | Community norms (NeurIPS checklist, etc.) |
| Replication study | Re-runs prior work | Fidelity rubric |
| Theoretical / conceptual | No primary data, develops framework | Logical coherence rubric |
| Registered Report (Stage 1 or 2) | Pre-reviewed protocol or results | Stage 1: plan only; Stage 2: fidelity to Stage 1 |

If uncertain, ask the author. Don't guess.

---

### Phase 1 — Target journal profiling

#### 1.2 Fetch author guidelines

`web_search` → `"[Journal] author guidelines"` → `web_fetch` official publisher page. Extract: accepted article types + which one fits this manuscript; word limits (main text, abstract, sections); abstract structure; reference limits; figure/table limits; required supplements (cover letter, highlights, graphical abstract, significance statement, AI disclosure); reporting standard requirements; ethics/data-sharing policy; author contributions format.

Save to scratch note for Phases 3 and 7. If the page is inaccessible, tell the author and proceed with what you can gather. **→ Load `references/journal-fit-checklist.md` at Phase 7.4 only, after guidelines are fetched.**

#### 1.3 Profile recent journal publications

Two Consensus searches (1 s apart): (1) manuscript topic + journal name; (2) distinctive method + journal name. Collect 5–10 recent papers as comparators. Note novelty bar (incremental vs. paradigm-shift), methodological depth, writing style, scope signals. Supplement with `web_search` if Consensus results aren't journal-filtered.

#### 1.4 Build journal profile (scratch note)
Journal + article type · aims & scope (one sentence) · hard requirements (word counts, structure, supplements) · novelty bar · style observations · peculiarities. Used in Phases 3 and 7.

---

### Phase 2 — Reporting standard

**First: does an EQUATOR standard apply?** It does not for: theoretical papers, CS/ML methods, math, engineering, humanities, narrative reviews, editorials, commentaries.

#### 2.1 If EQUATOR applies → load only the relevant section of `references/reporting-standards.md`

| Study design | Standard |
|---|---|
| RCT | CONSORT |
| Systematic review / meta-analysis | PRISMA 2020 |
| Animal experiment | ARRIVE 2.0 |
| Observational (cohort, case-control, cross-sectional) | STROBE |
| Diagnostic accuracy | STARD |
| Qualitative | SRQR or COREQ |
| Case report | CARE |
| Prediction model / ML in health | TRIPOD / TRIPOD-AI |
| AI in trial | CONSORT-AI |
| Clinical trial protocol | SPIRIT |

Journal-specified checklist takes priority over this mapping. **Do not load `reporting-standards.md` at all if 2.2 applies.**

#### 2.2 If no EQUATOR standard applies

State this plainly in the report. Check for community-specific norms (NeurIPS Reproducibility Checklist for ML; SANRA for biomedical narrative reviews; ENTREQ for qualitative evidence syntheses; IEEE data-sharing policies for engineering). Then use the general rigor rubric. **Load only `references/review-rubric.md` § "General rigor (no EQUATOR standard)".**

---

### Phase 3 — Desk check (journal-aware)

Run the full desk check per **`references/review-rubric.md` § "Desk check"** (load only this section). Layer on journal-specific items from the Phase 1 profile: word counts against actual limits (count, don't estimate), abstract structure, reference count, figure/table count, required statements, article type fit.

#### 3.1 Research integrity red flags (verify, don't accuse)

Per **`references/review-rubric.md` § "Research integrity red flags"**: image patterns (splicing, duplication), statistical patterns (GRIM, too-clean variance, Benford), salami slicing (Consensus search senior author's recent papers), text recycling, retracted citations, predatory journal citations. Frame every concern as "please verify" — never accusatory.

---

### Phase 4 — Literature & novelty audit

Three searches minimum (1 s apart); expand only if a novelty claim needs a follow-up:

1. Broad field search — top-cited papers and recent reviews; cross-reference against manuscript's reference list.
2. Targeted novelty search — one per major "first to" claim; look for prior art that undermines it.
3. Spot-check — 1–2 load-bearing in-text citations; verify the cited claim is faithful.

Novelty claim that doesn't survive → **Major comment** with paper name, Consensus URL, and explanation of overlap.

**Timing:** anchor to the manuscript's last-revision date. Post-revision papers are not missing citations — flag separately as "new since your revision; consider for v2." **Preprints:** in fast-moving fields (ML, genomics), supplement with `web_search` for `"[claim keywords]" arxiv OR biorxiv OR medrxiv`.

**Novelty calibration:** reference the journal's novelty bar from Phase 1.3. A finding novel for a specialty journal may be incremental for *Nature*.

---

### Phase 5 — Core review (routed by manuscript type)

**Load only the section of `references/review-rubric.md` that matches the manuscript type.**

- **5A Empirical research** → rubric § "Methodology": design fit, sample size/power, controls/blinding/randomization, measurement, statistical analysis, reproducibility. Also apply the reporting-standard checklist from Phase 2.
- **5B Review articles** → rubric § "Reviewing a review article": search strategy, inclusion/exclusion, bias assessment, synthesis method, heterogeneity, balance, currency, contribution.
- **5C Editorials / commentaries** → rubric § "Reviewing an editorial or commentary": argument structure, evidence base, balance, topicality, tone. No methodology questions.
- **5D Methods papers** → rubric § "Reviewing a methods paper": validation, comparison with alternatives, generalizability, reproducibility, failure modes.
- **5E Theoretical papers** → rubric § "Reviewing a theoretical paper": logical coherence, novelty of framing, prior theory engagement, falsifiability, clarity.
- **5F Conference papers** → rubric § "Reviewing a conference paper": community norms, empirical rigor (ablations, error bars, seeds), baseline fairness, compute reporting, code release.
- **5G Replication studies** → rubric § "Reviewing a replication study": protocol fidelity, pre-registration, power, effect size comparison.

Every issue → Major or Minor comment in Sections 3 and 4 of the report.

---

### Phase 6 — Results, discussion, interpretation

Load **`references/review-rubric.md` § "Statistical sanity checks"**, **§ "Title and abstract"**, and **§ "Results, discussion, interpretation"** — three sections only.

- **6.1 Statistical sanity** — internal consistency (abstract/text/tables agree), GRIM test, test-stat ↔ df ↔ p triples, percentages sum to 100, SD bounds, effect size ↔ CI ↔ p consistency, sample size flow.
- **6.2 Title & abstract** — stand-alone test, key numbers present, title type fit to journal, hedging calibration, consistency with main text.
- **6.3 Result-claim alignment** — effect size vs. significance, CI width, subgroup pre-specification, causation language.
- **6.4 Discussion** — honest limitations, alternative interpretations, cherry-picked comparisons with prior work (verify with Consensus), null results acknowledged, speculation vs. conclusion.
- **6.5 Figures & tables** — match text claims, visualization fairness, numbers consistent, format conventions (risk tables, ROC baselines, forest plot heterogeneity).

---

### Phase 7 — Journal fit assessment

Drawing on the Phase 1 profile:

- **7.1 Scope fit** — does the manuscript fall within the journal's stated aims and scope? Quote/paraphrase and link the scope statement.
- **7.2 Novelty calibration** — compare against the recent-papers profile. Name 2–3 comparators. Verdict: bar met / below (reframe or alternative venue) / above (paper is undersold).
- **7.3 Style match** — prose style, structure, tone, length vs. journal norms. Concrete mismatches only.
- **7.4 Required-but-missing items** — **load `references/journal-fit-checklist.md` now** (only at this step). Cross-reference journal guidelines against what's present. List every missing or non-compliant item with one-line action.
- **7.5 Alternative venues** (only if recommending a venue change) — name 2–3 candidates with one-line rationale each.

---

### Phase 8 — Synthesize, self-check, write

**Load `references/report-template.md` now** (only at this step, when generating the .docx).

**Recommendation options:** Ready to submit · Major revision needed · Substantial rework recommended · Consider alternative venue.

**8.1 Fatal flaw check** — before settling on the recommendation, check for issues revision can't fix: design fundamentally cannot answer the research question; sample fundamentally inappropriate; irrecoverable data integrity issues; unfalsifiable claims; ethical issues with the research itself. If present, recommendation is "Substantial rework" with a clear statement of what's salvageable. See **`references/review-rubric.md` § "Recognizing fatal flaws"**. Do not dress up a fatal flaw as "major revision."

**8.2 Self-check before generating .docx:**
- Major comments contradict each other? Fix.
- More than 7–8 Major comments? Recheck severity — likely over-flagging.
- Recommendation matches comment count and severity?
- Each Major comment is answerable point-by-point in a response letter?
- Each Major comment names a specific section/page/line?
- Severity register matches the author's dial (Gentle/Standard/Harsh)?
- No missing-citation flags for papers post-dating the last revision?
- No fabricated citations, paper titles, or guideline requirements?

---

## Output structure

Use `docx` skill (`/mnt/skills/public/docx/SKILL.md`). Sections:

1. Header — title, target journal, article type, date, reviewer note (simulated review disclaimer)
2. Summary of the manuscript — one paragraph; faithful, no critique
3. Overall assessment — strengths, high-level concerns, headline recommendation
4. Major comments — numbered; bold title + explanation with location + suggested action
5. Minor comments — numbered; one to three sentences each with location
6. Reporting-standard compliance — EQUATOR table, or general rigor table if non-EQUATOR
7. Literature audit — field context, novelty assessment per claim, citation gaps, spot-checks; Consensus URLs as hyperlinks
8. Journal-specific assessment — scope fit, novelty calibration with named comparators, style match, required-but-missing items table, alternative venues if applicable
9. Recommendation — one-line bold verdict + 1–2 paragraph rationale calibrated to the journal
10. Audit log — manuscript details, journal sources fetched, Consensus search table, coverage notes, limitations

Tone: firm but collegial. Major comments: 5–10. Minor comments: 10–20.

## Final checklist

- [ ] Every Major comment names a location and gives an answerable suggested action
- [ ] ≤7–8 Major comments unless genuinely warranted
- [ ] Every Consensus citation has the actual URL from this session
- [ ] Every guideline reference points to the actual page fetched
- [ ] No missing-citation flags for post-revision papers
- [ ] Severity register matches author's dial
- [ ] Recommendation consistent with comments
- [ ] Statistical sanity checks done
- [ ] Integrity red flags framed as "please verify"
- [ ] No fabricated titles, authors, DOIs, or requirements
- [ ] Validate: `python /mnt/skills/public/docx/scripts/office/validate.py <output>.docx`

Save to `/mnt/user-data/outputs/` and present.

---

## Reference file load map — follow this strictly

Load reference files **only when indicated below**. Never load all four upfront.

| File | Load when | Load what |
|---|---|---|
| `references/reporting-standards.md` | Phase 2.1 only, if EQUATOR applies | Only the section for the matched standard (e.g., § "CONSORT") — not the whole file |
| `references/review-rubric.md` | Phase 3 (§ "Desk check" + § "Research integrity red flags") · Phase 5 (only the section matching manuscript type) · Phase 6 (§ "Statistical sanity checks" + § "Title and abstract" + § "Results, discussion, interpretation") · Phase 8.1 (§ "Recognizing fatal flaws") | One section at a time as each phase is reached |
| `references/journal-fit-checklist.md` | Phase 7.4 only, after journal guidelines are fetched | Full file (it's a single cross-reference table) |
| `references/report-template.md` | Phase 8 only, when generating the .docx | Full file |
