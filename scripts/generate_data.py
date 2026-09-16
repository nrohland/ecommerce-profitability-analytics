#!/usr/bin/env python3
"""Generate a deterministic, story-rich ecommerce dataset and DuckDB database."""

from __future__ import annotations

import argparse
import csv
import math
import random
import sys
import tempfile
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import duckdb  # noqa: E402

from src.analytics.initialize_database import initialize_database  # noqa: E402


PRODUCTS = [
    ("P001", "NTR-PRO-30", "B0NTRPRO30", "Daily Nutrition Pro", "Nutrition", date(2023, 6, 1), 23.00, 39.00),
    ("P002", "NTR-DLY-30", "B0NTRDLY30", "Daily Nutrition", "Nutrition", date(2023, 1, 15), 10.50, 31.00),
    ("P003", "HYD-CIT-20", "B0HYDCIT20", "Hydration Mix Citrus", "Hydration", date(2023, 4, 10), 7.20, 25.00),
    ("P004", "HYD-BRY-20", "B0HYDBRY20", "Hydration Mix Berry", "Hydration", date(2024, 3, 1), 7.50, 25.00),
    ("P005", "BLD-GO-01", "B0BLDGO001", "BlendGo Portable Mixer", "Accessories", date(2023, 9, 5), 14.00, 42.00),
    ("P006", "BLD-CL-01", "B0BLDCL001", "Classic Shaker", "Accessories", date(2023, 1, 1), 4.20, 18.00),
    ("P007", "SLP-BRY-30", "B0SLPBRY30", "Sleep Support Berry", "Wellness", date(2024, 1, 20), 9.80, 32.00),
    ("P008", "IMM-ORG-30", "B0IMMORG30", "Immune Support Orange", "Wellness", date(2023, 10, 1), 8.60, 29.00),
    ("P009", "ENR-LMN-24", "B0ENRLMN24", "Energy Lift Lemon", "Energy", date(2023, 5, 12), 8.10, 28.00),
    ("P010", "ENR-BRY-24", "B0ENRBRY24", "Energy Lift Berry", "Energy", date(2024, 8, 15), 8.30, 28.00),
    ("P011", "VIT-WMN-30", "B0VITWMN30", "Women's Daily Vitamins", "Vitamins", date(2023, 2, 10), 11.50, 34.00),
    ("P012", "VIT-MEN-30", "B0VITMEN30", "Men's Daily Vitamins", "Vitamins", date(2025, 2, 10), 11.50, 34.00),
]

CAMPAIGNS = [
    ("C001", "Hero Scale - Sponsored Products", "Amazon Ads", "Sponsored Products", "P001", date(2024, 1, 1), None, "always_on", 18.0, "standard"),
    ("C002", "Hydration Category Growth", "Amazon Ads", "Sponsored Products", "P003", date(2024, 1, 1), None, "always_on", 22.0, "standard"),
    ("C003", "Meta Value Prospecting", "Meta", "Paid Social", "P009", date(2024, 1, 1), None, "always_on", 18.0, "low_quality"),
    ("C004", "Google Premium Search", "Google", "Paid Search", "P002", date(2024, 1, 1), None, "always_on", 39.0, "premium"),
    ("C005", "Amazon Brand Defense", "Amazon Ads", "Sponsored Brands", "P011", date(2024, 1, 1), None, "always_on", 24.0, "standard"),
    ("C006", "Subscribe & Save Coupon", "Amazon Ads", "Sponsored Display", "P002", date(2024, 9, 1), date(2024, 10, 15), "promotion", 20.0, "coupon_mixed"),
    ("C007", "Retargeting", "Meta", "Paid Social", "P007", date(2024, 1, 1), None, "always_on", 28.0, "premium"),
]

