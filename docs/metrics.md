# Metric definitions

This file and `sql/metrics/semantic_views.sql` form the semantic source of truth.
Ratios are always calculated after aggregating their numerator and denominator.
Currency is USD; business dates use `America/Los_Angeles`.

| Metric | Definition | Unit / compatible dimensions |
|---|---|---|
| Gross Revenue | Sum of item list-price revenue before discounts and refunds | USD; date, product, customer, event |
| Discounts | Promotion discount + coupon amount | USD; same as revenue |
| Refunds | Refunded net item amount | USD; original-order or refund date, product, customer |
| Net Revenue | Gross Revenue − Discounts − Refunds | USD; date, product, customer |
| Orders | Distinct completed `order_id` | Count; date, customer, event |
| Units | Sum of item quantity | Count; date, product |
| AOV | Net Revenue ÷ Orders | USD/order; recompute at query grain |
| COGS | Sum of historical unit cost × quantity | USD; order date, product |
| Amazon Fees | Referral + fulfillment + storage + other marketplace fees | USD; date, product, fee type |
| Ad Spend | Sum of campaign spend | USD; date, campaign, product, channel |
| Contribution Profit | Net Revenue − COGS − Amazon Fees − Ad Spend | USD; portfolio/product/date where ad attribution exists |
| Contribution Margin | Contribution Profit ÷ Net Revenue | Percent; do not average row margins |
| ROAS | Attributed Sales ÷ Ad Spend | Ratio; campaign/product/channel/date |
| ACOS | Ad Spend ÷ Attributed Sales | Percent; campaign/product/channel/date |
| TACOS | Ad Spend ÷ total Gross Revenue | Percent; portfolio/product/date |
| CAC | Ad Spend ÷ acquired customers | USD/customer; paid channel/campaign/date |
| New Customer CAC | Ad Spend ÷ new customers | USD/customer; synonym at campaign grain |
| Repeat Purchase Rate | Customers with 2+ orders ÷ customers with 1+ order | Percent; cohort/channel/type; use a mature observation window |
| Retention month N | Cohort customers ordering in month N ÷ original cohort size | Percent; acquisition cohort |
| Churn | Cancellations in period ÷ subscriptions active at period start | Percent; period/product/cohort |
| Subscription Rate | Customers starting a subscription ÷ acquired customers | Percent; cohort/channel/campaign |
| Active Subscriptions | Starts on/before date with no cancellation before/on date | Count; date/product |
| Subscription Revenue | Net revenue from `is_subscription_order = true` | USD; date/product/cohort |
| 30/60/90-day LTV | Customer net revenue from first order through day 29/59/89 | USD/customer; cohort/channel/type |
| LTP | Lifetime net revenue − COGS − Amazon fees, before acquisition spend | USD/customer; cohort/channel/type |
| LTV:CAC | Average LTV ÷ average paid acquisition cost | Ratio; paid cohort/channel/campaign |
| LTP:CAC | Average LTP ÷ average paid acquisition cost | Ratio; paid cohort/channel/campaign |
| DoD / WoW / MoM / YoY | `(current period metric / comparable prior period metric) − 1` | Percent; same metric/dimensions; use complete periods |

Advertising is not forced onto individual orders. Product contribution includes ads
only where campaigns have a target product; customer LTP remains pre-acquisition-cost
so LTP:CAC stays interpretable. For LTV metrics, refunds are attributed back to the
originating item. For cash accounting, query `fact_refunds.refund_date` instead.

