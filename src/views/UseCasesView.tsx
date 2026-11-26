import { useState } from 'react';
import '../case-study.css';

type Area = 'Monetization' | 'Advertising' | 'Growth';

interface UseCase {
  area: Area;
  who: string;
  title: string;
  problem: string;
  agents: string;
  newSkill: string;
  metric: string;
  live?: string;
}

const CASES: UseCase[] = [
  {
    area: 'Monetization', who: 'Consumer AI app', live: 'monetize',
    title: 'Make the free tier pay for itself',
    problem: 'Every free answer costs compute. Pick the mix of model routing, limits, pricing, and ads that covers it without losing users.',
    agents: 'Usage Analyst, Pricing Analyst, Ads Strategist, Trust Reviewer, Experiment Designer',
    newSkill: 'None: running in the demo',
    metric: 'Net revenue per free user',
  },
  {
    area: 'Advertising', who: 'Local business', live: 'coffee',
    title: 'Run a month of local ads across platforms',
    problem: 'Owners split budget evenly and never move it. Agents buy across search, social, maps, and AI assistants and reallocate weekly.',
    agents: 'Market Researcher, Creative Director, Media Buyer, Performance Analyst, platform agents',
    newSkill: 'None: running in the demo',
    metric: 'Cost per new customer',
  },
  {
    area: 'Advertising', who: 'Retailer',
    title: 'Launch sponsored products in an AI shopping assistant',
    problem: 'A retailer wants brands to pay for placement in its shopping assistant, without the assistant recommending worse products.',
    agents: 'Ads Strategist, Trust Reviewer, Experiment Designer, plus brand agents bidding via A2A',
    newSkill: 'retail-media-auction: relevance-weighted bidding with a quality floor',
    metric: 'Ad revenue per shopping session, with conversion held flat',
  },
  {
    area: 'Monetization', who: 'B2B AI API company',
    title: 'Design usage-based pricing for an AI API',
    problem: 'Customers’ usage varies 100x. Flat seats lose money on heavy users; pure metering scares buyers.',
    agents: 'Usage Analyst, Pricing Analyst, Experiment Designer, Trust Reviewer (fairness)',
    newSkill: 'usage-pricing: commits, overages, and discount tiers',
    metric: 'Gross margin by customer segment',
  },
  {
    area: 'Monetization', who: 'News or content publisher',
    title: 'Monetize content that appears inside AI answers',
    problem: 'Traffic falls as AI summarizes articles. Choose between licensing, sponsored answers, and paywalls by topic.',
    agents: 'Usage Analyst, Pricing Analyst, Ads Strategist, Trust Reviewer',
    newSkill: 'content-licensing: per-query and flat-fee deal models',
    metric: 'Revenue per thousand AI citations',
  },
  {
    area: 'Advertising', who: 'Ad platform trust team',
    title: 'Review AI-generated ads before they serve',
    problem: 'Advertisers now generate thousands of ad variants a day. Human review can’t keep up with policy checks.',
    agents: 'Trust Reviewer, Creative Director (fixes), with escalation to a person',
    newSkill: 'ad-policy-review: platform rules, restricted categories, appeals',
    metric: 'Policy violations served per million ads',
  },
  {
    area: 'Growth', who: 'Multi-location franchise',
    title: 'Allocate one ad budget across 200 locations',
    problem: 'Head office splits budget by store count; some locations saturate while others starve.',
    agents: 'Market Researcher (per location), Media Buyer, Performance Analyst',
    newSkill: 'portfolio-allocation: budget across locations with shared learning',
    metric: 'New customers per dollar, network-wide',
  },
  {
    area: 'Growth', who: 'Marketplace sellers',
    title: 'An ads copilot for small sellers',
    problem: 'Most sellers on a marketplace never run promoted listings because bidding is confusing.',
    agents: 'Creative Director, Media Buyer, Performance Analyst, marketplace agent via A2A',
    newSkill: 'promoted-listings: keyword bids, ROAS targets',
    metric: 'Share of sellers advertising and their return on ad spend',
  },
  {
    area: 'Growth', who: 'Subscription app',
    title: 'Win back churned subscribers',
    problem: 'Discounts go to people who would have returned anyway. Target offers to who is actually at risk.',
    agents: 'Usage Analyst, Pricing Analyst, Experiment Designer, Trust Reviewer (no dark patterns)',
    newSkill: 'winback-offers: segments, offer ladders, holdouts',
    metric: 'Recovered revenue per offer sent',
  },
];

const TONE: Record<Area, string> = { Monetization: '#059669', Advertising: '#0891b2', Growth: '#1d4ed8' };

export function UseCasesView() {
  const [area, setArea] = useState<Area | 'All'>('All');
  const shown = CASES.filter((c) => area === 'All' || c.area === area);
  return (
    <div className="cs teal">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <h1>Use cases</h1>
          <p>
            The same agents, playbooks, and agent-to-agent model apply well beyond the two demo missions. Most new use cases reuse existing agents and
            add one new skill.
          </p>
        </div>
        <div className="seg" role="group" aria-label="Filter use cases">
          {(['All', 'Monetization', 'Advertising', 'Growth'] as const).map((a) => (
            <button key={a} aria-pressed={area === a} onClick={() => setArea(a)}>
              {a}
            </button>
          ))}
        </div>
      </div>
      <div className="uc-grid">
        {shown.map((c) => (
          <article className="uc" key={c.title} style={{ ['--tone' as string]: TONE[c.area] }}>
            <div className="uc-top">
              <div className="uc-who">
                {c.area} · {c.who}
              </div>
              <h3>{c.title}</h3>
              <p>{c.problem}</p>
            </div>
            <div className="uc-body">
              <div className="uc-row">
                <span className="l">Agents</span>
                <span>{c.agents}</span>
              </div>
              <div className="uc-row">
                <span className="l">New skill</span>
                <span>{c.newSkill}</span>
              </div>
            </div>
            <div className="uc-foot">
              <span className="uc-metric">Moves: {c.metric}</span>
              {c.live ? (
                <a className="uc-badge live" href="#/agents">
                  Live in demo →
                </a>
              ) : (
                <span className="uc-badge next">Next</span>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
