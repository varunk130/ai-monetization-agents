/**
 * Replay policies: scripted decisions, real tools. Every number in an answer
 * comes from a tool result (or, for the memo table, the same model the tools
 * call with the same inputs).
 */
import type { Policy } from '../agent/drivers';
import { BUSINESSES, CHANNELS } from '../data/businesses';
import { estimateAds, simulatePricing, type AdOption, type PricingOption } from '../lib/monetization';
import type { Allocation } from '../lib/plan';

const usd = (n: number) => (Math.abs(n) >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : Math.abs(n) >= 1000 ? `$${Math.round(n / 1000)}K` : `$${n.toFixed(2)}`);
const pct = (n: number) => `${n}%`;
const h = (v: { results: Record<string, unknown[]> }) => (v.results.handoff ?? []) as string[];
const bizIn = (t: string) => BUSINESSES.find((b) => b.id === t.match(/business_id=([a-z]+)/)?.[1]) ?? BUSINESSES[0];
const budgetIn = (t: string) => Number(t.match(/monthly_budget=(\d+)/)?.[1] ?? 1200);

/* ---------------- Monetization ---------------- */

const PRICING_OPTIONS: PricingOption[] = [
  { free_daily_limit: null, pro_price: 12, free_on_small_model: false },
  { free_daily_limit: null, pro_price: 12, free_on_small_model: true },
  { free_daily_limit: 25, pro_price: 12, free_on_small_model: true },
  { free_daily_limit: 15, pro_price: 12, free_on_small_model: true },
  { free_daily_limit: 15, pro_price: 15, free_on_small_model: true },
];
const AD_OPTIONS: AdOption[] = [
  { min_intent: 0.25, exclude_sensitive: false, exclude_minors: false, ad_load: 0.8 },
  { min_intent: 0.4, exclude_sensitive: true, exclude_minors: true, ad_load: 0.5 },
  { min_intent: 0.4, exclude_sensitive: true, exclude_minors: true, ad_load: 0.3 },
];
const describePricing = (o: PricingOption) =>
  [o.free_on_small_model ? 'free queries on the small model' : 'current model mix', o.free_daily_limit ? `${o.free_daily_limit}/day free limit` : 'no free limit', `Pro at $${o.pro_price}`].join(', ');
const describeAds = (o: AdOption) =>
  `ads on answers with commercial intent of at least ${Math.round(o.min_intent * 100)}%, ad load ${Math.round(o.ad_load * 100)}%${o.exclude_sensitive ? ', no ads on sensitive topics' : ', including health and money questions'}${o.exclude_minors ? ', never to users under 18' : ''}`;

type PricingRow = ReturnType<typeof simulatePricing>;
type AdRow = ReturnType<typeof estimateAds>;

