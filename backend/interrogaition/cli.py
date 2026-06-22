"""Command-line entrypoints for the research prototype."""

from __future__ import annotations

import argparse
from pathlib import Path

from interrogaition.analysis.credibility_indicators import generate_indicators
from interrogaition.analysis.interview_review import review_case
from interrogaition.export.integrity_manifest import (
    create_export_manifest,
    create_model_artifact_manifest_reference,
    read_export_manifest,
    sha256_file,
    verify_export_bundle_zip,
    verify_export_manifest,
    write_export_manifest,
)
from interrogaition.export.markdown_report import render_review_markdown
from interrogaition.security.case_workspace import CaseWorkspaceManager
from interrogaition.storage.json_case_loader import load_case_from_json


def main() -> int:
    parser = argparse.ArgumentParser(
        prog="interrogaition",
        description="Local AI-assisted investigative interviewing research prototype.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    review_parser = subparsers.add_parser("review", help="Review a synthetic case JSON file.")
    review_parser.add_argument("case_path", type=Path)
    review_parser.add_argument(
        "--output",
        type=Path,
        help="Write the generated Markdown report to this path instead of stdout.",
    )
    review_parser.add_argument(
        "--manifest",
        type=Path,
        help="Write an export integrity manifest for the output report.",
    )
    review_parser.add_argument(
        "--created-by",
        default="local-cli",
        help="Actor id stored in the export integrity manifest.",
    )
    review_parser.add_argument(
        "--locale",
        default="en",
        choices=("en", "pl"),
        help="Language pack used for the generated report.",
    )
    review_parser.add_argument(
        "--workspace-root",
        type=Path,
        help="Workspace root used for model artifact export references.",
    )
    review_parser.add_argument(
        "--include-model-artifacts",
        action="store_true",
        help="Include the workspace model artifact manifest in the export integrity manifest.",
    )
    verify_parser = subparsers.add_parser(
        "verify-export",
        help="Verify an export integrity manifest.",
    )
    verify_parser.add_argument("manifest_path", type=Path)
    verify_parser.add_argument(
        "--bundle",
        action="store_true",
        help="Treat manifest_path as a downloaded ZIP export bundle containing manifest.json.",
    )
    verify_parser.add_argument(
        "--root",
        type=Path,
        help="Export root directory. Defaults to the manifest parent directory.",
    )
    verify_parser.add_argument(
        "--workspace-root",
        type=Path,
        help="Workspace root used to verify model artifact references.",
    )
    verify_parser.add_argument(
        "--expected-sha256",
        help="Expected SHA-256 of the manifest or ZIP file being verified.",
    )

    args = parser.parse_args()

    if args.command == "review":
        case = load_case_from_json(args.case_path, locale=args.locale)
        review = review_case(case)
        indicators = generate_indicators(case, review)
        report = render_review_markdown(case, review, locale=args.locale, indicators=indicators)
        if args.manifest and not args.output:
            parser.error("--manifest requires --output.")
        if args.include_model_artifacts and not args.workspace_root:
            parser.error("--include-model-artifacts requires --workspace-root.")

        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(report, encoding="utf-8")
            if args.manifest:
                model_artifacts = None
                if args.include_model_artifacts:
                    workspace = _open_workspace_root(args.workspace_root)
                    model_artifacts = create_model_artifact_manifest_reference(workspace)
                manifest = create_export_manifest(
                    case_id=case.id,
                    created_by=args.created_by,
                    files=(args.output,),
                    root_path=args.output.parent,
                    model_artifacts=model_artifacts,
                )
                write_export_manifest(args.manifest, manifest)
        else:
            print(report, end="")
        return 0

    if args.command == "verify-export":
        if args.bundle:
            verification = verify_export_bundle_zip(
                args.manifest_path,
                workspace_root_path=args.workspace_root,
            )
            success_message = "Export bundle integrity verified."
            failure_message = "Export bundle integrity verification failed."
        else:
            manifest = read_export_manifest(args.manifest_path)
            verification = verify_export_manifest(
                manifest,
                root_path=args.root or args.manifest_path.parent,
                workspace_root_path=args.workspace_root,
            )
            success_message = "Export integrity verified."
            failure_message = "Export integrity verification failed."
        sha256_valid, sha256_error = _verify_expected_sha256(
            args.manifest_path,
            expected_sha256=args.expected_sha256,
        )
        if verification.verified and sha256_valid:
            print(success_message)
            return 0

        print(failure_message)
        _print_verification_failure_details(verification)
        if sha256_error:
            print(sha256_error)
        return 1

    parser.error(f"Unknown command: {args.command}")
    return 2


def _open_workspace_root(workspace_root: Path):
    resolved = workspace_root.resolve()
    return CaseWorkspaceManager(resolved.parent).open_workspace(resolved.name)


def _print_verification_failure_details(verification) -> None:
    if not verification.manifest_hash_valid:
        print("- manifest hash mismatch")
    if not verification.model_artifact_manifest_hash_valid:
        print("- model artifact manifest hash mismatch")
    if not verification.model_artifact_chain_valid:
        print("- model artifact manifest chain invalid")
    for path in verification.missing_files:
        print(f"- missing file: {path}")
    for path in verification.changed_files:
        print(f"- changed file: {path}")
    for path in verification.missing_model_artifact_files:
        print(f"- missing model artifact file: {path}")
    for path in verification.changed_model_artifact_files:
        print(f"- changed model artifact file: {path}")
    for error in verification.unexpected_errors:
        print(f"- error: {error}")


def _verify_expected_sha256(path: Path, *, expected_sha256: str | None) -> tuple[bool, str | None]:
    if not expected_sha256:
        return True, None

    expected = expected_sha256.strip().lower()
    try:
        actual = sha256_file(path).lower()
    except OSError as exc:
        return False, f"- sha256 check failed: {exc}"

    if actual == expected:
        return True, None

    return False, f"- sha256 mismatch: expected {expected}, actual {actual}"


if __name__ == "__main__":
    raise SystemExit(main())
