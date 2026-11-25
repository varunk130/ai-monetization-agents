/**
 * Models behind the monetization agents' tools: unit economics, a free-tier
 * limit and price model, ad inventory for an assistant, experiment sizing, and
 * a policy check. Simple, explicit, and testable on purpose.
 */
import { APP, FREE_USAGE_BUCKETS, QUERY_MIX } from '../data/app';

const freeDau = APP.dau - APP.proSubscribers * 0.8; // most Pro subscribers are daily users
const DAYS = 30;

export function costPerQuery(standardShare = APP.standardShare): number {
  return standardShare * APP.costPerQuery.standard + (1 - standardShare) * APP.costPerQuery.mini;
}

export function unitEconomics(standardShare = APP.standardShare) {
  const cpq = costPerQuery(standardShare);
  const freeQueries = freeDau * APP.freeQueriesPerDau * DAYS;
  const proQueries = APP.proSubscribers * 0.8 * APP.proQueriesPerDay * DAYS;
  const freeCost = freeQueries * cpq;
  const proCost = proQueries * cpq;
  const proRevenue = APP.proSubscribers * APP.proPrice;
  return {
    mau: APP.mau,
    dau: APP.dau,
    free_dau: Math.round(freeDau),
    pro_subscribers: APP.proSubscribers,
    pro_conversion_of_mau: Number((APP.proSubscribers / APP.mau).toFixed(4)),
    cost_per_query_usd: Number(cpq.toFixed(5)),
    monthly_free_serving_cost_usd: Math.round(freeCost),
    monthly_pro_serving_cost_usd: Math.round(proCost),
    monthly_pro_revenue_usd: Math.round(proRevenue),
    monthly_net_usd: Math.round(proRevenue - freeCost - proCost),
    free_cost_per_dau_month_usd: Number((freeCost / freeDau).toFixed(2)),
    heaviest_8pct_of_free_users_share_of_free_cost: Number(
      ((FREE_USAGE_BUCKETS[4].queries * FREE_USAGE_BUCKETS[4].share) / FREE_USAGE_BUCKETS.reduce((s, b) => s + b.queries * b.share, 0)).toFixed(2),
    ),
  };
}

export interface PricingOption {
  free_daily_limit: number | null;
  pro_price: number;
  /** Route free traffic mostly to the small model. */
  free_on_small_model: boolean;
}

/**
 * Free-limit and price model.
 * - A daily limit caps usage of heavy free users. Users above the limit either convert, accept the cap, or churn.
 * - Price elasticity: conversions fall ~1.6% for each 1% price increase above $12.
 */
export function simulatePricing(o: PricingOption) {
  const limit = o.free_daily_limit;
  let capped = 0;
  let queries = 0;
  for (const b of FREE_USAGE_BUCKETS) {
    const q = limit === null ? b.queries : Math.min(b.queries, limit);
    if (limit !== null && b.queries > limit) capped += b.share;
    queries += q * b.share;
  }
  const scale = APP.freeQueriesPerDau / FREE_USAGE_BUCKETS.reduce((s, b) => s + b.queries * b.share, 0);
  const freeQueriesPerDau = queries * scale;

  const priceRatio = o.pro_price / APP.proPrice;
  const elasticity = Math.max(0.2, 1 - 1.6 * (priceRatio - 1));
  // Hitting a limit converts ~9% of capped users per month; ~4% of capped users leave.
  const newPro = freeDau * capped * 0.09 * elasticity;
  const lostFree = freeDau * capped * 0.04;
  const pro = APP.proSubscribers * (o.pro_price > APP.proPrice ? 1 - 0.25 * (priceRatio - 1) : 1) + newPro;
  const share = o.free_on_small_model ? 0.15 : APP.standardShare;
  const cpq = costPerQuery(share);
  const free = freeDau - newPro - lostFree;
  const freeCost = free * freeQueriesPerDau * DAYS * cpq;
  const proCost = pro * 0.8 * APP.proQueriesPerDay * DAYS * costPerQuery(APP.standardShare);
  const revenue = pro * o.pro_price;
  return {
    option: o,
    free_users_hitting_limit_pct: Number((capped * 100).toFixed(1)),
    pro_subscribers: Math.round(pro),
    free_dau_lost_per_month: Math.round(lostFree),
    monthly_pro_revenue_usd: Math.round(revenue),
    monthly_serving_cost_usd: Math.round(freeCost + proCost),
    monthly_net_usd: Math.round(revenue - freeCost - proCost),
  };
}

