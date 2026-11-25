import { BUSINESSES, CHANNELS, type Business, type ChannelId } from '../data/businesses';
import { generateCreatives, scoreCreative } from '../lib/copy';
import { customers, type Allocation } from '../lib/plan';
import { Campaign } from '../lib/campaign';
import { estimateAds, policyCheck, simulatePricing, sizeExperiment, unitEconomics, type AdOption, type PricingOption } from '../lib/monetization';
import { HANDOFF, SAVE_ARTIFACT } from '../agent/runtime';
import type { RunContext, ToolDef } from '../agent/types';

const obj = (properties: Record<string, unknown>, required: string[]) => ({ type: 'object' as const, properties, required, additionalProperties: false });

/* ---------------- Monetization (Lumen Notes) ---------------- */

const getUsage: ToolDef = {
  name: 'get_usage_metrics',
  description: 'Lumen Notes usage and unit economics for the last 30 days: users, cost per query, serving cost, Pro revenue, cost concentration.',
  input_schema: obj({}, []),
  run: () => unitEconomics(),
};

const pricingOption = {
  type: 'object',
  properties: {
    free_daily_limit: { type: ['integer', 'null'], description: 'Max assistant queries per free user per day, or null for no limit' },
    pro_price: { type: 'number', description: 'Monthly Pro price in USD' },
    free_on_small_model: { type: 'boolean', description: 'Route most free queries to the smaller model' },
  },
  required: ['free_daily_limit', 'pro_price', 'free_on_small_model'],
  additionalProperties: false,
};

const simPricing: ToolDef = {
  name: 'simulate_pricing',
  description: 'Simulate free-limit, model-routing, and Pro price options. Returns Pro subscribers, revenue, serving cost, net, and free users lost.',
  input_schema: obj({ options: { type: 'array', items: pricingOption, minItems: 1, maxItems: 6 } }, ['options']),
  run: ({ options }) => (options as PricingOption[]).map(simulatePricing),
};

const adOption = {
  type: 'object',
  properties: {
    min_intent: { type: 'number', description: '0..1 minimum commercial intent before an ad may show' },
    exclude_sensitive: { type: 'boolean' },
    exclude_minors: { type: 'boolean' },
    ad_load: { type: 'number', description: '0..1 share of eligible answers with a sponsored card' },
  },
  required: ['min_intent', 'exclude_sensitive', 'exclude_minors', 'ad_load'],
  additionalProperties: false,
};

const estAds: ToolDef = {
  name: 'estimate_ad_revenue',
  description: 'Estimate sponsored-card inventory under assistant answers for the free tier: impressions, CPM, revenue, ad density, churn risk.',
  input_schema: obj({ options: { type: 'array', items: adOption, minItems: 1, maxItems: 4 } }, ['options']),
  run: ({ options }) => (options as AdOption[]).map(estimateAds),
};

const checkPolicy: ToolDef = {
  name: 'check_policy',
  description: 'Check a monetization proposal (plain text) against trust and ad policy. Returns approved and findings.',
  input_schema: obj({ proposal: { type: 'string' } }, ['proposal']),
  run: ({ proposal }) => policyCheck(String(proposal)),
};

const sizeExp: ToolDef = {
  name: 'size_experiment',
  description: 'Sample size and duration for an A/B test on free users, given a baseline rate and the minimum relative lift worth detecting.',
  input_schema: obj(
    {
      baseline_rate: { type: 'number', description: 'e.g. 0.04 for 4%' },
      min_relative_lift: { type: 'number', description: 'e.g. 0.1 for +10%' },
      traffic_share_per_arm: { type: 'number', description: 'Share of free daily users in each arm, e.g. 0.05' },
    },
    ['baseline_rate', 'min_relative_lift', 'traffic_share_per_arm'],
  ),
  run: ({ baseline_rate, min_relative_lift, traffic_share_per_arm }) => sizeExperiment(Number(baseline_rate), Number(min_relative_lift), Number(traffic_share_per_arm)),
};

/* ---------------- Local campaign ---------------- */

function needBusiness(id: unknown): Business {
  const b = BUSINESSES.find((x) => x.id === String(id));
  if (!b) throw new Error(`Unknown business "${id}". Valid: ${BUSINESSES.map((x) => x.id).join(', ')}`);
  return b;
}

const LOCAL: Record<string, { peak: string; competitors: string; events: string }> = {
  coffee: { peak: 'Weekdays 6:30-9:30am (commuters); Saturday 9am-noon', competitors: 'Two chains within 0.5 mi run constant social ads; one indie cafe relies on its map listing', events: 'Alberta Last Thursday art walk (monthly); a farmers market opens two blocks away on Saturdays' },
  yoga: { peak: 'Weekdays 6am and 6pm; Sunday 10am', competitors: 'A national studio chain runs search ads on "yoga near me"', events: 'New Year intentions season starts in 5 weeks' },
  bike: { peak: 'Saturday mornings; spike on the first warm weekend', competitors: 'A big-box store offers cheap tune-ups with long waits', events: 'City bike-to-work week next month' },
  bakery: { peak: 'Friday and weekend pre-orders', competitors: 'Grocery bakeries; one artisan rival with strong Instagram', events: 'Holiday pre-order season' },
  cleaning: { peak: 'Monday quote requests; move-out season at month end', competitors: 'Two franchises dominate search', events: 'Apartment lease turnover at month end' },
};

