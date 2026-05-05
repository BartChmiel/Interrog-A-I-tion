"""Command-line entrypoints for the research prototype."""

from __future__ import annotations

import argparse
from pathlib import Path

from interigaition.analysis.interview_review import review_case
from interigaition.export.markdown_report import render_review_markdown
from interigaition.storage.json_case_loader import load_case_from_json


def main() -> int:
    parser = argparse.ArgumentParser(
        prog="interigaition",
        description="Local AI-assisted investigative interviewing research prototype.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    review_parser = subparsers.add_parser("review", help="Review a synthetic case JSON file.")
    review_parser.add_argument("case_path", type=Path)
    review_parser.add_argument(
        "--locale",
        default="en",
        choices=("en", "pl"),
        help="Language pack used for the generated report.",
    )

    args = parser.parse_args()

    if args.command == "review":
        case = load_case_from_json(args.case_path, locale=args.locale)
        review = review_case(case)
        print(render_review_markdown(case, review, locale=args.locale), end="")
        return 0

    parser.error(f"Unknown command: {args.command}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