const monetizationLead: Policy = (v, turn) => {
  const hs = h(v);
  if (v.results.save_artifact) {
    return { final: 'Memo saved. Recommendation: route free traffic to the small model, add a 15-query daily limit with Pro at $15, and add safe sponsored cards on shopping and travel answers, tested in stages.' };
  }
  if (turn === 0) return { say: 'Starting with the playbook.', call: [{ name: 'load_skill', input: { name: 'monetization-playbook' } }] };
  if (hs.length === 0) return { call: [{ name: 'handoff', input: { agent_id: 'usage_analyst', task: 'What does a free Lumen Notes user cost us to serve, and where does that cost concentrate?' } }] };
  if (hs.length === 1)
    return {
      say: 'Free users cost real money and heavy users drive much of it. Asking pricing and ads in parallel.',
      call: [
        { name: 'handoff', input: { agent_id: 'pricing_analyst', task: `Context from usage analysis:\n${hs[0]}\n\nPropose free-limit, model-routing, and Pro price options and recommend one.` } },
        { name: 'handoff', input: { agent_id: 'ads_strategist', task: 'Find the ad setting for the free tier that earns the most revenue.' } },
      ],
    };
  const blocked = hs.some((x) => /^\**Blocked/i.test(x));
  const reviews = hs.filter((x) => /^\**(Approved|Blocked)/i.test(x));
  const lastReview = reviews[reviews.length - 1];
  const latestAds = [...hs].reverse().find((x) => /^Recommend ads:/.test(x)) ?? '';
  const proposal = `Pricing: ${hs[1]}\n\nAds: ${latestAds}`;
  if (reviews.length === 0) return { call: [{ name: 'handoff', input: { agent_id: 'risk_reviewer', task: `Review this proposal before it ships:\n\n${proposal}` } }] };
  if (/^\**Blocked/i.test(lastReview) && !hs.some((x) => /^Recommend ads:.*no ads on sensitive/.test(x)))
    return {
      say: 'Trust review blocked the ad setting. Sending it back.',
      call: [{ name: 'handoff', input: { agent_id: 'ads_strategist', task: `The trust reviewer blocked your recommendation. Fix the finding and re-estimate:\n\n${lastReview}` } }],
    };
  if (/^\**Blocked/i.test(lastReview)) return { call: [{ name: 'handoff', input: { agent_id: 'risk_reviewer', task: `Re-review the revised proposal:\n\n${proposal}` } }] };
  if (!hs.some((x) => /^\*\*Primary metric/.test(x)))
    return { say: 'Approved. Sizing the test.', call: [{ name: 'handoff', input: { agent_id: 'experiment_designer', task: `Design the test for this plan. Today about 4% of free users convert to Pro in a month; we care about a 10% relative lift.\n\n${proposal}` } }] };

  // Write the memo.
  const pr = PRICING_OPTIONS.map(simulatePricing);
  const ad = AD_OPTIONS.map(estimateAds);
  const base = pr[0];
  const best = pr[4];
  const safeAds = ad[1];
  const exp = hs[hs.length - 1];
  const memo = [
    '# Monetization recommendation: Lumen Notes free tier',
    `**Recommendation.** Cut cost first, then charge: route free queries to the small model, add a visible 15-query daily limit for free users, raise Pro to $15, and add labeled sponsored cards on shopping and travel answers only. Together: **${usd(best.monthly_net_usd - base.monthly_net_usd + safeAds.monthly_ad_revenue_usd)} more net per month** than today (${usd(base.monthly_net_usd)} → ${usd(best.monthly_net_usd + safeAds.monthly_ad_revenue_usd)}).`,
    '## Options compared',
    [
      '| Option | Net / month | Hit limit | Users lost / month |',
      '|---|---|---|---|',
      ...pr.map(
        (r) =>
          `| ${r.option.free_on_small_model ? 'Small model' : 'Today'}, ${r.option.free_daily_limit ? `${r.option.free_daily_limit}/day` : 'no limit'}, $${r.option.pro_price} | ${usd(r.monthly_net_usd)} | ${pct(r.free_users_hitting_limit_pct)} | ${r.free_dau_lost_per_month.toLocaleString()} |`,
      ),
    ].join('\n'),
    [
      '| Ad setting | Revenue / month | Answers with ad | Churn | Sensitive |',
      '|---|---|---|---|---|',
      ...ad.map((r) => `| Intent ${Math.round(r.option.min_intent * 100)}%+, load ${Math.round(r.option.ad_load * 100)}% | ${usd(r.monthly_ad_revenue_usd)} | ${pct(r.share_of_free_answers_with_ad_pct)} | ${pct(r.est_free_user_churn_pct)} | ${r.ads_on_sensitive_topics ? 'yes' : 'no'} |`),
    ].join('\n'),
    '## Guardrails',
    [
      '- No ads on health, money, or mental-health questions; none for users under 18.',
      '- Sponsored cards sit below the answer, labeled, and never change it.',
      '- Show the daily limit and what Pro unlocks before users reach it.',
      ...(blocked ? [`- Trust review blocked the first ad proposal (${ad[0].est_free_user_churn_pct}% churn, ads on sensitive topics). The approved setting earns ${usd(ad[0].monthly_ad_revenue_usd - safeAds.monthly_ad_revenue_usd)} less a month and is the right trade.`] : []),
    ].join('\n'),
    '## Experiment plan',
    exp,
    '## Not doing',
    [
      `- The revenue-maximizing ad setting (${usd(ad[0].monthly_ad_revenue_usd)}/month): it puts ads next to health and money questions and roughly ${Math.round(ad[0].est_free_user_churn_pct / safeAds.est_free_user_churn_pct)}x the churn.`,
      '- A price increase without a usage limit: it charges loyal users without touching the cost driver.',
    ].join('\n'),
  ].join('\n\n');
  return { call: [{ name: 'save_artifact', input: { title: 'Monetization memo: Lumen Notes', markdown: memo } }] };
};