export interface AdOption {
  /** Minimum commercial intent (0..1) of a query before an ad may show. */
  min_intent: number;
  exclude_sensitive: boolean;
  exclude_minors: boolean;
  /** Max share of eligible answers that carry a sponsored card. */
  ad_load: number;
}

/** Ad inventory for sponsored cards under assistant answers (free tier only). */
export function estimateAds(a: AdOption) {
  const freeQueries = freeDau * APP.freeQueriesPerDau * DAYS;
  const audience = a.exclude_minors ? 1 - APP.minorShare : 1;
  let eligible = 0;
  let sensitiveImpressions = 0;
  for (const t of QUERY_MIX) {
    if (a.exclude_sensitive && t.sensitive) continue;
    if (t.commercial < a.min_intent) continue;
    const imp = freeQueries * t.share * audience * a.ad_load;
    eligible += imp;
    if (t.sensitive) sensitiveImpressions += imp;
  }
  const cpm = 9 + 14 * Math.min(1, a.min_intent * 1.5); // higher-intent placements earn more per impression
  const revenue = (eligible / 1000) * cpm;
  // Trust cost: free users who leave because of ad density, scaled up sharply on sensitive topics.
  const density = eligible / freeQueries;
  const churnPct = 0.6 * density * density * 100 + (sensitiveImpressions > 0 ? 1.5 : 0);
  return {
    option: a,
    monthly_impressions: Math.round(eligible),
    share_of_free_answers_with_ad_pct: Number((density * 100).toFixed(1)),
    cpm_usd: Number(cpm.toFixed(2)),
    monthly_ad_revenue_usd: Math.round(revenue),
    ads_on_sensitive_topics: sensitiveImpressions > 0,
    est_free_user_churn_pct: Number(churnPct.toFixed(2)),
  };
}

/** Two-proportion sample size (normal approximation), per arm. */
export function sampleSize(baseline: number, relativeLift: number, alpha = 0.05, power = 0.8) {
  const z = (p: number): number => {
    // Acklam-style approximation of the inverse normal CDF, good to ~1e-4.
    const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
    const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
    const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
    const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
    const pl = 0.02425;
    let q: number, r: number;
    if (p < pl) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p > 1 - pl) return -z(1 - p);
    q = p - 0.5;
    r = q * q;
    return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  };
  const p1 = baseline;
  const p2 = baseline * (1 + relativeLift);
  const za = z(1 - alpha / 2);
  const zb = z(power);
  const pbar = (p1 + p2) / 2;
  const n = ((za * Math.sqrt(2 * pbar * (1 - pbar)) + zb * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2) / (p2 - p1) ** 2;
  return Math.ceil(n);
}

export function sizeExperiment(baseline: number, relativeLift: number, trafficSharePerArm: number, arms = 2) {
  const n = sampleSize(baseline, relativeLift);
  const dailyPerArm = freeDau * trafficSharePerArm;
  return {
    baseline_rate: baseline,
    minimum_detectable_lift: relativeLift,
    arms,
    users_per_arm: n,
    daily_users_per_arm: Math.round(dailyPerArm),
    days_needed: Math.max(7, Math.ceil(n / dailyPerArm)),
    note: 'Run at least one full week to cover weekday/weekend behavior.',
  };
}

const POLICY_RULES: { re: RegExp; issue: string; severity: 'block' | 'warn' }[] = [
  { re: /ads?.{0,40}(health|medical|finance|money|mental)/i, issue: 'Ads on health or finance questions. Sensitive topics must be ad-free.', severity: 'block' },
  { re: /minor|under 18|teen/i, issue: 'Mentions minors: confirm users under 18 never see ads.', severity: 'warn' },
  { re: /hide (the )?limit|surprise|without (telling|notice)/i, issue: 'Limits must be shown before users hit them, not as a surprise.', severity: 'block' },
  { re: /ad load (of )?(5[1-9]|[6-9]\d|100)%|ad_load[":\s]+0\.[6-9]/i, issue: 'Ad load above 50% of eligible answers will feel like an ad-first product.', severity: 'warn' },
  { re: /(answer|response).{0,30}(influenc|chang|rank).{0,30}(advertis|sponsor)/i, issue: 'Sponsors must never change the assistant’s answer.', severity: 'block' },
];

export function policyCheck(text: string) {
  const findings = POLICY_RULES.filter((r) => r.re.test(text)).map((r) => ({ severity: r.severity, issue: r.issue }));
  return { approved: !findings.some((f) => f.severity === 'block'), findings };
}
