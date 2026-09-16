# Data dictionary

All monetary fields are USD. Business dates use `America/Los_Angeles`; fields are
stored as `DATE` because the synthetic source is daily. Null means “not applicable”
unless stated otherwise.

## Dimensions

### `dim_products`

One row per sellable product. `product_id` is the stable key; `sku` and `asin` are
unique business identifiers. Includes name, category, launch date, standard unit
cost and list price. The realized cost is kept in `fact_cogs` so history is stable.

### `dim_customers`

One row per customer. Contains first-order date, acquisition channel/campaign,
first product, initial customer type, end-of-window subscription status, and the
acquisition event (when relevant). Customer IDs are synthetic and contain no PII.

### `dim_campaigns`

One row per advertising campaign. Describes channel, campaign type, target product,
active dates, objective, planned CAC and an audience-quality label used only by the
generator. Analysis should use observed outcomes, not the label.

### `dim_calendar`

One row per date. Includes year, month, month/week starts, weekday/weekend flags and
the event active that day.

### `dim_events`

One row per event interval: retail moments, holidays, promotions, launches,
stockouts and operational/ad anomalies. `start_date` and `end_date` are inclusive.

## Facts

### `fact_orders`

One row per completed order (`order_id`). Header measures reconcile exactly to
order items: gross revenue, discounts, coupon discounts, pre-refund net revenue and
units. Also identifies first versus returning and subscription orders. Refunds are
separate because they occur later.

### `fact_order_items`

One row per product line in an order (`order_item_id`). Contains quantity, realized
unit price, gross revenue, promotion/coupon amounts and net revenue before refunds.

### `fact_ad_performance`

One row per date, campaign and target product. Additive measures are spend,
impressions, clicks, attributed orders/sales and new customers. ROAS, ACOS and CAC
must be calculated from summed numerators and denominators, never averaged rowwise.

### `fact_customer_acquisition`

One row per acquired customer. Provides the acquisition date, paid campaign/channel,
allocated acquisition cost and paid/organic flag. For each campaign-day, allocated
cost reconciles approximately to spend; rounding creates only cent-level variance.

### `fact_subscriptions`

One row per subscription lifecycle. Includes customer/product, start and optional
cancellation date, end-of-window status, introductory coupon, billing interval and
cancellation reason. Active subscriptions on date D satisfy
`start_date <= D AND (cancellation_date IS NULL OR cancellation_date > D)`.

### `fact_refunds`

One row per refunded order line. Includes both refund date and original item/order,
product/customer, amount and reason. This supports cash-date and order-cohort views.

### `fact_amazon_fees`

One row per order line and fee type. Fee types are `referral_fee`,
`fulfillment_fee`, `storage_fee` and `other_marketplace_fee`. Amounts are positive
costs and additive.

### `fact_cogs`

One row per order line. Contains quantity, historical unit cost and total COGS.

## Shared analytical views

- `analytics.order_item_economics`: reconciled item-level commercial economics.
- `analytics.daily_business_metrics`: daily portfolio P&L including ads.
- `analytics.product_daily_metrics`: daily product P&L with product-attributed ads.
- `analytics.customer_value`: 30/60/90-day and lifetime customer economics.
- `analytics.acquisition_channel_metrics`: channel CAC and LTV/LTP efficiency.
- `analytics.acquisition_campaign_metrics`: campaign CAC and LTV/LTP efficiency.
- `analytics.cohort_monthly_retention`: acquisition-month retention matrix.
- `analytics.campaign_weekly_metrics`: campaign spend curve inputs.
- `analytics.subscription_summary`: subscription versus one-time economics.