const usageAnalyst: Policy = (v, turn) => {
  if (turn === 0) return { call: [{ name: 'load_skill', input: { name: 'unit-economics' } }, { name: 'get_usage_metrics', input: {} }] };
  const u = v.last<ReturnType<typeof import('../lib/monetization').unitEconomics>>('get_usage_metrics')!;
  return {
    final: [
      `Cost per query ${'$'}${u.cost_per_query_usd}. A free daily user costs ${usd(u.free_cost_per_dau_month_usd)}/month; free serving is ${usd(u.monthly_free_serving_cost_usd)}/month across ${u.free_dau.toLocaleString()} free DAU.`,
      `Pro: ${u.pro_subscribers.toLocaleString()} subscribers (${(u.pro_conversion_of_mau * 100).toFixed(1)}% of MAU) bring ${usd(u.monthly_pro_revenue_usd)} against ${usd(u.monthly_pro_serving_cost_usd)} serving cost. Net ${usd(u.monthly_net_usd)}/month.`,
      `The heaviest 8% of free users drive ${Math.round(u.heaviest_8pct_of_free_users_share_of_free_cost * 100)}% of free cost.`,
      'Biggest levers: route free queries to the small model, and cap the heaviest free usage.',
    ].join('\n'),
  };
};

const pricingAnalyst: Policy = (v, turn) => {
  if (turn === 0) return { call: [{ name: 'load_skill', input: { name: 'pricing-packaging' } }, { name: 'simulate_pricing', input: { options: PRICING_OPTIONS } }] };
  const rows = v.last<PricingRow[]>('simulate_pricing')!;
  const ok = rows.filter((r) => r.free_users_hitting_limit_pct < 25);
  const best = ok.reduce((a, b) => (b.monthly_net_usd > a.monthly_net_usd ? b : a), ok[0]);
  const base = rows[0];
  return {
    final: [
      `Recommend: ${describePricing(best.option)}. Monthly net ${usd(best.monthly_net_usd)} vs ${usd(base.monthly_net_usd)} today (+${usd(best.monthly_net_usd - base.monthly_net_usd)}).`,
      `${best.free_users_hitting_limit_pct}% of free users would hit the limit; about ${best.free_dau_lost_per_month.toLocaleString()} free users lost per month.`,
      `Model routing alone is worth +${usd(rows[1].monthly_net_usd - base.monthly_net_usd)} with no visible change for users, so ship it first.`,
    ].join('\n'),
  };
};

const adsStrategist: Policy = (v, turn) => {
  if (turn === 0) return { call: [{ name: 'load_skill', input: { name: 'conversational-ads' } }, { name: 'estimate_ad_revenue', input: { options: AD_OPTIONS } }] };
  const rows = v.last<AdRow[]>('estimate_ad_revenue')!;
  const fixing = /blocked/i.test(v.task);
  const pick = fixing
    ? rows.filter((r) => !r.ads_on_sensitive_topics && r.est_free_user_churn_pct < 0.5).reduce((a, b) => (b.monthly_ad_revenue_usd > a.monthly_ad_revenue_usd ? b : a))
    : rows.reduce((a, b) => (b.monthly_ad_revenue_usd > a.monthly_ad_revenue_usd ? b : a));
  return {
    final: `Recommend ads: ${describeAds(pick.option)}. ${usd(pick.monthly_ad_revenue_usd)}/month at a ${'$'}${pick.cpm_usd} CPM, an ad on ${pick.share_of_free_answers_with_ad_pct}% of free answers, estimated churn ${pick.est_free_user_churn_pct}%.${fixing ? ' Revised after trust review: sensitive topics and minors excluded.' : ''}`,
  };
};

