"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BadgeDollarSign,
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  Database,
  PackageCheck,
  ShoppingBag,
  Sparkles,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import AiAnalyst from "@/components/ai-analyst";

type Numeric = number | null;

type DashboardData = {
  meta: { brand: string; period: string; currency: string };
  monthly: Array<{
    month: string; year: number; gross_revenue: number; net_revenue: number;
    contribution_profit: number; contribution_margin: number; ad_spend: number;
    refunds: number; orders: number; aov: number; tacos: number;
  }>;
  products: Array<{
    product_id: string; sku: string; product_name: string; category: string;
    gross_revenue: number; net_revenue: number; contribution_profit: number;
    contribution_margin: number; refunds: number; refund_rate: number;
    ad_spend: number; yoy_revenue_growth: Numeric; margin_change: Numeric;
  }>;
  customerSegments: Array<{
    customer_type: string; customers: number; ltv_90d: number; ltp: number;
    average_orders: number; repeat_rate: number;
  }>;
  channels: Array<Record<string, string | number>>;
  campaigns: Array<{
    campaign_id: string; campaign_name: string; channel: string; customers: number;
    cac: number; ltv_90d: number; ltp: number; repeat_purchase_rate: number;
    ltv_to_cac: number; ltp_to_cac: number;
  }>;
  spendCurve: Array<{
    week_start: string; ad_spend: number; new_customers: number;
    new_customer_cac: number; roas: number;
  }>;
  cohorts: Array<{
    cohort_month: string; month_number: number; retained_customers: number;
    cohort_size: number; retention_rate: number;
  }>;
  events: Array<Record<string, string>>;
};

type SpendPoint = DashboardData["spendCurve"][number] & { isThreshold?: boolean };

const money = new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: 0,
});
const compactMoney = new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1,
});
const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

const monthLabel = (value: string) =>
  new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-US", { month: "short" });

function Delta({ value }: { value: number }) {
  const positive = value >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`delta ${positive ? "positive" : "negative"}`}>
      <Icon size={14} strokeWidth={2} /> {Math.abs(value * 100).toFixed(1)}%
    </span>
  );
}

function MetricCard({
  label, value, delta, context, icon: Icon,
}: {
  label: string; value: string; delta?: number; context: string;
  icon: typeof Activity;
}) {
  return (
    <article className="metric-card">
      <div className="metric-topline">
        <span className="metric-label">{label}</span>
        <span className="metric-icon"><Icon size={17} strokeWidth={1.8} /></span>
      </div>
      <strong>{value}</strong>
      <div className="metric-context">{delta !== undefined && <Delta value={delta} />}<span>{context}</span></div>
    </article>
  );
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      {label && <div className="tooltip-label">{monthLabel(label)}</div>}
      {payload.map((entry) => (
        <div className="tooltip-row" key={entry.name}>
          <span className="tooltip-dot" style={{ background: entry.color }} />
          <span>{entry.name}</span>
          <strong>{entry.name.toLowerCase().includes("margin") ? percent(entry.value) : compactMoney.format(entry.value)}</strong>
        </div>
      ))}
    </div>
  );
}

function SpendCurveTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: SpendPoint }> }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  const beyondThreshold = point.ad_spend >= 5200;
  return (
    <div className="spend-tooltip">
      <div className="spend-tooltip-topline">
        <span>{new Date(`${point.week_start.slice(0, 10)}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
        <strong className={beyondThreshold ? "threshold-reached" : "threshold-safe"}>
          {point.isThreshold ? "Inflection point" : beyondThreshold ? "Beyond threshold" : "Before threshold"}
        </strong>
      </div>
      <div className="spend-tooltip-focus">
        <span>Weekly spend</span>
        <strong>{money.format(point.ad_spend)}</strong>
      </div>
      <dl>
        <div><dt>New-customer CAC</dt><dd>{money.format(point.new_customer_cac)}</dd></div>
        <div><dt>New customers</dt><dd>{integer.format(point.new_customers)}</dd></div>
        <div><dt>ROAS</dt><dd>{point.roas.toFixed(2)}×</dd></div>
      </dl>
      <p>Returns begin to diminish at <strong>$5.2K / week</strong>.</p>
    </div>
  );
}

export default function Dashboard({ data }: { data: DashboardData }) {
  const [year, setYear] = useState(2025);
  const current = useMemo(() => data.monthly.filter((row) => row.year === year), [data.monthly, year]);
  const previous = useMemo(() => data.monthly.filter((row) => row.year === year - 1), [data.monthly, year]);

  const aggregate = (values: typeof data.monthly) => {
    const gross = values.reduce((sum, row) => sum + row.gross_revenue, 0);
    const net = values.reduce((sum, row) => sum + row.net_revenue, 0);
    const profit = values.reduce((sum, row) => sum + row.contribution_profit, 0);
    const orders = values.reduce((sum, row) => sum + row.orders, 0);
    const ads = values.reduce((sum, row) => sum + row.ad_spend, 0);
    return { gross, net, profit, orders, ads, margin: profit / net, aov: net / orders, tacos: ads / gross };
  };
  const now = aggregate(current);
  const prior = aggregate(previous);
  const change = (a: number, b: number) => (b ? a / b - 1 : 0);

  const productChart = data.products.slice(0, 7).map((product) => ({
    ...product, shortName: product.product_name.replace("Daily Nutrition", "Nutrition").replace("Hydration Mix", "Hydration"),
  }));
  const subscriber = data.customerSegments.find((segment) => segment.customer_type === "subscriber")!;
  const oneTime = data.customerSegments.find((segment) => segment.customer_type === "one_time")!;
  const hero = data.products.find((product) => product.product_id === "P001")!;
  const refundRisk = data.products.find((product) => product.product_id === "P005")!;
  const cohortMonths = [...new Set(data.cohorts.map((row) => row.cohort_month))].slice(-12);
  const nearestThresholdWeek = data.spendCurve.reduce((closest, point) =>
    Math.abs(point.ad_spend - 5200) < Math.abs(closest.ad_spend - 5200) ? point : closest
  );
  const thresholdPoint: SpendPoint = { ...nearestThresholdWeek, ad_spend: 5200, isThreshold: true };

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <main>
      <header className="hero">
        <nav className="topbar">
          <div className="brand-mark"><span>N</span><div><strong>NORTHSTAR</strong><small>PROFITABILITY OS</small></div></div>
          <div className="topbar-meta">
            <span className="data-status"><i /> Data validated</span>
            <span>Amazon US</span>
            <span>{data.meta.period}</span>
          </div>
        </nav>

        <div className="hero-content">
          <div className="hero-copy">
            <div className="eyebrow"><Sparkles size={15} strokeWidth={2} /> ECOMMERCE PROFITABILITY INTELLIGENCE</div>
            <h1>Revenue is vanity.<br /><em>Profit tells the story.</em></h1>
            <p>A decision layer connecting product economics, customer quality, subscriptions and advertising efficiency.</p>
          </div>
          <div className="hero-profit">
            <span>2025 contribution profit</span>
            <strong>{compactMoney.format(now.profit)}</strong>
            <div>
              <span className={`delta ${now.profit - prior.profit >= 0 ? "positive" : "negative"}`}>
                {now.profit - prior.profit >= 0 ? <ArrowUpRight size={14} strokeWidth={2} /> : <ArrowDownRight size={14} strokeWidth={2} />}
                {compactMoney.format(Math.abs(now.profit - prior.profit))}
              </span>
              <span>vs. 2024</span>
            </div>
          </div>
        </div>

        <div className="section-nav" aria-label="Dashboard sections">
          {["Overview", "Products", "Customers", "Advertising"].map((item) => (
            <button key={item} onClick={() => scrollTo(item.toLowerCase())}>{item}</button>
          ))}
        </div>
      </header>

      <div className="dashboard-shell">
        <section id="overview" className="dashboard-section">
          <div className="section-heading">
            <div><span className="section-index">01</span><h2>Executive overview</h2><p>The commercial pulse, reconciled to contribution profit.</p></div>
            <div className="period-toggle" aria-label="Select year">
              {[2024, 2025].map((option) => <button key={option} className={year === option ? "active" : ""} onClick={() => setYear(option)}>{option}</button>)}
            </div>
          </div>

          <div className="metrics-grid">
            <MetricCard label="Gross revenue" value={compactMoney.format(now.gross)} delta={previous.length ? change(now.gross, prior.gross) : undefined} context={previous.length ? "year over year" : "baseline year"} icon={CircleDollarSign} />
            <MetricCard label="Net revenue" value={compactMoney.format(now.net)} delta={previous.length ? change(now.net, prior.net) : undefined} context="after discounts & refunds" icon={BadgeDollarSign} />
            <MetricCard label="Contribution margin" value={percent(now.margin)} delta={previous.length ? now.margin - prior.margin : undefined} context="after ads & Amazon fees" icon={Activity} />
            <MetricCard label="Orders" value={integer.format(now.orders)} delta={previous.length ? change(now.orders, prior.orders) : undefined} context={`${money.format(now.aov)} average order`} icon={ShoppingBag} />
          </div>

          <div className="overview-grid">
            <article className="panel trend-panel">
              <div className="panel-heading"><div><span>Commercial trend</span><h3>Growth with an economics lens</h3></div><div className="legend-inline"><i className="revenue" /> Revenue <i className="profit" /> Profit</div></div>
              <div className="chart-wrap large">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={current} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0aa58f" stopOpacity={0.22} /><stop offset="100%" stopColor="#0aa58f" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#dde1da" strokeDasharray="2 5" />
                    <XAxis dataKey="month" tickFormatter={monthLabel} axisLine={false} tickLine={false} tick={{ fill: "#758078", fontSize: 12 }} dy={8} />
                    <YAxis tickFormatter={(v) => compactMoney.format(v)} axisLine={false} tickLine={false} tick={{ fill: "#758078", fontSize: 12 }} width={58} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area name="Net revenue" type="monotone" dataKey="net_revenue" stroke="#0a9a86" strokeWidth={2.5} fill="url(#revenueFill)" />
                    <Line name="Contribution profit" type="monotone" dataKey="contribution_profit" stroke="#f2a65a" strokeWidth={2.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </article>

            <aside className="panel signals-panel">
              <div className="panel-heading"><div><span>Analyst signals</span><h3>What deserves attention</h3></div><Sparkles size={19} /></div>
              <div className="signal-list">
                <div className="signal amber"><span>01</span><div><strong>Revenue ≠ profit</strong><p>{hero.product_name} leads sales while margin trails the portfolio.</p></div></div>
                <div className="signal red"><span>02</span><div><strong>Refund risk emerging</strong><p>{refundRisk.product_name} now carries a {percent(refundRisk.refund_rate)} lifetime refund rate.</p></div></div>
                <div className="signal green"><span>03</span><div><strong>Retention compounds</strong><p>Subscribers generate {money.format(subscriber.ltv_90d)} in 90-day value vs. {money.format(oneTime.ltv_90d)} one-time.</p></div></div>
              </div>
            </aside>
          </div>
        </section>

        <section id="products" className="dashboard-section">
          <div className="section-heading"><div><span className="section-index">02</span><h2>Product profitability</h2><p>Find where topline growth hides deteriorating economics.</p></div><span className="section-chip"><PackageCheck size={15} /> 12 active SKUs</span></div>
          <div className="two-column product-layout">
            <article className="panel">
              <div className="panel-heading"><div><span>Revenue leaders</span><h3>Sales volume vs. contribution</h3></div></div>
              <div className="chart-wrap large">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productChart} layout="vertical" margin={{ top: 5, right: 20, left: 18, bottom: 0 }}>
                    <CartesianGrid horizontal={false} stroke="#e1e4de" strokeDasharray="2 5" />
                    <XAxis type="number" tickFormatter={(v) => compactMoney.format(v)} axisLine={false} tickLine={false} tick={{ fill: "#758078", fontSize: 11 }} />
                    <YAxis type="category" dataKey="shortName" width={104} axisLine={false} tickLine={false} tick={{ fill: "#344139", fontSize: 11 }} />
                    <Tooltip cursor={{ fill: "#eef0eb" }} formatter={(value) => compactMoney.format(Number(value))} />
                    <Bar name="Gross revenue" dataKey="gross_revenue" radius={[0, 5, 5, 0]} barSize={16}>
                      {productChart.map((product) => <Cell key={product.product_id} fill={product.contribution_margin < 0 ? "#e8805f" : "#0aa58f"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
            <article className="panel product-table-panel">
              <div className="panel-heading"><div><span>SKU scorecard</span><h3>Growth can be expensive</h3></div><span className="table-note">2025 vs. 2024</span></div>
              <div className="product-table">
                <div className="table-row table-head"><span>Product</span><span>Revenue</span><span>YoY</span><span>Margin</span></div>
                {data.products.slice(0, 6).map((product) => (
                  <div className="table-row" key={product.product_id}>
                    <span><strong>{product.product_name}</strong><small>{product.sku}</small></span>
                    <span>{compactMoney.format(product.gross_revenue)}</span>
                    <span className={(product.yoy_revenue_growth ?? 0) >= 0 ? "good" : "bad"}>{product.yoy_revenue_growth === null ? "New" : percent(product.yoy_revenue_growth)}</span>
                    <span className={product.contribution_margin >= 0 ? "good" : "bad"}>{percent(product.contribution_margin)}</span>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section id="customers" className="dashboard-section">
          <div className="section-heading"><div><span className="section-index">03</span><h2>Customer economics</h2><p>Separate cheap acquisition from valuable relationships.</p></div><span className="section-chip"><Users size={15} /> {integer.format(subscriber.customers + oneTime.customers)} customers</span></div>
          <div className="segment-compare">
            {[subscriber, oneTime].map((segment) => (
              <article className={`segment-card ${segment.customer_type === "subscriber" ? "featured" : ""}`} key={segment.customer_type}>
                <div><span>{segment.customer_type === "subscriber" ? "Subscribe & Save" : "One-time customers"}</span>{segment.customer_type === "subscriber" && <small>Higher quality</small>}</div>
                <strong>{money.format(segment.ltv_90d)}</strong><p>90-day LTV</p>
                <dl><div><dt>Repeat rate</dt><dd>{percent(segment.repeat_rate)}</dd></div><div><dt>Lifetime profit</dt><dd>{money.format(segment.ltp)}</dd></div><div><dt>Avg. orders</dt><dd>{segment.average_orders.toFixed(1)}×</dd></div></dl>
              </article>
            ))}
            <article className="panel cohort-panel">
              <div className="panel-heading"><div><span>Cohort retention</span><h3>Repeat behavior by acquisition month</h3></div><span className="table-note">M0–M5</span></div>
              <div className="cohort-grid">
                <div className="cohort-row cohort-head"><span>Cohort</span>{[0,1,2,3,4,5].map((m) => <span key={m}>M{m}</span>)}</div>
                {cohortMonths.map((cohort) => {
                  const values = data.cohorts.filter((row) => row.cohort_month === cohort);
                  return <div className="cohort-row" key={cohort}><span>{new Date(`${cohort.slice(0,10)}T00:00:00`).toLocaleDateString("en-US", { month: "short", year: "2-digit" })}</span>{[0,1,2,3,4,5].map((m) => { const cell = values.find((row) => row.month_number === m); const rate = cell?.retention_rate ?? 0; return <span key={m} className="heat-cell" style={{ backgroundColor: `rgba(10,165,143,${0.08 + rate * 0.85})` }}>{percent(rate)}</span>; })}</div>;
                })}
              </div>
            </article>
          </div>
        </section>

        <section id="advertising" className="dashboard-section last-section">
          <div className="section-heading"><div><span className="section-index">04</span><h2>Advertising efficiency</h2><p>Locate the point where the next dollar buys a worse customer.</p></div><span className="section-chip"><BarChart3 size={15} /> Weekly spend curve</span></div>
          <div className="two-column ad-layout">
            <article className="panel curve-panel">
              <div className="panel-heading"><div><span>Diminishing returns</span><h3>Weekly spend vs. new-customer CAC</h3></div><div className="curve-threshold"><i /> Inflection ≈ $5.2k</div></div>
              <div className="chart-wrap large">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 16, right: 18, left: 2, bottom: 6 }}>
                    <CartesianGrid stroke="#dde1da" strokeDasharray="2 5" />
                    <XAxis type="number" dataKey="ad_spend" name="Weekly spend" tickFormatter={(v) => compactMoney.format(v)} axisLine={false} tickLine={false} tick={{ fill: "#758078", fontSize: 11 }} />
                    <YAxis type="number" dataKey="new_customer_cac" name="New customer CAC" tickFormatter={(v) => money.format(v)} axisLine={false} tickLine={false} tick={{ fill: "#758078", fontSize: 11 }} width={52} />
                    <ZAxis type="number" dataKey="new_customers" range={[45, 190]} />
                    <Tooltip
                      cursor={{ stroke: "#aeb8b1", strokeDasharray: "3 3" }}
                      content={({ active, payload }) => <SpendCurveTooltip active={active} payload={payload as unknown as Array<{ payload: SpendPoint }>} />}
                    />
                    <ReferenceLine x={5200} stroke="#e8805f" strokeWidth={1.5} strokeDasharray="5 5" label={{ value: "Returns diminish ≥ $5.2K", fill: "#a94e36", fontSize: 11, position: "insideTopRight" }} />
                    <Scatter data={data.spendCurve} fill="#0a9a86" fillOpacity={0.7} />
                    <Scatter data={[thresholdPoint]} fill="#d96c4d" shape="diamond" />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </article>
            <article className="panel campaign-panel">
              <div className="panel-heading"><div><span>Acquisition quality</span><h3>CAC alone tells half the story</h3></div></div>
              <div className="campaign-list">
                {data.campaigns.slice().sort((a,b) => b.ltp_to_cac - a.ltp_to_cac).slice(0, 5).map((campaign, index) => (
                  <div className="campaign-row" key={campaign.campaign_id}>
                    <span className="campaign-rank">0{index + 1}</span>
                    <div><strong>{campaign.campaign_name}</strong><small>{campaign.channel} · {integer.format(campaign.customers)} customers</small></div>
                    <dl><div><dt>CAC</dt><dd>{money.format(campaign.cac)}</dd></div><div><dt>LTP:CAC</dt><dd className={campaign.ltp_to_cac >= 1 ? "good" : "bad"}>{campaign.ltp_to_cac.toFixed(2)}×</dd></div></dl>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>
      </div>

      <footer><div className="brand-mark inverse"><span>N</span><div><strong>NORTHSTAR</strong><small>ECOMMERCE ANALYTICS CASE STUDY</small></div></div><p>Deterministic synthetic data · Parquet · DuckDB · Next.js · Recharts</p><span><Database size={14} /> 19 automated data checks</span></footer>
      <AiAnalyst data={data} />
    </main>
  );
}