const getSignals: ToolDef = {
  name: 'get_local_signals',
  description: "Local market signals for a small business: demand peaks, competitors, upcoming local events.",
  input_schema: obj({ business_id: { type: 'string' } }, ['business_id']),
  run: ({ business_id }) => {
    const b = needBusiness(business_id);
    return { business: b.name, type: b.type, location: `${b.neighborhood}, ${b.city}`, goal: b.goal, ...LOCAL[b.id] };
  },
};

const getBenchmarks: ToolDef = {
  name: 'get_benchmarks',
  description: 'Industry benchmark: expected new customers per month by channel at a given monthly spend, for this business type.',
  input_schema: obj({ business_id: { type: 'string' }, monthly_spend_per_channel: { type: 'number' } }, ['business_id', 'monthly_spend_per_channel']),
  run: ({ business_id, monthly_spend_per_channel }) => {
    const b = needBusiness(business_id);
    const s = Number(monthly_spend_per_channel);
    return CHANNELS.map((c) => {
      const n = customers(b, c.id, s);
      return { channel: c.name, expected_customers: Number(n.toFixed(1)), cost_per_customer_usd: Number((s / n).toFixed(2)) };
    });
  },
};

const genCreatives: ToolDef = {
  name: 'generate_creatives',
  description: 'Draft three ad angles (Offer, Quality, Convenience) from the business profile.',
  input_schema: obj({ business_id: { type: 'string' } }, ['business_id']),
  run: ({ business_id }) => generateCreatives(needBusiness(business_id)),
};

const scoreAd: ToolDef = {
  name: 'score_creative',
  description: 'Score one ad (0-100) for likely click-through and check it against ad policy.',
  input_schema: obj(
    { business_id: { type: 'string' }, headline: { type: 'string' }, body: { type: 'string' }, cta: { type: 'string' } },
    ['business_id', 'headline', 'body', 'cta'],
  ),
  run: ({ business_id, headline, body, cta }, ctx) => {
    const b = needBusiness(business_id);
    const s = scoreCreative({ id: '?', angle: 'Offer', headline: String(headline), body: String(body), cta: String(cta) }, b);
    const scores = (ctx.state.creativeScores as number[] | undefined) ?? [];
    scores.push(s.score);
    ctx.state.creativeScores = scores;
    return { score: s.score, predicted_ctr: Number(s.ctr.toFixed(4)), strengths: s.good, improve: s.improve, policy_flags: s.flags };
  },
};

const PLATFORMS: Record<ChannelId, { agent: string; org: string }> = {
  search: { agent: 'platform_search', org: 'Searchly Ads' },
  social: { agent: 'platform_social', org: 'Feedwave' },
  maps: { agent: 'platform_maps', org: 'MapPin Local' },
  chat: { agent: 'platform_chat', org: 'Assist Ads Network' },
};

const requestQuote: ToolDef = {
  name: 'request_quote',
  description: "Ask an ad platform's agent for a quote. Platforms: search, social, maps, chat (AI assistant ads). They reply from their own data.",
  input_schema: obj({ platform: { type: 'string', enum: Object.keys(PLATFORMS) }, message: { type: 'string' } }, ['platform', 'message']),
  run: async ({ platform, message }, ctx) => {
    const p = PLATFORMS[String(platform) as ChannelId];
    if (!p) throw new Error(`Unknown platform ${platform}`);
    ctx.emit({ kind: 'a2a', from: ctx.agent.id, to: p.agent, text: String(message), direction: 'request' });
    const reply = await ctx.runAgent(p.agent, String(message), ctx.agent);
    ctx.emit({ kind: 'a2a', from: p.agent, to: ctx.agent.id, text: reply, direction: 'response' });
    return reply;
  },
};