const riskReviewer: Policy = (v, turn) => {
  if (turn === 0) return { call: [{ name: 'load_skill', input: { name: 'trust-review' } }, { name: 'check_policy', input: { proposal: v.task } }] };
  const r = v.last<{ approved: boolean; findings: { severity: string; issue: string }[] }>('check_policy')!;
  if (r.approved && r.findings.length === 0) return { final: '**Approved.** No trust or policy findings. Keep sponsored cards labeled and below the answer.' };
  return {
    final: [
      `**${r.approved ? 'Approved' : 'Blocked'}.**`,
      ...r.findings.map((f) => `- ${f.severity === 'block' ? 'Block' : 'Warn'}: ${f.issue}`),
      r.approved ? '' : 'Fix: exclude health, money, and mental-health topics and users under 18, and keep ad load at or below half of eligible answers.',
    ].filter(Boolean).join('\n'),
  };
};

const experimentDesigner: Policy = (v, turn) => {
  if (turn === 0) return { call: [{ name: 'load_skill', input: { name: 'experiment-design' } }, { name: 'size_experiment', input: { baseline_rate: 0.04, min_relative_lift: 0.1, traffic_share_per_arm: 0.05 } }] };
  const s = v.last<{ users_per_arm: number; days_needed: number; daily_users_per_arm: number }>('size_experiment')!;
  return {
    final: [
      '**Primary metric**: free-to-Pro conversion within 30 days (baseline 4%).',
      '**Guardrails**: 7-day free retention may not drop more than 1 point; stop if complaint rate doubles.',
      `**Sample**: ${s.users_per_arm.toLocaleString()} users per arm (5% of free traffic each, about ${s.daily_users_per_arm.toLocaleString()} a day) for ${s.days_needed} days to detect a 10% lift.`,
      '**Stages**: (1) model routing, no test needed beyond quality checks; (2) daily limit + $15 Pro vs control; (3) sponsored cards on shopping and travel vs control.',
      '**Decision rule**: ship a stage if conversion or net revenue per user improves by 10% or more and no guardrail breaks.',
    ].join('\n'),
  };
};

/* ---------------- Local campaign ---------------- */

const campaignStrategist: Policy = (v, turn) => {
  const b = bizIn(v.task);
  const budget = budgetIn(v.task);
  const hs = h(v);
  const ids = `business_id=${b.id}, monthly_budget=${budget}`;
  if (v.results.save_artifact) return { final: `Report saved for ${b.name}. ${hs[3]?.split('\n')[0] ?? ''}` };
  if (turn === 0) return { say: 'Loading the campaign playbook.', call: [{ name: 'load_skill', input: { name: 'local-campaign-playbook' } }] };
  if (hs.length === 0) return { call: [{ name: 'handoff', input: { agent_id: 'market_researcher', task: `Research the local market for ${b.name} (${ids}).` } }] };
  if (hs.length === 1) return { call: [{ name: 'handoff', input: { agent_id: 'creative_director', task: `Write and check ads for ${b.name} (${ids}). Research:\n${hs[0]}` } }] };
  if (hs.length === 2) return { call: [{ name: 'handoff', input: { agent_id: 'media_buyer', task: `Get quotes from all four ad platforms and set the launch split for ${b.name} (${ids}).` } }] };
  if (hs.length === 3) {
    const split = hs[2].match(/Launch split: (\{.*\})/)?.[1] ?? '{}';
    return { say: 'Media is bought. Running the month.', call: [{ name: 'handoff', input: { agent_id: 'performance_analyst', task: `Run the 4-week campaign for ${b.name} (${ids}). Launch split: ${split}` } }] };
  }
  const report = [
    `# Campaign report: ${b.name}, month 1`,
    `**${b.type} in ${b.neighborhood}, ${b.city}. Budget $${budget.toLocaleString()}. Goal: ${b.goal.toLowerCase()}.**`,
    '## Results',
    hs[3],
    '## Local market',
    hs[0],
    '## Ads that ran',
    hs[1],
    '## Media bought',
    hs[2].replace(/\nLaunch split: .*$/, ''),
    '## Next month',
    '1. Keep the learned split as the starting point; re-test the weakest channel with 10% of budget.',
    '2. Refresh the lead ad after week 2 to avoid fatigue.',
    '3. Time spend to the demand peaks above.',
  ].join('\n\n');
  return { call: [{ name: 'save_artifact', input: { title: `Campaign report: ${b.name}`, markdown: report } }] };
};

