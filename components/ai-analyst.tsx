"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronDown,
  Code2,
  Lightbulb,
  Send,
  Sparkles,
  X,
} from "lucide-react";

type AssistantData = {
  products: Array<{
    product_id: string;
    product_name: string;
    contribution_profit: number;
    contribution_margin: number;
    refund_rate: number;
    yoy_revenue_growth: number | null;
    margin_change: number | null;
  }>;
  customerSegments: Array<{
    customer_type: string;
    ltv_90d: number;
    ltp: number;
    repeat_rate: number;
  }>;
  campaigns: Array<{
    campaign_id: string;
    campaign_name: string;
    cac: number;
    ltp_to_cac: number;
  }>;
};

type Answer = {
  id: string;
  question: string;
  eyebrow: string;
  headline: string;
  body: string;
  metrics: Array<{ label: string; value: string; tone?: "positive" | "negative" }>;
  recommendations?: string[];
  sql: string;
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const compactMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

export default function AiAnalyst({ data }: { data: AssistantData }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [answerId, setAnswerId] = useState<string | null>(null);
  const [askedQuestion, setAskedQuestion] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const answers = useMemo(() => {
    const hero = data.products.find((product) => product.product_id === "P001")!;
    const refundRisk = data.products.find((product) => product.product_id === "P005")!;
    const subscriber = data.customerSegments.find((segment) => segment.customer_type === "subscriber")!;
    const oneTime = data.customerSegments.find((segment) => segment.customer_type === "one_time")!;
    const bestProfit = [...data.products].sort((a, b) => b.contribution_profit - a.contribution_profit)[0];
    const bestCampaign = [...data.campaigns].sort((a, b) => b.ltp_to_cac - a.ltp_to_cac)[0];

    const items: Answer[] = [
      {
        id: "next_steps",
        question: "What should we do next?",
        eyebrow: "Recommended action plan",
        headline: "Stop buying unprofitable growth and protect repeat economics.",
        body: "The fastest path back to healthy contribution profit is to combine a spend guardrail with product remediation and a higher-quality subscription mix.",
        metrics: [
          { label: "Hero SKU margin", value: pct(hero.contribution_margin), tone: "negative" },
          { label: "Refund-risk SKU", value: pct(refundRisk.refund_rate), tone: "negative" },
          { label: "Subscriber 90d LTV", value: money.format(subscriber.ltv_90d), tone: "positive" },
        ],
        recommendations: [
          "Cap Hero Scale spend near $5.2K per week while testing tighter bids and audiences.",
          `Pause aggressive scaling on ${refundRisk.product_name}; investigate quality complaints and supplier batches.`,
          `Prioritize retention-led acquisition. Subscribers deliver ${money.format(subscriber.ltv_90d)} in 90-day LTV versus ${money.format(oneTime.ltv_90d)} for one-time buyers.`,
        ],
        sql: `WITH product_risk AS (\n  SELECT product_id,\n         SUM(contribution_profit) / SUM(net_revenue) AS margin,\n         SUM(refunds) / SUM(gross_revenue) AS refund_rate\n  FROM analytics.product_daily_metrics\n  GROUP BY 1\n)\nSELECT * FROM product_risk\nORDER BY margin ASC;`,
      },
      {
        id: "margin_decline",
        question: "Why did contribution margin decline?",
        eyebrow: "Profitability diagnosis",
        headline: "Advertising dependency grew faster than customer economics.",
        body: `${hero.product_name} generated the most revenue, but its ${pct(hero.contribution_margin)} contribution margin made incremental growth value-destructive. Aggressive discounts, high fulfillment costs and scaled ad spend compounded the gap.`,
        metrics: [
          { label: "Hero margin", value: pct(hero.contribution_margin), tone: "negative" },
          { label: "Revenue growth", value: pct(hero.yoy_revenue_growth ?? 0), tone: "positive" },
          { label: "Margin change", value: `${((hero.margin_change ?? 0) * 100).toFixed(1)} pp`, tone: "negative" },
        ],
        sql: `SELECT product_id,\n       SUM(gross_revenue) AS revenue,\n       SUM(contribution_profit) / SUM(net_revenue) AS margin,\n       SUM(ad_spend) / SUM(gross_revenue) AS tacos\nFROM analytics.product_daily_metrics\nGROUP BY 1\nORDER BY revenue DESC;`,
      },
      {
        id: "subscribers",
        question: "Are subscribers more profitable than one-time customers?",
        eyebrow: "Customer economics",
        headline: "Yes. Retention more than offsets the introductory discount.",
        body: `Subscribe & Save customers reach ${money.format(subscriber.ltv_90d)} in 90-day LTV and repeat at ${pct(subscriber.repeat_rate)}. One-time customers reach ${money.format(oneTime.ltv_90d)} and repeat at only ${pct(oneTime.repeat_rate)}.`,
        metrics: [
          { label: "Subscriber LTV90", value: money.format(subscriber.ltv_90d), tone: "positive" },
          { label: "One-time LTV90", value: money.format(oneTime.ltv_90d) },
          { label: "Subscriber LTP", value: money.format(subscriber.ltp), tone: "positive" },
        ],
        sql: `SELECT customer_type,\n       COUNT(*) AS customers,\n       AVG(ltv_90d) AS ltv_90d,\n       AVG(lifetime_profit) AS ltp,\n       AVG(is_repeat_customer::INT) AS repeat_rate\nFROM analytics.customer_value\nGROUP BY 1;`,
      },
      {
        id: "spend_curve",
        question: "Where does CAC begin to deteriorate?",
        eyebrow: "Spend curve analysis",
        headline: "The visible inflection starts around $5.2K in weekly spend.",
        body: "Below that threshold, acquisition scales with relatively stable CAC. Above it, marginal audiences become progressively more expensive and LTP:CAC weakens.",
        metrics: [
          { label: "Spend threshold", value: "$5.2K / wk" },
          { label: "Best LTP:CAC", value: `${bestCampaign.ltp_to_cac.toFixed(2)}×`, tone: "positive" },
          { label: "Best campaign", value: bestCampaign.campaign_name },
        ],
        sql: `SELECT week_start, ad_spend, new_customers,\n       new_customer_cac, roas\nFROM analytics.campaign_weekly_metrics\nWHERE campaign_id = 'C001'\nORDER BY week_start;`,
      },
      {
        id: "best_product",
        question: "Which SKU generates the most contribution profit?",
        eyebrow: "Product economics",
        headline: `${bestProfit.product_name} is the strongest profit contributor.`,
        body: "The revenue leader is not the profit leader. This SKU combines healthier unit economics with lower advertising dependency and fewer refund losses.",
        metrics: [
          { label: "Contribution profit", value: compactMoney.format(bestProfit.contribution_profit), tone: "positive" },
          { label: "Contribution margin", value: pct(bestProfit.contribution_margin), tone: "positive" },
          { label: "Refund rate", value: pct(bestProfit.refund_rate) },
        ],
        sql: `SELECT p.product_name,\n       SUM(m.contribution_profit) AS contribution_profit,\n       SUM(m.contribution_profit) / SUM(m.net_revenue) AS margin\nFROM analytics.product_daily_metrics m\nJOIN raw.dim_products p USING (product_id)\nGROUP BY 1\nORDER BY contribution_profit DESC\nLIMIT 1;`,
      },
      {
        id: "growth_risk",
        question: "Which product is growing but losing margin?",
        eyebrow: "Growth quality",
        headline: `${hero.product_name} is the clearest case of low-quality growth.`,
        body: `Revenue grew ${pct(hero.yoy_revenue_growth ?? 0)}, while contribution margin moved ${((hero.margin_change ?? 0) * 100).toFixed(1)} percentage points in the wrong direction.`,
        metrics: [
          { label: "Revenue growth", value: pct(hero.yoy_revenue_growth ?? 0), tone: "positive" },
          { label: "Margin change", value: `${((hero.margin_change ?? 0) * 100).toFixed(1)} pp`, tone: "negative" },
          { label: "Current margin", value: pct(hero.contribution_margin), tone: "negative" },
        ],
        sql: `WITH yearly AS (\n  SELECT product_id, EXTRACT(year FROM date_day) AS year,\n         SUM(gross_revenue) AS revenue,\n         SUM(contribution_profit) / SUM(net_revenue) AS margin\n  FROM analytics.product_daily_metrics\n  GROUP BY 1, 2\n)\nSELECT * FROM yearly\nORDER BY product_id, year;`,
      },
    ];
    return Object.fromEntries(items.map((item) => [item.id, item]));
  }, [data]);

  const suggestions = ["next_steps", "margin_decline", "subscribers", "spend_curve", "best_product"];
  const answer = answerId ? answers[answerId] : null;

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 180);
  }, [open]);

  const inferAnswer = (question: string) => {
    const normalized = question.toLowerCase();
    if (/next|recommend|action|should|priorit/.test(normalized)) return "next_steps";
    if (/subscriber|subscribe|one.?time|retention/.test(normalized)) return "subscribers";
    if (/cac|spend|deterior|advertis/.test(normalized)) return "spend_curve";
    if (/grow|growth|losing margin/.test(normalized)) return "growth_risk";
    if (/sku|product|contribution profit|most profit/.test(normalized)) return "best_product";
    return "margin_decline";
  };

  const ask = (question: string, id?: string) => {
    if (!question.trim() || loading) return;
    setAskedQuestion(question.trim());
    setAnswerId(null);
    setInput("");
    setLoading(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setAnswerId(id ?? inferAnswer(question));
      setLoading(false);
    }, 720);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    ask(input);
  };

  const chooseAnotherQuestion = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setLoading(false);
    setAskedQuestion(null);
    setAnswerId(null);
    setInput("");
  };

  return (
    <>
      <button
        className={`assistant-launcher ${open ? "is-open" : ""}`}
        type="button"
        aria-expanded={open}
        aria-controls="ai-analyst-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="launcher-icons" aria-hidden="true">
          <Sparkles className="launcher-sparkles" size={18} strokeWidth={2} />
          <X className="launcher-close" size={18} strokeWidth={2} />
        </span>
        <span>{open ? "Close" : "Ask Northstar"}</span>
        {!open && <i>AI</i>}
      </button>

      <div className={`assistant-backdrop ${open ? "is-open" : ""}`} onClick={() => setOpen(false)} aria-hidden="true" />
      <aside id="ai-analyst-panel" className={`assistant-panel ${open ? "is-open" : ""}`} aria-hidden={!open} inert={!open} aria-label="Northstar AI analyst">
        <header className="assistant-header">
          <div className="assistant-identity">
            <span><Bot size={19} strokeWidth={1.8} /></span>
            <div><strong>Northstar Analyst</strong><small><i /> Simulated AI · validated metrics</small></div>
          </div>
          <button type="button" className="assistant-close" aria-label="Close AI analyst" onClick={() => setOpen(false)}><X size={18} strokeWidth={1.8} /></button>
        </header>

        <div className="assistant-scroll" aria-live="polite">
          <div className="assistant-intro">
            <span><Sparkles size={16} strokeWidth={2} /></span>
            <div><strong>Ask a profitability question.</strong><p>I answer from the same governed metric layer that powers this dashboard.</p></div>
          </div>

          {!askedQuestion && (
            <div className="suggestion-list">
              {suggestions.map((id) => (
                <button type="button" key={id} onClick={() => ask(answers[id].question, id)} disabled={loading}>
                  <span>{answers[id].question}</span><ArrowRight size={15} strokeWidth={1.8} />
                </button>
              ))}
            </div>
          )}

          {askedQuestion && (
            <>
              <button type="button" className="assistant-back-to-questions" onClick={chooseAnotherQuestion}>
                <ArrowLeft size={15} strokeWidth={1.8} /> Choose another question
              </button>
              <div className="user-message">{askedQuestion}</div>
            </>
          )}

          {loading && (
            <div className="assistant-loading">
              <span className="thinking-dots"><i /><i /><i /></span>
              <div><strong>Analyzing customer economics</strong><small>Querying validated semantic views…</small></div>
            </div>
          )}

          {answer && !loading && (
            <article className="assistant-answer">
              <div className="answer-status"><CheckCircle2 size={14} strokeWidth={2} /> Validated answer</div>
              <span className="answer-eyebrow">{answer.eyebrow}</span>
              <h3>{answer.headline}</h3>
              <p>{answer.body}</p>
              <div className="answer-metrics">
                {answer.metrics.map((metric) => (
                  <div key={metric.label}><span>{metric.label}</span><strong className={metric.tone ?? ""}>{metric.value}</strong></div>
                ))}
              </div>
              {answer.recommendations && (
                <div className="recommendation-list">
                  <div><Lightbulb size={15} strokeWidth={2} /> Prioritized next steps</div>
                  <ol>{answer.recommendations.map((item) => <li key={item}>{item}</li>)}</ol>
                </div>
              )}
              <details className="sql-disclosure">
                <summary><span><Code2 size={15} strokeWidth={1.8} /> View generated SQL</span><ChevronDown size={15} strokeWidth={1.8} /></summary>
                <pre><code>{answer.sql}</code></pre>
              </details>
            </article>
          )}
        </div>

        <form className="assistant-composer" onSubmit={submit}>
          <input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about profit, CAC, retention…" aria-label="Ask Northstar a question" />
          <button type="submit" aria-label="Send question" disabled={!input.trim() || loading}><Send size={17} strokeWidth={2} /></button>
          <small>Demo responses · SQL is read-only and visible</small>
        </form>
      </aside>
    </>
  );
}
