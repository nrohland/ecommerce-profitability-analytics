#!/usr/bin/env python3
"""Export dashboard-ready aggregates from DuckDB to a static JSON payload."""

from __future__ import annotations

import argparse
import json
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[1]


def rows(conn: duckdb.DuckDBPyConnection, sql: str) -> list[dict]:
    result = conn.execute(sql)
    columns = [column[0] for column in result.description]
    return [dict(zip(columns, row)) for row in result.fetchall()]


def json_default(value):
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    raise TypeError(f"Cannot serialize {type(value)}")


def export(database: Path, output: Path) -> None:
    conn = duckdb.connect(str(database), read_only=True)
    try:
        monthly = rows(conn, """
            SELECT DATE_TRUNC('month', date_day) AS month,
                   EXTRACT(year FROM date_day)::INTEGER AS year,
                   SUM(gross_revenue) AS gross_revenue,
                   SUM(net_revenue) AS net_revenue,
                   SUM(contribution_profit) AS contribution_profit,
                   SUM(contribution_profit) / NULLIF(SUM(net_revenue), 0) AS contribution_margin,
                   SUM(ad_spend) AS ad_spend,
                   SUM(refunds) AS refunds,
                   SUM(orders) AS orders,
                   SUM(net_revenue) / NULLIF(SUM(orders), 0) AS aov,
                   SUM(ad_spend) / NULLIF(SUM(gross_revenue), 0) AS tacos
            FROM analytics.daily_business_metrics GROUP BY 1, 2 ORDER BY 1
        """)
        products = rows(conn, """
            WITH annual AS (
              SELECT product_id, EXTRACT(year FROM date_day)::INTEGER AS year,
                     SUM(gross_revenue) AS revenue,
                     SUM(contribution_profit) / NULLIF(SUM(net_revenue), 0) AS margin
              FROM analytics.product_daily_metrics GROUP BY 1, 2
            ), lifetime AS (
              SELECT product_id, SUM(gross_revenue) AS gross_revenue,
                     SUM(net_revenue) AS net_revenue, SUM(contribution_profit) AS contribution_profit,
                     SUM(contribution_profit) / NULLIF(SUM(net_revenue), 0) AS contribution_margin,
                     SUM(refunds) AS refunds, SUM(refunds) / NULLIF(SUM(gross_revenue), 0) AS refund_rate,
                     SUM(ad_spend) AS ad_spend
              FROM analytics.product_daily_metrics GROUP BY 1
            )
            SELECT p.product_id, p.sku, p.product_name, p.category,
                   l.gross_revenue, l.net_revenue, l.contribution_profit, l.contribution_margin,
                   l.refunds, l.refund_rate, l.ad_spend,
                   y25.revenue / NULLIF(y24.revenue, 0) - 1 AS yoy_revenue_growth,
                   y25.margin - y24.margin AS margin_change
            FROM lifetime l JOIN raw.dim_products p USING(product_id)
            LEFT JOIN annual y24 ON l.product_id=y24.product_id AND y24.year=2024
            LEFT JOIN annual y25 ON l.product_id=y25.product_id AND y25.year=2025
            ORDER BY l.gross_revenue DESC
        """)
        customer_segments = rows(conn, """
            SELECT customer_type, COUNT(*) AS customers,
                   AVG(ltv_90d) AS ltv_90d, AVG(lifetime_profit) AS ltp,
                   AVG(lifetime_orders) AS average_orders,
                   AVG(is_repeat_customer::INTEGER) AS repeat_rate
            FROM analytics.customer_value GROUP BY 1 ORDER BY 1
        """)
        channels = rows(conn, """
            SELECT acquisition_channel AS channel, customers, cac, ltv_90d, ltp,
                   repeat_purchase_rate, ltv_to_cac, ltp_to_cac
            FROM analytics.acquisition_channel_metrics ORDER BY ltp_to_cac DESC
        """)
        campaigns = rows(conn, """
            SELECT m.campaign_id, c.campaign_name, c.channel, m.customers, m.cac,
                   m.ltv_90d, m.ltp, m.repeat_purchase_rate, m.ltv_to_cac, m.ltp_to_cac
            FROM analytics.acquisition_campaign_metrics m
            JOIN raw.dim_campaigns c USING(campaign_id)
            ORDER BY m.ltp_to_cac DESC
        """)
        spend_curve = rows(conn, """
            SELECT week_start, ad_spend, new_customers, new_customer_cac, roas
            FROM analytics.campaign_weekly_metrics
            WHERE campaign_id='C001' ORDER BY week_start
        """)
        cohorts = rows(conn, """
            SELECT cohort_month, month_number, retained_customers, cohort_size, retention_rate
            FROM analytics.cohort_monthly_retention
            WHERE cohort_month BETWEEN DATE '2024-01-01' AND DATE '2025-06-01'
              AND month_number BETWEEN 0 AND 5
            ORDER BY cohort_month, month_number
        """)
        events = rows(conn, """
            SELECT event_id, start_date, end_date, event_type, event_name, description
            FROM raw.dim_events ORDER BY start_date
        """)
        snapshot = rows(conn, """
            SELECT SUM(gross_revenue) AS gross_revenue, SUM(net_revenue) AS net_revenue,
                   SUM(contribution_profit) AS contribution_profit,
                   SUM(contribution_profit) / SUM(net_revenue) AS contribution_margin,
                   SUM(orders) AS orders, SUM(units) AS units,
                   SUM(net_revenue) / SUM(orders) AS aov,
                   SUM(ad_spend) / SUM(gross_revenue) AS tacos
            FROM analytics.daily_business_metrics WHERE date_day >= DATE '2025-01-01'
        """)[0]
        payload = {
            "meta": {"brand": "Northstar Nutrition", "period": "2024-01-01 / 2025-12-31", "currency": "USD"},
            "snapshot": snapshot,
            "monthly": monthly,
            "products": products,
            "customerSegments": customer_segments,
            "channels": channels,
            "campaigns": campaigns,
            "spendCurve": spend_curve,
            "cohorts": cohorts,
            "events": events,
        }
    finally:
        conn.close()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, default=json_default, separators=(",", ":")), encoding="utf-8")
    print(f"Exported dashboard data to {output}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", type=Path, default=ROOT / "data" / "ecommerce.duckdb")
    parser.add_argument("--output", type=Path, default=ROOT / "public" / "data" / "dashboard.json")
    args = parser.parse_args()
    export(args.database, args.output)


if __name__ == "__main__":
    main()