const marketResearcher: Policy = (v, turn) => {
  const b = bizIn(v.task);
  const budget = budgetIn(v.task);
  if (turn === 0)
    return {
      call: [
        { name: 'load_skill', input: { name: 'local-market-research' } },
        { name: 'get_local_signals', input: { business_id: b.id } },
        { name: 'get_benchmarks', input: { business_id: b.id, monthly_spend_per_channel: budget / 4 } },
      ],
    };
  const s = v.last<{ peak: string; competitors: string; events: string }>('get_local_signals')!;
  const bm = v.last<{ channel: string; expected_customers: number; cost_per_customer_usd: number }[]>('get_benchmarks')!;
  const best = bm.reduce((a, x) => (x.cost_per_customer_usd < a.cost_per_customer_usd ? x : a));
  return {
    final: [
      `**Demand**: ${s.peak}.`,
      `**Competition**: ${s.competitors}.`,
      `**Moments**: ${s.events}.`,
      `**Benchmarks** at $${budget / 4}/channel: ${bm.map((x) => `${x.channel.split(' ')[0]} $${x.cost_per_customer_usd}`).join(', ')} per customer. Benchmarks favor ${best.channel}.`,
      '**Caution**: benchmarks are for the business type, not this neighborhood; expect real costs to differ by channel.',
    ].join('\n'),
  };
};

const creativeDirector: Policy = (v, turn) => {
  const b = bizIn(v.task);
  if (turn === 0) return { call: [{ name: 'load_skill', input: { name: 'ad-creative' } }, { name: 'generate_creatives', input: { business_id: b.id } }] };
  const cs = v.last<{ angle: string; headline: string; body: string; cta: string }[]>('generate_creatives')!;
  if (turn === 1) return { call: cs.map((c) => ({ name: 'score_creative', input: { business_id: b.id, headline: c.headline, body: c.body, cta: c.cta } })) };
  const scores = (v.results.score_creative ?? []) as { score: number; predicted_ctr: number; policy_flags: unknown[] }[];
  const rows = cs.map((c, i) => ({ ...c, s: scores[i] }));
  const lead = rows.reduce((a, x) => (x.s.score > a.s.score ? x : a));
  return {
    final: [
      '| Angle | Headline | Score | Pred. CTR | Policy |',
      '|---|---|---|---|---|',
      ...rows.map((r) => `| ${r.angle} | ${r.headline} | ${r.s.score} | ${(r.s.predicted_ctr * 100).toFixed(1)}% | ${r.s.policy_flags.length ? 'flagged' : 'clear'} |`),
      '',
      `Lead with **${lead.angle}**: “${lead.headline}”.`,
    ].join('\n'),
  };
};

const mediaBuyer: Policy = (v, turn) => {
  const b = bizIn(v.task);
  const budget = budgetIn(v.task);
  const perPlatform = budget / 4 / 4;
  if (turn === 0) return { call: [{ name: 'load_skill', input: { name: 'media-buying' } }] };
  if (turn === 1)
    return {
      say: 'Requesting quotes from four ad platforms.',
      call: CHANNELS.map((c) => ({
        name: 'request_quote',
        input: { platform: c.id, message: `Quote request from Adloom.\nBusiness type: ${b.type}\nCity: ${b.city}\nWeekly budget: $${perPlatform}\nGoal: ${b.goal}` },
      })),
    };
  if (turn === 2) return { call: [{ name: 'plan_launch_split', input: { business_id: b.id, monthly_budget: budget } }] };
  const quotes = (v.results.request_quote ?? []) as string[];
  const split = v.last<{ weekly_budget: number; launch_split: Allocation }>('plan_launch_split')!;
  return {
    final: [
      ...CHANNELS.map((c, i) => `- **${c.short}**: ${(quotes[i] ?? '').split('\n').find((l) => /Expected/.test(l))?.replace(/^\W+/, '') ?? 'no quote'}`),
      `Weekly budget $${split.weekly_budget}. Launch split: ${CHANNELS.map((c) => `${c.short} $${split.launch_split[c.id]}`).join(', ')}.`,
      `Launch split: ${JSON.stringify(split.launch_split)}`,
    ].join('\n'),
  };
};

