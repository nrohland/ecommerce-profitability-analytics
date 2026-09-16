CREATE OR REPLACE VIEW analytics.order_item_economics AS
WITH refund_by_item AS (
    SELECT order_item_id, SUM(refund_amount) AS refund_amount
    FROM raw.fact_refunds GROUP BY 1
),
fee_by_item AS (
    SELECT order_item_id, SUM(fee_amount) AS amazon_fees
    FROM raw.fact_amazon_fees GROUP BY 1
),
cogs_by_item AS (
    SELECT order_item_id, SUM(cogs_amount) AS cogs
    FROM raw.fact_cogs GROUP BY 1
)
SELECT
    oi.order_item_id,
    oi.order_id,
    o.customer_id,
    o.order_date,
    oi.product_id,
    oi.quantity AS units,
    oi.gross_revenue,
    oi.discount_amount + oi.coupon_amount AS discounts,
    COALESCE(r.refund_amount, 0) AS refunds,
    oi.net_revenue_before_refunds - COALESCE(r.refund_amount, 0) AS net_revenue,
    COALESCE(c.cogs, 0) AS cogs,
    COALESCE(f.amazon_fees, 0) AS amazon_fees,
    oi.net_revenue_before_refunds - COALESCE(r.refund_amount, 0) - COALESCE(c.cogs, 0) - COALESCE(f.amazon_fees, 0) AS contribution_profit_before_ads,
    o.new_vs_returning,
    o.is_subscription_order,
    o.event_name
FROM raw.fact_order_items oi
JOIN raw.fact_orders o USING (order_id)
LEFT JOIN refund_by_item r USING (order_item_id)
LEFT JOIN fee_by_item f USING (order_item_id)
LEFT JOIN cogs_by_item c USING (order_item_id);

CREATE OR REPLACE VIEW analytics.daily_business_metrics AS
WITH commerce AS (
    SELECT order_date AS date_day,
           SUM(gross_revenue) AS gross_revenue,
           SUM(discounts) AS discounts,
           SUM(refunds) AS refunds,
           SUM(net_revenue) AS net_revenue,
           COUNT(DISTINCT order_id) AS orders,
           SUM(units) AS units,
           SUM(cogs) AS cogs,
           SUM(amazon_fees) AS amazon_fees,
           SUM(contribution_profit_before_ads) AS profit_before_ads
    FROM analytics.order_item_economics GROUP BY 1
), ads AS (
    SELECT date_day, SUM(ad_spend) AS ad_spend FROM raw.fact_ad_performance GROUP BY 1
)
SELECT c.date_day, c.gross_revenue, c.discounts, c.refunds, c.net_revenue,
       c.orders, c.units, c.net_revenue / NULLIF(c.orders, 0) AS average_order_value,
       c.cogs, c.amazon_fees, COALESCE(a.ad_spend, 0) AS ad_spend,
       c.profit_before_ads - COALESCE(a.ad_spend, 0) AS contribution_profit,
       (c.profit_before_ads - COALESCE(a.ad_spend, 0)) / NULLIF(c.net_revenue, 0) AS contribution_margin,
       COALESCE(a.ad_spend, 0) / NULLIF(c.gross_revenue, 0) AS tacos
FROM commerce c LEFT JOIN ads a USING (date_day);

CREATE OR REPLACE VIEW analytics.product_daily_metrics AS
WITH commerce AS (
    SELECT order_date AS date_day, product_id,
           SUM(gross_revenue) AS gross_revenue, SUM(discounts) AS discounts,
           SUM(refunds) AS refunds, SUM(net_revenue) AS net_revenue,
           COUNT(DISTINCT order_id) AS orders, SUM(units) AS units,
           SUM(cogs) AS cogs, SUM(amazon_fees) AS amazon_fees,
           SUM(contribution_profit_before_ads) AS profit_before_ads
    FROM analytics.order_item_economics GROUP BY 1, 2
), ads AS (
    SELECT date_day, product_id, SUM(ad_spend) AS ad_spend,
           SUM(attributed_sales) AS attributed_sales
    FROM raw.fact_ad_performance GROUP BY 1, 2
)
SELECT c.*, COALESCE(a.ad_spend, 0) AS ad_spend,
       COALESCE(a.attributed_sales, 0) AS attributed_sales,
       c.profit_before_ads - COALESCE(a.ad_spend, 0) AS contribution_profit,
       (c.profit_before_ads - COALESCE(a.ad_spend, 0)) / NULLIF(c.net_revenue, 0) AS contribution_margin,
       COALESCE(a.ad_spend, 0) / NULLIF(c.gross_revenue, 0) AS tacos,
       COALESCE(a.ad_spend, 0) / NULLIF(a.attributed_sales, 0) AS acos
FROM commerce c LEFT JOIN ads a USING (date_day, product_id);

