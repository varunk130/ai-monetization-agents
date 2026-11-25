/** Turns a finished run's trace into the headline outcome for the demo. Reads tool results, so it works for replay and live runs alike. */
import type { TraceEvent } from '../agent/types';

export interface Outcome {
  headline: string;
  tiles: { label: string; value: string; hint?: string }[];
}

const money = (n: number) => (Math.abs(n) >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n / 1000)}K`);

function results<T>(events: TraceEvent[], tool: string): T[] {
  return events.filter((e) => e.kind === 'tool_result' && e.tool === tool && !e.isError).map((e) => (e as { output: unknown }).output as T);
}

interface Pricing { option: { free_daily_limit: number | null; pro_price: number; free_on_small_model: boolean }; monthly_net_usd: number; free_users_hitting_limit_pct: number }
interface Ads { option: { exclude_sensitive: boolean }; monthly_ad_revenue_usd: number; est_free_user_churn_pct: number; ads_on_sensitive_topics: boolean }

function monetization(events: TraceEvent[]): Outcome | null {
  const pricing = results<Pricing[]>(events, 'simulate_pricing').at(-1);
  const ads = results<Ads[]>(events, 'estimate_ad_revenue').at(-1);
  const exp = results<{ users_per_arm: number; days_needed: number }>(events, 'size_experiment').at(-1);
  if (!pricing || !ads) return null;
  const base = pricing[0];
  const ok = pricing.filter((r) => r.free_users_hitting_limit_pct < 25);
  const best = ok.reduce((a, b) => (b.monthly_net_usd > a.monthly_net_usd ? b : a), ok[0]);
  const safe = ads.filter((r) => !r.ads_on_sensitive_topics && r.est_free_user_churn_pct < 0.5).reduce((a, b) => (b.monthly_ad_revenue_usd > a.monthly_ad_revenue_usd ? b : a));
  const risky = ads.reduce((a, b) => (b.monthly_ad_revenue_usd > a.monthly_ad_revenue_usd ? b : a));
  const blocks = events.filter((e) => e.kind === 'agent_end' && e.agent === 'risk_reviewer' && /^\**Blocked/.test(e.output)).length;
  const gain = best.monthly_net_usd + safe.monthly_ad_revenue_usd - base.monthly_net_usd;
  return {
    headline: `Lumen Notes: +${money(gain)} net per month without ads on sensitive topics`,
    tiles: [
      { label: 'Monthly net', value: `+${money(gain)}`, hint: `${money(base.monthly_net_usd)} → ${money(base.monthly_net_usd + gain)}` },
      { label: 'Pricing move', value: `${best.option.free_daily_limit}/day · $${best.option.pro_price}`, hint: 'free limit and Pro price, free traffic on the small model' },
      { label: 'Ad revenue', value: `${money(safe.monthly_ad_revenue_usd)}/mo`, hint: `${safe.est_free_user_churn_pct}% churn, sensitive topics excluded` },
      { label: 'Trust blocks', value: String(blocks), hint: blocks ? `stopped a plan with ${risky.est_free_user_churn_pct}% churn` : 'no findings' },
      ...(exp ? [{ label: 'Experiment', value: `${exp.days_needed} days`, hint: `${exp.users_per_arm.toLocaleString()} users per arm` }] : []),
    ],
  };
}

function campaign(events: TraceEvent[]): Outcome | null {
  const c = results<{ customers: number; even_split_customers: number; lift_pct: number; cost_per_customer_usd: number; even_split_cost_per_customer_usd: number; revenue_90d_usd: number }>(events, 'compare_to_even_split').at(-1);
  if (!c) return null;
  const quotes = events.filter((e) => e.kind === 'a2a' && e.direction === 'request').length;
  return {
    headline: `${Math.round(c.customers)} new customers in 4 weeks, ${c.lift_pct}% more than an even split`,
    tiles: [
      { label: 'New customers', value: String(Math.round(c.customers)), hint: `vs ${Math.round(c.even_split_customers)} with an even split` },
      { label: 'Lift', value: `+${c.lift_pct}%`, hint: 'same budget, same market' },
      { label: 'Cost per customer', value: `$${c.cost_per_customer_usd.toFixed(2)}`, hint: `vs $${c.even_split_cost_per_customer_usd.toFixed(2)} split evenly` },
      { label: '90-day revenue', value: `$${c.revenue_90d_usd.toLocaleString()}`, hint: 'from these customers' },
      { label: 'Platforms quoted', value: String(quotes), hint: 'agent to agent, incl. AI assistant ads' },
    ],
  };
}

export function outcomeOf(events: TraceEvent[], missionId: string): Outcome | null {
  if (!events.some((e) => e.kind === 'artifact')) return null;
  return missionId === 'monetize' ? monetization(events) : campaign(events);
}
