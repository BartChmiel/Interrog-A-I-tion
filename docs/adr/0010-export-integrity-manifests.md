# ADR 0010: Export Integrity Manifests

## Status

Accepted.

## Context

The prototype can generate Markdown reports and now has per-case workspace boundaries. Before adding official-looking exports, the project needs a small, testable integrity mechanism for exported artifacts.

This is not a legal evidentiary seal and not a digital signature. It is a prototype integrity layer that helps demonstrate whether exported files changed after generation.

## Decision

Add export integrity manifests.

The manifest records:

- export id,
- case id,
- creator id,
- creation timestamp,
- exported file paths,
- file sizes,
- SHA-256 hashes for exported files,
- a SHA-256 hash of the canonical manifest payload.

The CLI can now write a Markdown report and a manifest with:

```text
python -m interrogaition.cli review <case_path> --output <report.md> --manifest <manifest.json>
```

It can verify the manifest with:

```text
python -m interrogaition.cli verify-export <manifest.json> --root <export_root>
```

## Consequences

- Export integrity is demonstrable without changing the report format.
- File tampering and manifest-payload tampering are testable.
- This does not replace signed exports, trusted timestamps, chain-of-custody procedures, or legal review.
- Official-looking exports remain behind a future STOP gate.
