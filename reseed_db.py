#!/usr/bin/env python3
"""One-click CSV -> DB reseed launcher."""

from __future__ import annotations

import os
import sys
from pathlib import Path


def main() -> int:
    root = Path(__file__).resolve().parent
    backend_dir = root / "backend"
    sys.path.insert(0, str(backend_dir))
    os.chdir(backend_dir)

    from reseed_from_csv import main as reseed_main

    return reseed_main()


if __name__ == "__main__":
    raise SystemExit(main())
