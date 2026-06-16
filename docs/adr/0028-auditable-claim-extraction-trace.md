# ADR 0028: Auditable claim extraction trace

## Status

Accepted.

## Context

Live answers can now produce structured claims automatically, and those claims wait for
human review before they influence deterministic analysis. That solves the control
problem, but it leaves a backend provenance gap: a reviewer can see the extracted claim,
but not which deterministic rule produced it, how strong the match was, or where in the
answer text the rule fired.

For an investigative interviewing prototype, this matters more than recall. Extracted
claims must be explainable, bounded, and easy to audit.

## Decision

Add extraction trace fields directly to the `Claim` model:

- `extraction_rule`
- `extraction_hash`
- `confidence`
- `source_start`
- `source_end`

The deterministic extractor now populates those fields for live-answer claims. Manual
and legacy claims keep empty/null defaults.

`extraction_hash` is a canonical SHA-256 hash of the original deterministic claim
candidate payload. The payload includes the schema version, case id, question id,
answer id, answer text hash, extraction rule, candidate subject/attribute/value,
source text, confidence, and source span.

SQLite stores the trace fields with backward-compatible migrations. JSON case loading
accepts the fields when present. Session answer audit events include an `extraction_trace`
snapshot for automatically extracted claims, and claim review audit snapshots preserve
the trace before and after human decisions.

The API also exposes `GET /sessions/{session_id}/claim-provenance`. The report compares
current extracted claims with their `answer_added` audit snapshots, validates extraction
hash shape, checks trace fields, and reports whether each claim is still backed by the
hash-chained audit record. Edited claims may change human-reviewed content while preserving
the original extraction hash.

## Consequences

- Operators and future exports can reconstruct why a claim candidate exists.
- Human edits do not erase the original extraction provenance.
- Auditors can compare extraction hashes across API responses, storage, and audit events.
- Backend consumers can ask for a session-level provenance report instead of rebuilding
  trace comparisons ad hoc.
- The trace remains deterministic and local; it does not rely on a model runtime.
- Confidence is a rule confidence, not a truthfulness score.
- Character spans are advisory offsets into the submitted answer text and should be
  treated as extraction provenance, not evidentiary proof.
- If a human edits a claim, the extraction hash continues to identify the original
  machine-generated candidate rather than the edited human assertion.