EVENTS = [
    ("EV001", date(2024, 7, 16), date(2024, 7, 17), "retail_event", "Prime Day 2024", "Prime Day demand and acquisition spike"),
    ("EV002", date(2025, 7, 15), date(2025, 7, 16), "retail_event", "Prime Day 2025", "Prime Day demand and acquisition spike"),
    ("EV003", date(2024, 11, 29), date(2024, 11, 29), "retail_event", "Black Friday 2024", "Deep discount event"),
    ("EV004", date(2024, 12, 2), date(2024, 12, 2), "retail_event", "Cyber Monday 2024", "Deep discount event"),
    ("EV005", date(2025, 11, 28), date(2025, 11, 28), "retail_event", "Black Friday 2025", "Deep discount event"),
    ("EV006", date(2025, 12, 1), date(2025, 12, 1), "retail_event", "Cyber Monday 2025", "Deep discount event"),
    ("EV007", date(2024, 12, 20), date(2024, 12, 25), "holiday", "Christmas 2024", "Holiday demand"),
    ("EV008", date(2025, 12, 20), date(2025, 12, 25), "holiday", "Christmas 2025", "Holiday demand"),
    ("EV009", date(2024, 9, 1), date(2024, 10, 15), "coupon_campaign", "Subscribe Starter 25%", "Aggressive Subscribe & Save acquisition coupon"),
    ("EV010", date(2024, 3, 1), date(2024, 3, 1), "product_launch", "Hydration Berry launch", "P004 launch"),
    ("EV011", date(2024, 8, 15), date(2024, 8, 15), "product_launch", "Energy Berry launch", "P010 launch"),
    ("EV012", date(2025, 2, 10), date(2025, 2, 10), "product_launch", "Men's Vitamins launch", "P012 launch"),
    ("EV013", date(2025, 4, 7), date(2025, 4, 13), "stockout", "Hydration Citrus stockout", "Temporary unit drop"),
    ("EV014", date(2025, 9, 8), date(2025, 9, 14), "operational_anomaly", "Subscription service disruption", "Temporary churn spike"),
    ("EV015", date(2025, 3, 3), date(2025, 3, 9), "advertising_anomaly", "Meta tracking degradation", "Spend increase without matching acquisition"),
]

TABLE_SCHEMAS = {
    "dim_products": "product_id VARCHAR, sku VARCHAR, asin VARCHAR, product_name VARCHAR, category VARCHAR, launch_date DATE, unit_cost DECIMAL(12,2), list_price DECIMAL(12,2)",
    "dim_campaigns": "campaign_id VARCHAR, campaign_name VARCHAR, channel VARCHAR, campaign_type VARCHAR, target_product_id VARCHAR, start_date DATE, end_date DATE, objective VARCHAR, planned_cac DECIMAL(12,2), audience_quality VARCHAR",
    "dim_customers": "customer_id VARCHAR, first_order_date DATE, acquisition_channel VARCHAR, acquisition_campaign_id VARCHAR, first_product_id VARCHAR, customer_type VARCHAR, subscription_status VARCHAR, acquisition_event VARCHAR",
    "dim_calendar": "date_day DATE, year INTEGER, month INTEGER, month_start DATE, week_start DATE, day_of_week INTEGER, is_weekend BOOLEAN, event_name VARCHAR, event_type VARCHAR",
    "dim_events": "event_id VARCHAR, start_date DATE, end_date DATE, event_type VARCHAR, event_name VARCHAR, description VARCHAR",
    "fact_ad_performance": "date_day DATE, campaign_id VARCHAR, product_id VARCHAR, ad_spend DECIMAL(12,2), impressions INTEGER, clicks INTEGER, attributed_orders INTEGER, attributed_sales DECIMAL(12,2), new_customers INTEGER",
    "fact_customer_acquisition": "customer_id VARCHAR, acquisition_date DATE, campaign_id VARCHAR, channel VARCHAR, acquisition_cost DECIMAL(12,2), is_paid BOOLEAN",
    "fact_orders": "order_id VARCHAR, customer_id VARCHAR, order_date DATE, order_status VARCHAR, gross_revenue DECIMAL(12,2), discounts DECIMAL(12,2), coupons DECIMAL(12,2), net_revenue_before_refunds DECIMAL(12,2), units INTEGER, new_vs_returning VARCHAR, is_subscription_order BOOLEAN, sales_channel VARCHAR, event_name VARCHAR",
    "fact_order_items": "order_item_id VARCHAR, order_id VARCHAR, product_id VARCHAR, quantity INTEGER, unit_price DECIMAL(12,2), gross_revenue DECIMAL(12,2), discount_amount DECIMAL(12,2), coupon_amount DECIMAL(12,2), net_revenue_before_refunds DECIMAL(12,2)",
    "fact_subscriptions": "subscription_id VARCHAR, customer_id VARCHAR, product_id VARCHAR, start_date DATE, cancellation_date DATE, status_at_end VARCHAR, initial_coupon_code VARCHAR, billing_frequency_days INTEGER, cancellation_reason VARCHAR",
    "fact_refunds": "refund_id VARCHAR, order_item_id VARCHAR, order_id VARCHAR, customer_id VARCHAR, product_id VARCHAR, refund_date DATE, refund_amount DECIMAL(12,2), refund_reason VARCHAR",
    "fact_amazon_fees": "fee_id VARCHAR, order_item_id VARCHAR, order_id VARCHAR, product_id VARCHAR, fee_date DATE, fee_type VARCHAR, fee_amount DECIMAL(12,2)",
    "fact_cogs": "cogs_id VARCHAR, order_item_id VARCHAR, order_id VARCHAR, product_id VARCHAR, cogs_date DATE, quantity INTEGER, unit_cost DECIMAL(12,2), cogs_amount DECIMAL(12,2)",
}


