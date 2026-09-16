-- Highest contribution-profit SKU in the latest complete month
SELECT p.sku, p.product_name, SUM(m.contribution_profit) AS contribution_profit
FROM analytics.product_daily_metrics m
JOIN raw.dim_products p USING (product_id)
WHERE m.date_day >= DATE '2025-12-01' AND m.date_day < DATE '2026-01-01'
GROUP BY 1, 2
ORDER BY 3 DESC
LIMIT 1;

-- Weekly spend curve for the deliberately scalable campaign
SELECT week_start, ad_spend, new_customers, new_customer_cac, roas
FROM analytics.campaign_weekly_metrics
WHERE campaign_id = 'C001'
ORDER BY week_start;

-- Subscription versus one-time customer economics
SELECT customer_type, COUNT(*) AS customers, AVG(ltv_90d) AS ltv_90d,
       AVG(lifetime_profit) AS ltp, AVG(is_repeat_customer::INT) AS repeat_rate
FROM analytics.customer_value
GROUP BY 1;

