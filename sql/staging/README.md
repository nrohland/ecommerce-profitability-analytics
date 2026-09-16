# Staging

DuckDB raw views are created programmatically by `src/analytics/initialize_database.py`
because the absolute Parquet path is environment-specific. They are deliberately
thin: each view exposes one Parquet file without business logic.

