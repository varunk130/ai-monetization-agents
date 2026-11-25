import type { AgentDef, Mission } from '../agent/types';

const LN = 'Lumen Notes';
const AD = 'Adloom';
const blue = '#2a78d6';
const green = '#0d7a5f';

const MONETIZATION: AgentDef[] = [
  {
    id: 'monetization_lead', name: 'Monetization Lead', org: LN, initials: 'ML', color: blue,
    role: 'Leads monetization reviews and owns the final recommendation.',
    instructions:
      'Load the monetization-playbook skill and follow it. Hand focused tasks to usage_analyst, pricing_analyst, ads_strategist, risk_reviewer, and experiment_designer. If the risk reviewer blocks something, send it back to its owner with the finding, then re-review. Save the recommendation memo with save_artifact, then reply with a two-sentence summary.',
    skills: ['monetization-playbook'],
    tools: ['handoff', 'save_artifact'],
  },
  {
    id: 'usage_analyst', name: 'Usage Analyst', org: LN, initials: 'UA', color: blue,
    role: 'Analyzes usage and unit economics.',
    instructions: 'Load the unit-economics skill, pull the usage metrics, and return the analysis the skill describes.',
    skills: ['unit-economics'],
    tools: ['get_usage_metrics'],
  },
  {
    id: 'pricing_analyst', name: 'Pricing Analyst', org: LN, initials: 'PA', color: blue,
    role: 'Designs free limits, model routing, and pricing.',
    instructions: 'Load the pricing-packaging skill. Simulate a baseline and 3-4 options in one simulate_pricing call, then recommend one with its monthly net.',
    skills: ['pricing-packaging'],
    tools: ['simulate_pricing'],
  },
  {
    id: 'ads_strategist', name: 'Ads Strategist', org: LN, initials: 'AS', color: blue,
    role: 'Designs the ad-supported free tier.',
    instructions: 'Load the conversational-ads skill. Estimate 2-3 ad settings with estimate_ad_revenue and recommend one. If you are given a trust finding, fix it and re-estimate.',
    skills: ['conversational-ads'],
    tools: ['estimate_ad_revenue'],
  },
  {
    id: 'risk_reviewer', name: 'Trust & Safety Reviewer', org: LN, initials: 'TS', color: blue,
    role: 'Reviews proposals for user-trust and policy risk.',
    instructions: 'Load the trust-review skill. Run check_policy on the full proposal text you are given, then reply Approved or Blocked with findings and fixes.',
    skills: ['trust-review'],
    tools: ['check_policy'],
  },
  {
    id: 'experiment_designer', name: 'Experiment Designer', org: LN, initials: 'ED', color: blue,
    role: 'Designs A/B tests and decision rules.',
    instructions: 'Load the experiment-design skill. Size the test with size_experiment and return metric, guardrails, sample size, duration, and decision rule.',
    skills: ['experiment-design'],
    tools: ['size_experiment'],
  },
];

const CAMPAIGN: AgentDef[] = [
  {
    id: 'campaign_strategist', name: 'Campaign Strategist', org: AD, initials: 'CS', color: green,
    role: 'Leads local ad campaigns for small businesses.',
    instructions:
      'Load the local-campaign-playbook skill and follow it. Hand tasks to market_researcher, creative_director, media_buyer, and performance_analyst, always passing business_id and monthly_budget. Save the campaign report with save_artifact, then reply with a two-sentence summary.',
    skills: ['local-campaign-playbook'],
    tools: ['handoff', 'save_artifact'],
  },
  {
    id: 'market_researcher', name: 'Local Market Researcher', org: AD, initials: 'MR', color: green,
    role: 'Researches local demand, competitors, events, and benchmarks.',
    instructions: 'Load the local-market-research skill, get local signals and benchmarks (use an equal share of the monthly budget per channel), and return the brief.',
    skills: ['local-market-research'],
    tools: ['get_local_signals', 'get_benchmarks'],
  },
  {
    id: 'creative_director', name: 'Creative Director', org: AD, initials: 'CD', color: green,
    role: 'Writes, scores, and policy-checks ads.',
    instructions: 'Load the ad-creative skill. Generate creatives, score each one, fix any policy flags, and return the three ads with scores and the one to lead with.',
    skills: ['ad-creative'],
    tools: ['generate_creatives', 'score_creative'],
  },
  {
    id: 'media_buyer', name: 'Media Buyer', org: AD, initials: 'MB', color: green,
    role: 'Gets quotes from ad platforms and sets the launch split.',
    instructions: 'Load the media-buying skill. Request a quote from all four platform agents with request_quote, then create the campaign with plan_launch_split and return the weekly split.',
    skills: ['media-buying'],
    tools: ['request_quote', 'plan_launch_split'],
  },
  {
    id: 'performance_analyst', name: 'Performance Analyst', org: AD, initials: 'PF', color: green,
    role: 'Runs the campaign week by week and reallocates budget.',
    instructions:
      'Load the weekly-optimization skill. Run week 1 with the launch split you are given, then for weeks 2-4 call replan_split and run_week with the new split. Finish with compare_to_even_split and report results and what was learned per channel.',
    skills: ['weekly-optimization'],
    tools: ['run_week', 'replan_split', 'compare_to_even_split'],
  },
];