const platformAgent: Policy = (v, turn) => {
  const type = v.task.match(/Business type: (.+)/)?.[1]?.trim() ?? '';
  const city = v.task.match(/City: (.+)/)?.[1]?.trim() ?? '';
  const weekly = Number(v.task.match(/Weekly budget: \$([\d.]+)/)?.[1] ?? 0);
  if (turn === 0) return { call: [{ name: 'load_skill', input: { name: 'inventory-quoting' } }, { name: 'quote_inventory', input: { business_type: type, city, weekly_budget: weekly } }] };
  const q = v.last<{ available: boolean; expected_customers_per_week?: number; cost_per_customer_usd?: number; policy?: string; reason?: string }>('quote_inventory')!;
  if (!q.available) return { final: `**Available**: no. ${q.reason}` };
  return { final: [`**Available**: yes.`, `Expected: ${q.expected_customers_per_week} customers/week at $${weekly}, about $${q.cost_per_customer_usd} each.`, `Policy: ${q.policy}`].join('\n') };
};

const performanceAnalyst: Policy = (v, turn) => {
  const launch = JSON.parse(v.task.match(/Launch split: (\{.*\})/)?.[1] ?? '{}') as Allocation;
  const weeks = (v.results.run_week ?? []) as { week: number; total_customers: number; cost_per_customer: Record<string, number | null> }[];
  const replans = (v.results.replan_split ?? []) as { next_split: Allocation; belief_vs_benchmark: Record<string, number> }[];
  if (turn === 0) return { call: [{ name: 'load_skill', input: { name: 'weekly-optimization' } }, { name: 'run_week', input: { allocation: launch } }] };
  if (weeks.length < 4 && replans.length < weeks.length) return { call: [{ name: 'replan_split', input: {} }] };
  if (weeks.length < 4) {
    const prev = weeks[weeks.length - 1];
    const next = replans[replans.length - 1].next_split;
    const cpas = Object.entries(prev.cost_per_customer).filter(([, x]) => x !== null) as [string, number][];
    const cheapest = cpas.reduce((a, x) => (x[1] < a[1] ? x : a));
    const priciest = cpas.reduce((a, x) => (x[1] > a[1] ? x : a));
    return {
      say: `Week ${prev.week}: ${prev.total_customers} customers. ${CHANNELS.find((c) => c.id === cheapest[0])!.short} cost $${cheapest[1]} per customer vs $${priciest[1]} on ${CHANNELS.find((c) => c.id === priciest[0])!.short}. Shifting budget.`,
      call: [{ name: 'run_week', input: { allocation: next } }],
    };
  }
  if (!v.results.compare_to_even_split) return { call: [{ name: 'compare_to_even_split', input: {} }] };
  const c = v.last<{ customers: number; even_split_customers: number; lift_pct: number; cost_per_customer_usd: number; even_split_cost_per_customer_usd: number; revenue_90d_usd: number }>('compare_to_even_split')!;
  const belief = replans[replans.length - 1].belief_vs_benchmark;
  return {
    final: [
      `**${Math.round(c.customers)} new customers** in 4 weeks, ${c.lift_pct}% more than an even split (${Math.round(c.even_split_customers)}). Cost per customer $${c.cost_per_customer_usd} vs $${c.even_split_cost_per_customer_usd}. Expected 90-day revenue: $${c.revenue_90d_usd.toLocaleString()}.`,
      '',
      '| Week | Customers |',
      '|---|---|',
      ...weeks.map((w) => `| ${w.week} | ${w.total_customers} |`),
      '',
      'Learned vs benchmark: ' + CHANNELS.map((ch) => `${ch.short} ${belief[ch.id] >= 1 ? '+' : ''}${Math.round((belief[ch.id] - 1) * 100)}%`).join(', ') + '.',
    ].join('\n'),
  };
};

export const POLICIES: Record<string, Policy> = {
  monetization_lead: monetizationLead,
  usage_analyst: usageAnalyst,
  pricing_analyst: pricingAnalyst,
  ads_strategist: adsStrategist,
  risk_reviewer: riskReviewer,
  experiment_designer: experimentDesigner,
  campaign_strategist: campaignStrategist,
  market_researcher: marketResearcher,
  creative_director: creativeDirector,
  media_buyer: mediaBuyer,
  performance_analyst: performanceAnalyst,
  platform_search: platformAgent,
  platform_social: platformAgent,
  platform_maps: platformAgent,
  platform_chat: platformAgent,
};
