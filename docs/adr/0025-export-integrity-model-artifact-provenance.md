# ADR 0025: Export Integrity Model Artifact Provenance

## Status

Accepted.

## Context

ADR 0010 introduced export integrity manifests for report files. ADR 0024 added
hash-chained model artifact manifests inside each case workspace. The remaining gap was
that an exported report could be verified as a file, but the model provenance behind
AI-assisted suggestions was not referenced by the export integrity layer.

The system should support a defensible chain from exported report to local AI provenance
without copying sensitive model artifacts into every export directory.

## Decision

Export integrity manifests now use schema v2 and can optionally include a
`model_artifacts` reference. The reference records:

- workspace id,
- relative path of `models/artifact-manifest.json`,
- SHA-256 of the artifact manifest file,
- artifact manifest record count,
- artifact manifest `chain_valid` value,
- latest model artifact record hash,
- compact records for each model artifact: artifact id, type, relative path, file hash,
  size, and record hash.

The CLI can include this provenance with:

```text
python -m interrogaition.cli review <case_path> --output <report.md> --manifest <manifest.json> --workspace-root <workspace_root> --include-model-artifacts
```

Verification can check both exported files and workspace model artifacts with:

```text
python -m interrogaition.cli verify-export <manifest.json> --root <export_root> --workspace-root <workspace_root>
```

If a manifest contains model artifact references, verification requires
`workspace_root_path`. Without it, verification fails explicitly instead of silently
downgrading to file-only verification.

## Consequences

The export layer can now verify:

- exported report file hashes,
- export manifest payload hash,
- model artifact manifest file hash,
- model artifact manifest chain validity,
- referenced model artifact file hashes and sizes.

This does not copy model artifacts into exports and does not replace signatures, trusted
timestamps, encryption, or formal chain-of-custody controls. It creates a testable local
integrity bridge between report exports and AI provenance.

Existing schema v1 export manifests remain readable and verifiable. New manifests are
written as schema v2.

## Follow-up

- Decide whether AI-assisted exports must always include model artifact references.
- Decide whether export manifests should include audit event snapshots.
- Decide whether export manifests should be digitally signed or timestamped.
- Decide whether the frontend should expose export/provenance controls before packaging.