/** Platform-side tool: scoped to the calling platform's own channel. */
const quoteInventory: ToolDef = {
  name: 'quote_inventory',
  description: 'Quote expected weekly results on your platform for a business type and city at a weekly budget.',
  input_schema: obj({ business_type: { type: 'string' }, city: { type: 'string' }, weekly_budget: { type: 'number' } }, ['business_type', 'city', 'weekly_budget']),
  run: ({ business_type, city, weekly_budget }, ctx) => {
    const channel = (Object.keys(PLATFORMS) as ChannelId[]).find((c) => PLATFORMS[c].agent === ctx.agent.id)!;
    const b = BUSINESSES.find((x) => x.type.toLowerCase() === String(business_type).toLowerCase() && x.city.toLowerCase() === String(city).toLowerCase())
      ?? BUSINESSES.find((x) => x.type.toLowerCase() === String(business_type).toLowerCase());
    if (!b) return { available: false, reason: 'No benchmark for that business type.' };
    const w = Number(weekly_budget);
    const n = customers(b, channel, w, 1, 0.25);
    const notes: Record<ChannelId, string> = {
      search: 'No superlatives without proof; headline up to 30 characters.',
      social: 'Image text under 20% of the image; no before/after claims.',
      maps: 'Offer must be redeemable in store; listing hours must be accurate.',
      chat: 'Shown only as a labeled sponsored suggestion below the answer; never on health or finance questions; never to users under 18.',
    };
    return { platform: PLATFORMS[channel].org, available: true, weekly_budget: w, expected_customers_per_week: Number(n.toFixed(1)), cost_per_customer_usd: Number((w / n).toFixed(2)), policy: notes[channel] };
  },
};

function campaign(ctx: RunContext, businessId?: unknown, monthlyBudget?: unknown): Campaign {
  let c = ctx.state.campaign as Campaign | undefined;
  if (!c) {
    if (businessId === undefined) throw new Error('No campaign yet. Call plan_launch_split first.');
    const b = needBusiness(businessId);
    const scores = (ctx.state.creativeScores as number[] | undefined) ?? [];
    const avg = scores.length ? scores.reduce((s, x) => s + x, 0) / scores.length : 80;
    c = new Campaign(b, Number(monthlyBudget ?? b.monthlyBudget), 0.6 + 0.5 * (avg / 100));
    ctx.state.campaign = c;
  }
  return c;
}

const planLaunch: ToolDef = {
  name: 'plan_launch_split',
  description: 'Create the campaign and get the benchmark-based weekly budget split across channels, accounting for diminishing returns.',
  input_schema: obj({ business_id: { type: 'string' }, monthly_budget: { type: 'number' } }, ['business_id', 'monthly_budget']),
  run: ({ business_id, monthly_budget }, ctx) => {
    const c = campaign(ctx, business_id, monthly_budget);
    const split = c.launchPlan();
    return { weekly_budget: c.weekly, weeks: 4, launch_split: roundAlloc(split) };
  },
};

const roundAlloc = (a: Allocation) => Object.fromEntries(Object.entries(a).map(([k, v]) => [k, Math.round(v * 100) / 100])) as Allocation;

const allocSchema = {
  type: 'object',
  properties: Object.fromEntries(CHANNELS.map((c) => [c.id, { type: 'number' }])),
  required: CHANNELS.map((c) => c.id),
  additionalProperties: false,
};

const runWeek: ToolDef = {
  name: 'run_week',
  description: 'Run the next campaign week with this split (must total the weekly budget). Returns customers and cost per customer by channel.',
  input_schema: obj({ allocation: allocSchema }, ['allocation']),
  run: ({ allocation }, ctx) => campaign(ctx).runWeek(allocation as Allocation),
};

const replan: ToolDef = {
  name: 'replan_split',
  description: 'Best split for next week given everything learned so far. Also returns current beliefs per channel (1.0 = as benchmarked).',
  input_schema: obj({}, []),
  run: (_i, ctx) => {
    const c = campaign(ctx);
    return { next_split: roundAlloc(c.replan()), belief_vs_benchmark: Object.fromEntries(Object.entries(c.belief).map(([k, v]) => [k, Number(v.toFixed(2))])) };
  },
};

const compare: ToolDef = {
  name: 'compare_to_even_split',
  description: 'Compare customers won so far with what an even split would have won over the same weeks and market conditions.',
  input_schema: obj({}, []),
  run: (_i, ctx) => {
    const c = campaign(ctx);
    const actual = Number(c.history.reduce((s, w) => s + w.total_customers, 0).toFixed(1));
    const even = c.evenSplitBaseline();
    const spend = c.weekly * c.history.length;
    return {
      weeks_run: c.history.length,
      customers: actual,
      even_split_customers: even,
      lift_pct: Number(((actual / even - 1) * 100).toFixed(1)),
      cost_per_customer_usd: Number((spend / actual).toFixed(2)),
      even_split_cost_per_customer_usd: Number((spend / even).toFixed(2)),
      revenue_90d_usd: Math.round(actual * c.business.customerValue90d),
    };
  },
};

export const TOOLS: Record<string, ToolDef> = Object.fromEntries(
  [HANDOFF, SAVE_ARTIFACT, getUsage, simPricing, estAds, checkPolicy, sizeExp, getSignals, getBenchmarks, genCreatives, scoreAd, requestQuote, quoteInventory, planLaunch, runWeek, replan, compare].map((t) => [t.name, t]),
);

export { PLATFORMS };
