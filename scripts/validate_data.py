#!/usr/bin/env python3
"""Validate data contracts and prove the intended synthetic business patterns."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[1]


@dataclass
class Check:
    name: str
    sql: str
    message: str


CHECKS = [
    Check("24_month_coverage", "SELECT MIN(date_day) = DATE '2024-01-01' AND MAX(date_day) = DATE '2025-12-31' FROM raw.dim_calendar", "calendar covers exactly 24 full months"),
    Check("unique_order_ids", "SELECT COUNT(*) = COUNT(DISTINCT order_id) FROM raw.fact_orders", "order IDs are unique"),
    Check("unique_item_ids", "SELECT COUNT(*) = COUNT(DISTINCT order_item_id) FROM raw.fact_order_items", "order item IDs are unique"),
    Check("valid_item_orders", "SELECT COUNT(*) = 0 FROM raw.fact_order_items i LEFT JOIN raw.fact_orders o USING(order_id) WHERE o.order_id IS NULL", "every item has a parent order"),
    Check("valid_order_customers", "SELECT COUNT(*) = 0 FROM raw.fact_orders o LEFT JOIN raw.dim_customers c USING(customer_id) WHERE c.customer_id IS NULL", "every order has a customer"),
    Check("order_reconciliation", "WITH i AS (SELECT order_id, ROUND(SUM(gross_revenue),2) g, ROUND(SUM(discount_amount),2) d, ROUND(SUM(coupon_amount),2) c, SUM(quantity) u FROM raw.fact_order_items GROUP BY 1) SELECT COUNT(*)=0 FROM raw.fact_orders o JOIN i USING(order_id) WHERE o.gross_revenue<>i.g OR o.discounts<>i.d OR o.coupons<>i.c OR o.units<>i.u", "order headers reconcile to items"),
    Check("subscriber_ltv90", "SELECT AVG(ltv_90d) FILTER (WHERE customer_type='subscriber') > AVG(ltv_90d) FILTER (WHERE customer_type='one_time') FROM analytics.customer_value", "subscriber 90-day LTV exceeds one-time LTV"),
    Check("subscriber_repeat", "SELECT AVG(is_repeat_customer::INT) FILTER (WHERE customer_type='subscriber') > AVG(is_repeat_customer::INT) FILTER (WHERE customer_type='one_time') FROM analytics.customer_value", "subscribers repeat more often"),
    Check("prime_quality", "SELECT AVG(is_repeat_customer::INT) FILTER (WHERE acquisition_event LIKE 'Prime Day%') < AVG(is_repeat_customer::INT) FILTER (WHERE acquisition_event IS NULL) FROM analytics.customer_value", "Prime Day cohorts retain worse than normal cohorts"),
    Check("refund_problem", "WITH r AS (SELECT product_id, SUM(refunds)/NULLIF(SUM(gross_revenue),0) rr FROM analytics.order_item_economics WHERE order_date >= DATE '2025-07-01' GROUP BY 1) SELECT (SELECT rr FROM r WHERE product_id='P005') > 2 * (SELECT SUM(refunds)/SUM(gross_revenue) FROM analytics.order_item_economics WHERE order_date >= DATE '2025-07-01')", "the problem SKU has an elevated refund rate"),
    Check("hero_revenue_margin", "WITH p AS (SELECT product_id, SUM(gross_revenue) rev, SUM(contribution_profit)/NULLIF(SUM(net_revenue),0) margin, DENSE_RANK() OVER (ORDER BY SUM(gross_revenue) DESC) rnk FROM analytics.product_daily_metrics GROUP BY 1), portfolio AS (SELECT SUM(contribution_profit)/SUM(net_revenue) margin FROM analytics.product_daily_metrics) SELECT rnk <= 2 AND p.margin < portfolio.margin FROM p, portfolio WHERE product_id='P001'", "the hero SKU is top revenue but below portfolio margin"),
    Check("diminishing_returns", "WITH x AS (SELECT AVG(new_customer_cac) FILTER (WHERE ad_spend BETWEEN 4000 AND 6000) moderate, AVG(new_customer_cac) FILTER (WHERE ad_spend > 8500) high FROM analytics.campaign_weekly_metrics WHERE campaign_id='C001') SELECT high > moderate * 1.30 FROM x", "CAC deteriorates above the hero campaign spend threshold"),
    Check("cheap_cac_poor_quality", "WITH c AS (SELECT * FROM analytics.acquisition_campaign_metrics) SELECT (SELECT cac FROM c WHERE campaign_id='C003') < (SELECT cac FROM c WHERE campaign_id='C004') AND (SELECT ltp_to_cac FROM c WHERE campaign_id='C003') < (SELECT ltp_to_cac FROM c WHERE campaign_id='C004')", "cheap prospecting CAC has weaker LTP:CAC than premium search"),
    Check("premium_ltp", "WITH c AS (SELECT * FROM analytics.acquisition_campaign_metrics) SELECT (SELECT ltp FROM c WHERE campaign_id='C004') > (SELECT ltp FROM c WHERE campaign_id='C003') FROM c LIMIT 1", "premium acquisition has higher LTP despite higher CAC"),
    Check("seasonality", "WITH x AS (SELECT AVG(gross_revenue) FILTER (WHERE EXTRACT(month FROM date_day) IN (6,7,8)) summer, AVG(gross_revenue) FILTER (WHERE EXTRACT(month FROM date_day) IN (1,2,3)) winter FROM analytics.product_daily_metrics WHERE product_id IN ('P003','P004')) SELECT summer > winter * 1.45 FROM x", "Hydration has strong summer seasonality"),
    Check("bfcm_margin_compression", "WITH x AS (SELECT AVG(contribution_margin) FILTER (WHERE date_day IN (DATE '2024-11-29',DATE '2024-12-02',DATE '2025-11-28',DATE '2025-12-01')) event_margin, AVG(contribution_margin) FILTER (WHERE EXTRACT(month FROM date_day) IN (10,11,12) AND date_day NOT IN (DATE '2024-11-29',DATE '2024-12-02',DATE '2025-11-28',DATE '2025-12-01')) normal_margin FROM analytics.daily_business_metrics) SELECT event_margin < normal_margin FROM x", "BFCM compresses contribution margin"),
    Check("hero_growth_margin_decline", "WITH y AS (SELECT EXTRACT(year FROM date_day) yr, SUM(gross_revenue) revenue, SUM(contribution_profit)/SUM(net_revenue) margin FROM analytics.product_daily_metrics WHERE product_id='P001' GROUP BY 1) SELECT (SELECT revenue FROM y WHERE yr=2025) > (SELECT revenue FROM y WHERE yr=2024) AND (SELECT margin FROM y WHERE yr=2025) < (SELECT margin FROM y WHERE yr=2024) FROM y LIMIT 1", "hero revenue grows while margin declines"),
    Check("coupon_mixed_economics", "WITH x AS (SELECT acquisition_campaign_id, AVG((customer_type='subscriber')::INT) sub_rate, AVG(lifetime_profit) ltp FROM analytics.customer_value WHERE acquisition_campaign_id IS NOT NULL GROUP BY 1), baseline AS (SELECT AVG((customer_type='subscriber')::INT) sub_rate FROM analytics.customer_value WHERE acquisition_campaign_id IS NOT NULL AND acquisition_campaign_id <> 'C006') SELECT (SELECT sub_rate FROM x WHERE acquisition_campaign_id='C006') > baseline.sub_rate * 1.5 AND (SELECT ltp FROM x WHERE acquisition_campaign_id='C006') < (SELECT ltp FROM x WHERE acquisition_campaign_id='C004') FROM baseline", "the coupon lifts subscription starts but has mixed long-term economics"),
    Check("tracking_anomaly", "WITH w AS (SELECT week_start, new_customer_cac FROM analytics.campaign_weekly_metrics WHERE campaign_id='C003') SELECT (SELECT new_customer_cac FROM w WHERE week_start=DATE '2025-03-03') > 1.7 * (SELECT AVG(new_customer_cac) FROM w WHERE week_start BETWEEN DATE '2025-02-10' AND DATE '2025-03-24' AND week_start<>DATE '2025-03-03')", "tracking anomaly creates a discoverable CAC spike"),
]


def run_validation(database: Path, verbose: bool = True) -> list[str]:
    failures = []
    conn = duckdb.connect(str(database), read_only=True)
    try:
        for check in CHECKS:
            passed = conn.execute(check.sql).fetchone()[0]
            if verbose:
                print(f"{'PASS' if passed else 'FAIL'}  {check.name}: {check.message}")
            if not passed:
                failures.append(check.name)
    finally:
        conn.close()
    return failures


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", type=Path, default=ROOT / "data" / "ecommerce.duckdb")
    args = parser.parse_args()
    failures = run_validation(args.database)
    if failures:
        raise SystemExit(f"Validation failed: {', '.join(failures)}")
    print(f"All {len(CHECKS)} checks passed.")


if __name__ == "__main__":
    main()