def daterange(start: date, end: date):
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


def week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())


def event_on(d: date):
    return next((e for e in EVENTS if e[1] <= d <= e[2]), None)


def is_prime(d: date) -> bool:
    e = event_on(d)
    return bool(e and "Prime Day" in e[4])


def is_bfcm(d: date) -> bool:
    e = event_on(d)
    return bool(e and ("Black Friday" in e[4] or "Cyber Monday" in e[4]))


def weighted_choice(rng: random.Random, pairs):
    values, weights = zip(*pairs)
    return rng.choices(values, weights=weights, k=1)[0]


def product_weights(d: date):
    weights = {p[0]: 1.0 for p in PRODUCTS if p[5] <= d}
    weights.update({"P001": 4.8, "P002": 2.2, "P003": 1.8, "P005": 1.6, "P009": 1.5, "P011": 1.3})
    if "P004" in weights:
        weights["P004"] = 1.5
    if "P010" in weights:
        weights["P010"] = 1.2
    if "P012" in weights:
        weights["P012"] = 1.1
    if d.month in (5, 6, 7, 8):
        for pid in ("P003", "P004"):
            if pid in weights:
                weights[pid] *= 3.0
    if d.month in (11, 12):
        weights["P005"] *= 2.0
        weights["P006"] *= 1.6
    if date(2025, 4, 7) <= d <= date(2025, 4, 13):
        weights["P003"] *= 0.08
    return list(weights.items())


