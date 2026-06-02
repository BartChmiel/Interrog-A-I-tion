"""Command-line entrypoints for the research prototype."""

from __future__ import annotations

import argparse
from pathlib import Path

from interrogaition.analysis.credibility_indicators import generate_indicators
from interrogaition.analysis.interview_review import review_case
from interrogaition.export.integrity_manifest import (
    create_export_manifest,
    read_export_manifest,
    verify_export_manifest,
    write_export_manifest,
)
from interrogaition.export.markdown_report import render_review_markdown
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
    verify_parser = subparsers.add_parser(
        "verify-export",
        help="Verify an export integrity manifest.",
    )
    verify_parser.add_argument("manifest_path", type=Path)
    verify_parser.add_argument(
        "--root",
        type=Path,
        help="Export root directory. Defaults to the manifest parent directory.",
    )

    args = parser.parse_args()

    if args.command == "review":
        case = load_case_from_json(args.case_path, locale=args.locale)
        review = review_case(case)
        indicators = generate_indicators(case, review)
        report = render_review_markdown(case, review, locale=args.locale, indicators=indicators)
        if args.manifest and not args.output:
            parser.error("--manifest requires --output.")

        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(report, encoding="utf-8")
            if args.manifest:
                manifest = create_export_manifest(
                    case_id=case.id,
                    created_by=args.created_by,
                    files=(args.output,),
                    root_path=args.output.parent,
                )
                write_export_manifest(args.manifest, manifest)
        else:
            print(report, end="")
        return 0

    if args.command == "verify-export":
        manifest = read_export_manifest(args.manifest_path)
        verification = verify_export_manifest(
            manifest,
            root_path=args.root or args.manifest_path.parent,
        )
        if verification.verified:
            print("Export integrity verified.")
            return 0

        print("Export integrity verification failed.")
        if not verification.manifest_hash_valid:
            print("- manifest hash mismatch")
        for path in verification.missing_files:
            print(f"- missing file: {path}")
        for path in verification.changed_files:
            print(f"- changed file: {path}")
        for error in verification.unexpected_errors:
            print(f"- error: {error}")
        return 1

    parser.error(f"Unknown command: {args.command}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
