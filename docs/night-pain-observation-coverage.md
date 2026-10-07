# Night-pain observation coverage

The existing `夜间痛 / night pain` choice reports pain timing. Severity, onset, location and accompanying signs remain separate observations. Its position in the timing group must not require an extra pain-quality checkbox where an independently reviewed safety predicate already requires reported pain.

This inventory records the named consumers reviewed so far. It is a software and source-review record, not clinical validation or a completeness claim for every possible presentation. Detailed source limits are in the [evidence ledger](../data/evidence-review-2026-10.json).

| Consumer | Current treatment of night pain | Scope and regression reference |
| --- | --- | --- |
| `neck-back-pain-fever`, `neck-back-weight-change-review` | Supplies their existing neck/back pain premise | Fever/chills or unintentional weight change remain required. See the [reported-observation](../tests/reported-observation-facts.test.mjs) and [neuro/MSK](../tests/literature-neuro-msk.test.mjs) tests. |
| `headache-systemic-progressive`, `headache-neurological-change`, head clause of `sudden-motor-or-head-neurological-change` | Supplies their existing head pain premise | Associated findings and explicit sudden onset remain unchanged. Independent sudden motor loss does not need head pain. Ledger: `head-night-pain-fact`; [tests](../tests/head-night-pain.test.mjs). |
| Core chest warning branches | Supplies pain in the reviewed chest combinations | Associated danger signs, or explicit sudden **and** persistent onset, remain required. Night pain does not establish pressure or severity. [Regional tests](../tests/regional-night-pain.test.mjs). |
| Core pregnancy/RLQ/flank and literature RUQ/LUQ/upper-abdominal warning branches | Supplies pain in the reviewed regional combinations | Preserve each branch's actual or reference-location policy and all accompanying observations. Unknown location cannot become a confirmed quadrant. Ledger: `regional-night-pain-fact`; [regional tests](../tests/regional-night-pain.test.mjs). |
| `dental-infection-review`, `painful-gum-swelling-review` | Explicitly included in the reviewed dental pain observations | Existing tooth/jaw, fever/chills or gum-swelling requirements remain. Existing dental reference criteria are unchanged. See the [dental observation](../tests/literature-dental-ent-skin.test.mjs) and [painful-gum-swelling](../tests/painful-gum-swelling.test.mjs) tests. |
| `eye-injury-review` | Supplies the existing eye discomfort/pain premise | Eye region and reported injury are required. It does not prove severe pain, duration of 24 hours or a penetrating/globe injury. Ledger: `eye-injury-night-pain-fact`; [tests](../tests/remaining-night-pain.test.mjs). |
| `exercise-muscle-urine-warning` | Supplies the existing local/limb pain premise | Retains the region, exercise/delayed soreness, dark urine and weakness/swelling/worsening requirements. Missing the combination does not exclude disease. Ledger: `exercise-night-pain-fact`; [tests](../tests/remaining-night-pain.test.mjs). |
| Existing injury-related neck/back basic fallback | Recognizes reported night pain alongside injury/twisting history | Reuses the neutral injury-related basic direction; adds no diagnosis or triage level. See the [reported-observation tests](../tests/reported-observation-facts.test.mjs). |

## Deliberately retained boundaries

- `PAIN_TAGS`, `LOCAL_PAIN_TAGS`, `REPORTED_PAIN_TAGS` and `RULE_PAIN_TAGS` are not expanded globally by these changes. The regional/predicate checks above are explicit.
- Night pain remains in the existing `spontaneous` evidence family. No generic `疼痛` token is inserted. Existing dedicated uses of night pain in reference criteria remain unchanged; it is not newly added to every disease's pain gate.
- Other uses of `hasReportedPain`, including basic routing alongside remote biting/shoulder observations, retain their existing behavior. This table does not certify those combinations or authorize a blanket replacement.
- Neither a selected anatomy structure nor its left/right name establishes the affected tissue, symptom laterality, a diagnosis, a normal examination or the absence of unselected warning signs.

## Maintaining the inventory

For a newly discovered consumer, first verify a real full/mobile mesh and field-visible input sequence. Review that consumer's source and preconditions separately. Add a minimal positive and adjacent negative source case, and an appropriate production-build parity fixture. Reuse or deduplicate existing cases; test totals are not measures of medical accuracy. Record whether a case is API-only rather than representing a current UI route.

Do not infer approval for a new predicate or a new urgency rule from another row of this table. Preserve all original requirements unless a separately reviewed change explicitly alters them.