def generate(seed: int, start: date, end: date):
    rng = random.Random(seed)
    products = [tuple(p) for p in PRODUCTS]
    campaigns = [tuple(c) for c in CAMPAIGNS]
    product_map = {p[0]: p for p in products}

    calendar = []
    for d in daterange(start, end):
        e = event_on(d)
        calendar.append((d, d.year, d.month, d.replace(day=1), week_start(d), d.weekday() + 1, d.weekday() >= 5, e[4] if e else None, e[3] if e else None))

    ads = []
    acquisition_slots = []
    for d in daterange(start, end):
        for c in campaigns:
            cid, _, channel, _, pid, cstart, cend, _, base_cac, quality = c
            if d < cstart or (cend and d > cend):
                continue
            week_idx = (week_start(d) - week_start(start)).days // 7
            if cid == "C001":
                weekly_spend = 2600 + (week_idx % 13) * 620 + 700 * math.sin(week_idx / 2.7)
                if d >= date(2025, 1, 1):
                    weekly_spend *= 2.20
                spend = max(200, weekly_spend / 7 * rng.uniform(0.90, 1.10))
                cac = 17.5 + max(0, weekly_spend - 5200) / 520 * 2.7
            else:
                bases = {"C002": 180, "C003": 135, "C004": 150, "C005": 105, "C006": 240, "C007": 85}
                season = 1.7 if cid == "C002" and d.month in (5, 6, 7, 8) else 1.0
                spend = bases[cid] * season * rng.uniform(0.80, 1.20)
                cac = base_cac * rng.uniform(0.90, 1.12)
            if is_prime(d):
                spend *= 2.8
                cac *= 0.72
            if is_bfcm(d):
                spend *= 2.4
                cac *= 0.88
            if cid == "C003" and date(2025, 3, 3) <= d <= date(2025, 3, 9):
                spend *= 2.2
                cac *= 2.6
            new_customers = max(0, int(spend / cac * rng.uniform(0.87, 1.13)))
            ctr = {"Amazon Ads": 0.0052, "Meta": 0.0085, "Google": 0.0068}[channel]
            cpc = {"Amazon Ads": 1.35, "Meta": 0.82, "Google": 1.85}[channel]
            clicks = max(new_customers, int(spend / cpc * rng.uniform(0.92, 1.08)))
            impressions = int(clicks / ctr)
            attributed_orders = int(new_customers * rng.uniform(1.02, 1.13))
            avg_price = product_map[pid][7]
            attributed_sales = attributed_orders * avg_price * rng.uniform(0.88, 1.06)
            ads.append((d, cid, pid, round(spend, 2), impressions, clicks, attributed_orders, round(attributed_sales, 2), new_customers))
            if new_customers:
                per_customer_cost = spend / new_customers
                acquisition_slots.extend([(d, cid, channel, pid, quality, per_customer_cost)] * new_customers)

        organic_count = int((10 + 3 * math.sin(d.timetuple().tm_yday / 20)) * (2.2 if is_prime(d) else 1.0) * (1.8 if is_bfcm(d) else 1.0))
        for _ in range(max(4, organic_count)):
            pid = weighted_choice(rng, product_weights(d))
            acquisition_slots.append((d, None, "Organic", pid, "standard", 0.0))

    customers, acquisition, subscriptions = [], [], []
    customer_profiles = []
    for i, slot in enumerate(acquisition_slots, 1):
        d, cid, channel, first_pid, quality, acq_cost = slot
        customer_id = f"CU{i:07d}"
        event = event_on(d)
        event_name = event[4] if event else None
        prime_cohort = bool(event_name and "Prime Day" in event_name)
        coupon_cohort = cid == "C006"
        sub_prob = {"low_quality": 0.08, "standard": 0.18, "premium": 0.38, "coupon_mixed": 0.52}[quality]
        if prime_cohort:
            sub_prob *= 0.55
        subscribed = rng.random() < sub_prob
        customer_type = "subscriber" if subscribed else "one_time"
        subscription_id = None
        cancellation_date = None
        if subscribed:
            subscription_id = f"SU{i:07d}"
            churn_prob = {"low_quality": 0.58, "standard": 0.33, "premium": 0.18, "coupon_mixed": 0.52}[quality]
            if prime_cohort:
                churn_prob += 0.12
            if rng.random() < churn_prob:
                months = rng.choice([1, 2, 2, 3, 4, 5, 6])
                cancellation_date = min(end, d + timedelta(days=30 * months + rng.randint(-4, 5)))
            if date(2025, 9, 8) <= d <= date(2025, 9, 14) and rng.random() < 0.35:
                cancellation_date = min(end, d + timedelta(days=rng.randint(10, 35)))
            subscriptions.append((subscription_id, customer_id, first_pid, d, cancellation_date, "cancelled" if cancellation_date else "active", "SUB25" if coupon_cohort else "WELCOME10", 30, "low engagement" if cancellation_date else None))
        status = "cancelled" if cancellation_date else ("active" if subscribed else "never_subscribed")
        customers.append((customer_id, d, channel, cid, first_pid, customer_type, status, event_name))
        acquisition.append((customer_id, d, cid, channel, round(acq_cost, 2), bool(cid)))
        customer_profiles.append((customer_id, d, first_pid, quality, prime_cohort, coupon_cohort, subscribed, cancellation_date))

    order_drafts = []
    for profile in customer_profiles:
        customer_id, first_date, first_pid, quality, prime_cohort, coupon_cohort, subscribed, cancel_date = profile
        order_drafts.append((customer_id, first_date, first_pid, False, True, coupon_cohort))
        if subscribed:
            od = first_date + timedelta(days=30 + rng.randint(-2, 3))
            while od <= end and (not cancel_date or od < cancel_date):
                order_drafts.append((customer_id, od, first_pid, True, False, False))
                od += timedelta(days=30 + rng.randint(-2, 3))
        else:
            repeat_base = {"low_quality": 0.16, "standard": 0.34, "premium": 0.58, "coupon_mixed": 0.23}[quality]
            if prime_cohort:
                repeat_base *= 0.48
            od = first_date
            for repeat_no in range(1, 5):
                if rng.random() >= repeat_base * (0.78 ** (repeat_no - 1)):
                    break
                od += timedelta(days=rng.randint(28, 75))
                if od > end:
                    break
                pid = first_pid if rng.random() < 0.62 else weighted_choice(rng, product_weights(od))
                order_drafts.append((customer_id, od, pid, False, False, False))

    order_drafts.sort(key=lambda x: (x[1], x[0]))
    orders, items, refunds, fees, cogs = [], [], [], [], []
    refund_n = fee_n = cogs_n = item_n = 0
    for order_n, draft in enumerate(order_drafts, 1):
        customer_id, od, primary_pid, is_sub, is_first, coupon_cohort = draft
        order_id = f"OR{order_n:08d}"
        pids = [primary_pid]
        if rng.random() < (0.13 if is_first else 0.19):
            pids.append(weighted_choice(rng, product_weights(od)))
        order_lines = []
        event = event_on(od)
        event_name = event[4] if event else None
        for pid in pids:
            item_n += 1
            p = product_map[pid]
            qty = 2 if rng.random() < 0.10 else 1
            price = p[7]
            gross = price * qty
            discount_rate = 0.0
            coupon_rate = 0.0
            if is_sub:
                discount_rate += 0.10
            if is_prime(od):
                discount_rate += 0.20
            elif is_bfcm(od):
                discount_rate += 0.27
            if coupon_cohort and is_first:
                coupon_rate += 0.25
            if pid == "P001" and rng.random() < 0.36:
                discount_rate += 0.08
            discount_rate = min(discount_rate, 0.42)
            discount = gross * discount_rate
            coupon = gross * coupon_rate
            net_before_refund = gross - discount - coupon
            item_id = f"OI{item_n:09d}"
            items.append((item_id, order_id, pid, qty, price, round(gross, 2), round(discount, 2), round(coupon, 2), round(net_before_refund, 2)))
            order_lines.append((gross, discount, coupon, net_before_refund, qty))

            cost_inflation = 1 + max(0, od.year - 2024) * (0.07 if pid == "P001" else 0.025)
            unit_cost = p[6] * cost_inflation
            cogs_n += 1
            cogs.append((f"CG{cogs_n:09d}", item_id, order_id, pid, od, qty, round(unit_cost, 2), round(unit_cost * qty, 2)))
            fee_components = [
                ("referral_fee", net_before_refund * (0.17 if pid == "P001" else 0.15)),
                ("fulfillment_fee", qty * (6.40 if pid == "P001" else (5.10 if p[4] == "Accessories" else 4.25))),
                ("storage_fee", qty * (0.85 if od.month in (10, 11, 12) else 0.38)),
                ("other_marketplace_fee", net_before_refund * 0.012),
            ]
            for fee_type, amount in fee_components:
                fee_n += 1
                fees.append((f"FE{fee_n:010d}", item_id, order_id, pid, od, fee_type, round(amount, 2)))

            refund_rate = 0.022
            if pid == "P005":
                refund_rate = 0.045 if od < date(2025, 7, 1) else 0.19
            if is_prime(od):
                refund_rate *= 1.25
            if rng.random() < refund_rate:
                refund_n += 1
                refund_date = min(end, od + timedelta(days=rng.randint(5, 32)))
                reason = "quality_issue" if pid == "P005" and od >= date(2025, 7, 1) else rng.choice(["changed_mind", "damaged", "not_as_expected"])
                refunds.append((f"RF{refund_n:08d}", item_id, order_id, customer_id, pid, refund_date, round(net_before_refund, 2), reason))

        gross = sum(x[0] for x in order_lines)
        discount = sum(x[1] for x in order_lines)
        coupon = sum(x[2] for x in order_lines)
        net = sum(x[3] for x in order_lines)
        units = sum(x[4] for x in order_lines)
        orders.append((order_id, customer_id, od, "completed", round(gross, 2), round(discount, 2), round(coupon, 2), round(net, 2), units, "new" if is_first else "returning", is_sub, "Amazon US", event_name))

    return {
        "dim_products": products,
        "dim_campaigns": campaigns,
        "dim_customers": customers,
        "dim_calendar": calendar,
        "dim_events": [tuple(e) for e in EVENTS],
        "fact_ad_performance": ads,
        "fact_customer_acquisition": acquisition,
        "fact_orders": orders,
        "fact_order_items": items,
        "fact_subscriptions": subscriptions,
        "fact_refunds": refunds,
        "fact_amazon_fees": fees,
        "fact_cogs": cogs,
    }


