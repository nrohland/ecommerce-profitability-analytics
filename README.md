# Ecommerce Profitability Analytics

A lightweight portfolio project that simulates the analytical model behind a US
Amazon/DTC brand and presents it as a polished profitability command center. It is
designed for realistic profitability, advertising, customer-cohort and Subscribe &
Save analysis—not as a schema reproduction of any commercial platform.

## What is included

- deterministic Python generator for 24 months (2024–2025)
- 12 SKUs across six categories and synthetic customers with no PII
- normalized Parquet dimensions and facts
- a local DuckDB database with reusable semantic views
- a responsive Next.js and Recharts analytical dashboard
- a deterministic conversational-analytics demo with visible read-only SQL
- automated contract, reconciliation and business-story checks
- metric and field documentation

The generator embeds non-random patterns around product economics, refunds,
seasonality, retail events, acquisition quality, subscription retention, coupons,
advertising saturation and smaller operational anomalies. The exact analytical
answers are intentionally left for exploration.

## Architecture

```text
scripts/generate_data.py
        │
        ├── data/generated/*.parquet   (durable atomic datasets)
        │
        └── data/ecommerce.duckdb
                ├── raw.*              (thin Parquet views)
                └── analytics.*        (shared metric views)
                         │
                         ▼
            public/data/dashboard.json
                         │
                         ▼
               Next.js + Recharts
```

The export script queries `analytics.*`, so the dashboard inherits definitions from
`sql/metrics/semantic_views.sql` and `docs/metrics.md` instead of recreating business
logic in React. The static JSON makes the portfolio easy to deploy without a
server-side DuckDB runtime.

## Generate and validate

Requires Python 3.10+.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python scripts/generate_data.py
python scripts/validate_data.py
python scripts/export_dashboard_data.py
npm install
npm run dev
```

Regeneration is idempotent and uses seed `20240916`. Override configuration with
`--seed`, `--start-date`, `--end-date`, `--output-dir`, and `--database`. The intended
story validations assume the default 24-month window.

Run the test wrapper with:

```bash
python -m unittest discover -s tests
```

Explore locally:

```bash
duckdb data/ecommerce.duckdb
```

Then try the queries in `sql/marts/example_queries.sql`, or inspect available views:

```sql
SHOW ALL TABLES;
SELECT * FROM analytics.daily_business_metrics ORDER BY date_day DESC LIMIT 10;
```

## Repository map

- `data/generated/`: one Parquet file per dimension/fact (generated, not committed)
- `scripts/generate_data.py`: model and deterministic simulation
- `scripts/validate_data.py`: automated data and scenario validation
- `scripts/export_dashboard_data.py`: static frontend dataset built from semantic views
- `app/` and `components/`: responsive Next.js dashboard
- `components/ai-analyst.tsx`: simulated AI analyst and recommended next steps
- `src/analytics/initialize_database.py`: DuckDB initialization
- `sql/metrics/semantic_views.sql`: executable metric layer
- `sql/marts/example_queries.sql`: starter analytical questions
- `docs/data_dictionary.md`: tables, grains and fields
- `docs/metrics.md`: formulas and aggregation rules
- `tests/`: repeatable validation entry point

## Deploy for free

The committed frontend is self-contained: it reads the generated snapshot in
`public/data/dashboard.json`, so a deployment does not need Python, DuckDB,
environment variables or paid infrastructure.

1. Push the repository to GitHub.
2. In Vercel, choose **Add New → Project** and import the GitHub repository.
3. Keep the detected **Next.js** defaults and deploy.

Vercel will create a preview URL, serve the site over HTTPS and redeploy every
time the production branch is pushed. The Hobby plan is suitable for this
personal, non-commercial portfolio demo.

## Scope and limitations

The AI analyst is a deterministic product simulation rather than a production LLM
integration. The project intentionally has no orchestration, dbt, container or
cloud warehouse. Ad attribution is synthetic and last-touch-like; it is not an
incrementality model. Customer identities, marketplace operations and daily
reporting are simplified for interview-scale analysis.
