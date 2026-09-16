#!/usr/bin/env python3
"""Create DuckDB raw views over Parquet and shared semantic metric views."""

from __future__ import annotations

import argparse
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[2]


def initialize_database(parquet_dir: Path, database_path: Path) -> None:
    parquet_dir = parquet_dir.resolve()
    database_path = database_path.resolve()
    database_path.parent.mkdir(parents=True, exist_ok=True)
    conn = duckdb.connect(str(database_path))
    try:
        conn.execute("CREATE SCHEMA IF NOT EXISTS raw")
        conn.execute("CREATE SCHEMA IF NOT EXISTS analytics")
        for path in sorted(parquet_dir.glob("*.parquet")):
            table = path.stem
            parquet_path = path.as_posix().replace("'", "''")
            conn.execute(f"CREATE OR REPLACE VIEW raw.{table} AS SELECT * FROM read_parquet('{parquet_path}')")
        metric_sql = (ROOT / "sql" / "metrics" / "semantic_views.sql").read_text()
        conn.execute(metric_sql)
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--parquet-dir", type=Path, default=ROOT / "data" / "generated")
    parser.add_argument("--database", type=Path, default=ROOT / "data" / "ecommerce.duckdb")
    args = parser.parse_args()
    initialize_database(args.parquet_dir, args.database)
    print(f"Initialized {args.database}")


if __name__ == "__main__":
    main()