def write_parquet(tables, output_dir: Path):
    output_dir.mkdir(parents=True, exist_ok=True)
    conn = duckdb.connect()
    try:
        with tempfile.TemporaryDirectory(prefix="ecommerce-generator-") as temp_dir:
            for table, rows in tables.items():
                conn.execute(f"CREATE OR REPLACE TABLE {table} ({TABLE_SCHEMAS[table]})")
                if rows:
                    csv_path = Path(temp_dir) / f"{table}.csv"
                    with csv_path.open("w", newline="", encoding="utf-8") as handle:
                        writer = csv.writer(handle)
                        writer.writerows(rows)
                    escaped_csv = csv_path.as_posix().replace("'", "''")
                    conn.execute(f"COPY {table} FROM '{escaped_csv}' (FORMAT CSV, HEADER FALSE, NULL '')")
                path = (output_dir / f"{table}.parquet").resolve().as_posix().replace("'", "''")
                conn.execute(f"COPY {table} TO '{path}' (FORMAT PARQUET, COMPRESSION ZSTD)")
    finally:
        conn.close()


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=int, default=20240916)
    parser.add_argument("--start-date", type=date.fromisoformat, default=date(2024, 1, 1))
    parser.add_argument("--end-date", type=date.fromisoformat, default=date(2025, 12, 31))
    parser.add_argument("--output-dir", type=Path, default=ROOT / "data" / "generated")
    parser.add_argument("--database", type=Path, default=ROOT / "data" / "ecommerce.duckdb")
    return parser.parse_args()


def main():
    args = parse_args()
    if args.end_date < args.start_date:
        raise SystemExit("end-date must be on or after start-date")
    tables = generate(args.seed, args.start_date, args.end_date)
    write_parquet(tables, args.output_dir)
    initialize_database(args.output_dir, args.database)
    for table, rows in tables.items():
        print(f"{table}: {len(rows):,} rows")
    print(f"DuckDB: {args.database}")


if __name__ == "__main__":
    main()
