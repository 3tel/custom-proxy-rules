from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .compiler import Compiler
from .parser import RuleParseError


def make_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Build custom proxy routing rules")
    parser.add_argument("--root", type=Path, default=Path.cwd(), help="project root")
    parser.add_argument("--no-fetch", action="store_true", help="only compile local files")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = make_parser().parse_args(argv)
    try:
        report = Compiler(args.root.resolve()).build(fetch=not args.no_fetch)
    except (OSError, ValueError, RuleParseError) as exc:
        print(f"build failed: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(report["counts"], ensure_ascii=False))
    print(f"conflicts: {report['conflict_count']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

