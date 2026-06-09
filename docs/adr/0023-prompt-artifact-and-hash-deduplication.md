# ADR 0023: Prompt Artifact Capture and Hash Deduplication

## Status

Accepted.

## Context

ADR 0022 connected grounded suggestions to workspace-local `context` and `output`
artifacts. That improved provenance, but it still left one important gap: the exact
prompt request that drove the model call was not persisted as a first-class artifact.

For forensic, scientific, and thesis-review purposes, the system should be able to
reconstruct the complete advisory model-call chain:

1. rendered prompt request,
2. grounding context pack,
3. raw model output,
4. parsed suggestions and citation warnings,
5. human decision audit event.

Repeated deterministic refreshes can produce identical artifacts. Without deduplication,
the prototype would create redundant records that make audit review noisier without adding
evidentiary value.

## Decision

Grounded suggestion generation now captures three workspace-local artifacts when model
artifact isolation is ready:

- `prompt`: JSON containing prompt schema, prompt version, context hash, system prompt,
  user prompt, temperature, and response format,
- `context`: the grounding context pack used for the call,
- `output`: the raw JSON model response text.

The response and `grounded_suggestions_generated` audit event include:

- `prompt_hash`, `context_hash`, and `output_hash`,
- prompt/context/output artifact ids,
- prompt/context/output artifact SHA-256 values,
- prompt/context/output artifact deduplication flags.

Model artifact writes are deduplicated by `artifact_type` plus SHA-256. If the same
artifact type and byte-identical content already exist in the workspace manifest, the
writer returns the existing record with `deduplicated=true` and does not write another
file or append another manifest record.

Human grounded-suggestion decisions also preserve `prompt_hash` alongside the existing
model id, prompt version, context hash, and output hash.

## Consequences

The grounded suggestion provenance chain is now stronger and less noisy:

- investigators can see that a suggestion came from a specific prompt/context/output trio,
- repeated deterministic refreshes reuse the same artifact records,
- audit events still show that a generation occurred, even when artifact files were reused,
- tests remain deterministic and do not require Ollama.

Deduplication is deliberately conservative. The same SHA-256 is only reused within the same
artifact type, so a prompt, context, and output cannot accidentally collapse into one record
even if their bytes somehow match.

Export integrity manifests can include model artifact provenance references as of ADR 0025.

## Follow-up

- Decide whether artifact capture should become mandatory before any real local model call.
- Artifact manifests were hash-chained later by ADR 0024.
- Model artifact provenance references were added to export integrity manifests by ADR 0025.
- Decide whether the UI should expose deduplication status in a dedicated provenance view.