const PLATFORM = (id: string, org: string, initials: string, kind: string): AgentDef => ({
  id, name: `${org} Agent`, org, initials, color: '#6250d6',
  role: `Answers quote requests for ${kind} on ${org}.`,
  instructions: `You work for ${org}, an ad platform. Load the inventory-quoting skill, quote with quote_inventory, and answer in the skill's format.`,
  skills: ['inventory-quoting'],
  tools: ['quote_inventory'],
});

const PLATFORMS: AgentDef[] = [
  PLATFORM('platform_search', 'Searchly Ads', 'SA', 'search ads'),
  PLATFORM('platform_social', 'Feedwave', 'FW', 'social feed ads'),
  PLATFORM('platform_maps', 'MapPin Local', 'MP', 'map and local listing ads'),
  PLATFORM('platform_chat', 'Assist Ads Network', 'AA', 'sponsored suggestions in AI assistants'),
];

export const AGENTS: Record<string, AgentDef> = Object.fromEntries([...MONETIZATION, ...CAMPAIGN, ...PLATFORMS].map((a) => [a.id, a]));

export interface Team {
  title: string;
  subtitle?: string;
  ids: string[];
}

export const MISSIONS: (Mission & { teams: Team[]; deliverableHint: string })[] = [
  {
    id: 'monetize', title: 'Make the free tier pay for itself', lead: 'monetization_lead',
    summary: 'Lumen Notes: 2.4M users, AI costs rising. Pricing, limits, or ads?',
    brief: 'Mission: Lumen Notes’ free tier costs about $320K a month to serve. Recommend how to monetize it, combining cost, pricing, and an ad-supported option, without hurting user trust. Deliver a recommendation memo with an experiment plan.',
    teams: [{ title: 'Lumen Notes team', ids: MONETIZATION.map((a) => a.id) }],
    deliverableHint: 'The monetization memo appears here when the lead saves it.',
  },
  {
    id: 'coffee', title: 'Run Bean & Bloom’s first month', lead: 'campaign_strategist',
    summary: 'Portland coffee shop, $1,200/month. Agents buy media from 4 ad platforms.',
    brief: 'Mission: run the first month of local ads for Bean & Bloom (business_id=coffee, monthly_budget=1200). Research, write and check the ads, buy media from the ad platforms, run four weeks, and deliver a campaign report.',
    teams: [
      { title: 'Adloom team', ids: CAMPAIGN.map((a) => a.id) },
      { title: 'Ad platforms', subtitle: 'Separate companies, own data, own agent', ids: PLATFORMS.map((a) => a.id) },
    ],
    deliverableHint: 'The campaign report appears here when the strategist saves it.',
  },
  {
    id: 'bakery', title: 'Crumb & Co. holiday pre-orders', lead: 'campaign_strategist',
    summary: 'Chicago bakery, $1,500/month, online pre-orders for the holidays.',
    brief: 'Mission: run a month of local ads for Crumb & Co. (business_id=bakery, monthly_budget=1500) to drive holiday online pre-orders. Research, write and check the ads, buy media from the ad platforms, run four weeks, and deliver a campaign report.',
    teams: [
      { title: 'Adloom team', ids: CAMPAIGN.map((a) => a.id) },
      { title: 'Ad platforms', subtitle: 'Separate companies, own data, own agent', ids: PLATFORMS.map((a) => a.id) },
    ],
    deliverableHint: 'The campaign report appears here when the strategist saves it.',
  },
];