CREATE OR REPLACE VIEW analytics.customer_value AS
WITH value_by_customer AS (
    SELECT e.customer_id,
           SUM(e.net_revenue) AS lifetime_value,
           SUM(e.contribution_profit_before_ads) AS lifetime_profit,
           SUM(CASE WHEN e.order_date < c.first_order_date + INTERVAL 30 DAY THEN e.net_revenue ELSE 0 END) AS ltv_30d,
           SUM(CASE WHEN e.order_date < c.first_order_date + INTERVAL 60 DAY THEN e.net_revenue ELSE 0 END) AS ltv_60d,
           SUM(CASE WHEN e.order_date < c.first_order_date + INTERVAL 90 DAY THEN e.net_revenue ELSE 0 END) AS ltv_90d,
           COUNT(DISTINCT e.order_id) AS lifetime_orders,
           MAX(e.order_date) AS last_order_date
    FROM analytics.order_item_economics e
    JOIN raw.dim_customers c USING (customer_id)
    GROUP BY 1
)
SELECT c.customer_id, c.first_order_date, c.acquisition_channel,
       c.acquisition_campaign_id, c.customer_type, c.subscription_status,
       c.acquisition_event, a.acquisition_cost,
       v.ltv_30d, v.ltv_60d, v.ltv_90d, v.lifetime_value, v.lifetime_profit,
       v.lifetime_orders, v.last_order_date,
       v.lifetime_orders > 1 AS is_repeat_customer,
       v.lifetime_value / NULLIF(a.acquisition_cost, 0) AS ltv_to_cac,
       v.lifetime_profit / NULLIF(a.acquisition_cost, 0) AS ltp_to_cac
FROM raw.dim_customers c
JOIN value_by_customer v USING (customer_id)
JOIN raw.fact_customer_acquisition a USING (customer_id);

CREATE OR REPLACE VIEW analytics.acquisition_channel_metrics AS
SELECT acquisition_channel,
       COUNT(*) AS customers,
       AVG(acquisition_cost) AS cac,
       AVG(ltv_90d) AS ltv_90d,
       AVG(lifetime_value) AS ltv,
       AVG(lifetime_profit) AS ltp,
       AVG(CASE WHEN is_repeat_customer THEN 1.0 ELSE 0.0 END) AS repeat_purchase_rate,
       AVG(lifetime_value) / NULLIF(AVG(acquisition_cost), 0) AS ltv_to_cac,
       AVG(lifetime_profit) / NULLIF(AVG(acquisition_cost), 0) AS ltp_to_cac
FROM analytics.customer_value
WHERE acquisition_cost > 0
GROUP BY 1;

CREATE OR REPLACE VIEW analytics.acquisition_campaign_metrics AS
SELECT acquisition_campaign_id AS campaign_id,
       COUNT(*) AS customers,
       AVG(acquisition_cost) AS cac,
       AVG(ltv_90d) AS ltv_90d,
       AVG(lifetime_value) AS ltv,
       AVG(lifetime_profit) AS ltp,
       AVG(CASE WHEN is_repeat_customer THEN 1.0 ELSE 0.0 END) AS repeat_purchase_rate,
       AVG(lifetime_value) / NULLIF(AVG(acquisition_cost), 0) AS ltv_to_cac,
       AVG(lifetime_profit) / NULLIF(AVG(acquisition_cost), 0) AS ltp_to_cac
FROM analytics.customer_value
WHERE acquisition_campaign_id IS NOT NULL
GROUP BY 1;

CREATE OR REPLACE VIEW analytics.cohort_monthly_retention AS
WITH cohorts AS (
    SELECT customer_id, DATE_TRUNC('month', first_order_date) AS cohort_month
    FROM raw.dim_customers
), activity AS (
    SELECT DISTINCT customer_id, DATE_TRUNC('month', order_date) AS activity_month
    FROM raw.fact_orders
), sizes AS (
    SELECT cohort_month, COUNT(*) AS cohort_size FROM cohorts GROUP BY 1
)
SELECT c.cohort_month, DATE_DIFF('month', c.cohort_month, a.activity_month) AS month_number,
       COUNT(DISTINCT c.customer_id) AS retained_customers, s.cohort_size,
       COUNT(DISTINCT c.customer_id)::DOUBLE / s.cohort_size AS retention_rate
FROM cohorts c JOIN activity a USING (customer_id) JOIN sizes s USING (cohort_month)
WHERE a.activity_month >= c.cohort_month
GROUP BY 1, 2, 4;

CREATE OR REPLACE VIEW analytics.campaign_weekly_metrics AS
SELECT DATE_TRUNC('week', a.date_day) AS week_start, a.campaign_id,
       c.campaign_name, c.channel, SUM(a.ad_spend) AS ad_spend,
       SUM(a.attributed_sales) AS attributed_sales,
       SUM(a.new_customers) AS new_customers,
       SUM(a.ad_spend) / NULLIF(SUM(a.new_customers), 0) AS new_customer_cac,
       SUM(a.attributed_sales) / NULLIF(SUM(a.ad_spend), 0) AS roas,
       SUM(a.ad_spend) / NULLIF(SUM(a.attributed_sales), 0) AS acos
FROM raw.fact_ad_performance a JOIN raw.dim_campaigns c USING (campaign_id)
GROUP BY 1, 2, 3, 4;

CREATE OR REPLACE VIEW analytics.subscription_summary AS
WITH economics AS (
    SELECT customer_id,
           SUM(net_revenue) AS net_revenue,
           SUM(contribution_profit_before_ads) AS lifetime_profit,
           COUNT(DISTINCT order_id) AS orders
    FROM analytics.order_item_economics GROUP BY 1
)
SELECT c.customer_type, c.acquisition_campaign_id,
       COUNT(*) AS customers,
       AVG(CASE WHEN s.subscription_id IS NOT NULL THEN 1.0 ELSE 0.0 END) AS subscription_rate,
       AVG(CASE WHEN s.cancellation_date IS NOT NULL THEN 1.0 ELSE 0.0 END) AS subscriber_churn_rate,
       AVG(e.net_revenue) AS average_ltv,
       AVG(e.lifetime_profit) AS average_ltp,
       AVG(e.orders) AS average_orders
FROM raw.dim_customers c
JOIN economics e USING (customer_id)
LEFT JOIN raw.fact_subscriptions s USING (customer_id)
GROUP BY 1, 2;
