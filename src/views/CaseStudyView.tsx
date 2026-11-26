import { useMemo } from 'react';
import { APP } from '../data/app';
import { BUSINESSES } from '../data/businesses';
import { estimateAds, simulatePricing, unitEconomics } from '../lib/monetization';
import { simulate } from '../lib/plan';
import { generateCreatives, scoreCreative } from '../lib/copy';
import { AGENTS, MISSIONS } from '../network/agents';
import { SKILLS } from '../agent/skills';
import { Rings } from '../components/Rings';
import '../case-study.css';

const SOURCES = [
  { n: 1, text: 'eMarketer, "AI search ads surge forward while advertisers wait for the proof," 2026 forecast (US AI search ad spending).', url: 'https://www.emarketer.com/content/ai-search-ads-surge-forward-while-advertisers-wait-proof' },
  { n: 2, text: 'eMarketer, "US Ad Spending 2025" (total US digital ad spending).', url: 'https://www.emarketer.com/content/us-ad-spending-2025' },
  { n: 3, text: 'Sensor Tower, State of Mobile 2026: generative AI apps more than tripled in-app revenue in 2025; ChatGPT alone earned $3.4B. Reported via TechCrunch, January 2026.', url: 'https://techcrunch.com/2026/01/21/consumers-spent-more-on-mobile-apps-than-games-in-2025-driven-by-ai-app-adoption/' },
];
const Ref = ({ n }: { n: number }) => (
  <sup>
    <a href={`#src-${n}`}>[{n}]</a>
  </sup>
);
const k = (n: number) => (Math.abs(n) >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n / 1000)}K`);

export function CaseStudyView() {
  const d = useMemo(() => {
    const ue = unitEconomics();
    const base = simulatePricing({ free_daily_limit: null, pro_price: 12, free_on_small_model: false });
    const best = simulatePricing({ free_daily_limit: 15, pro_price: 15, free_on_small_model: true });
    const aggressive = estimateAds({ min_intent: 0.25, exclude_sensitive: false, exclude_minors: false, ad_load: 0.8 });
    const safe = estimateAds({ min_intent: 0.4, exclude_sensitive: true, exclude_minors: true, ad_load: 0.5 });
    const campaigns = ['coffee', 'bakery'].map((id) => {
      const b = BUSINESSES.find((x) => x.id === id)!;
      const cs = generateCreatives(b);
      const lift = 0.6 + 0.5 * (cs.reduce((s, c) => s + scoreCreative(c, b).score, 0) / cs.length / 100);
      const r = simulate(b, b.monthlyBudget, lift);
      return { b, ai: r.ai.totalCustomers, even: r.even.totalCustomers, gain: r.ai.totalCustomers / r.even.totalCustomers - 1, cpa: r.ai.costPerCustomer, cpaEven: r.even.costPerCustomer };
    });
    return { ue, base, best, aggressive, safe, gainNet: best.monthly_net_usd + safe.monthly_ad_revenue_usd - base.monthly_net_usd, campaigns };
  }, []);

  const platforms = MISSIONS[1].teams[1].ids.map((id) => AGENTS[id]);
  const go = (hash: string) => (window.location.hash = hash);
  const [coffee, bakery] = d.campaigns;
  const pctTxt = (x: number) => `${Math.round(x * 100)}%`;

  return (
    <div className="cs teal">
      <nav className="present-steps" aria-label="Presentation flow">
        <span className="on">
          <b>1</b> The story · 2–4 min
        </span>
        <span className="arrow">→</span>
        <a href="#/agents">
          <b>2</b> Live demo
        </a>
        <span className="arrow">→</span>
        <a href="#/agents">
          <b>3</b> Outcome and artifact
        </a>
      </nav>
      <header className="cs-hero">
        <span className="cs-kicker">Case study · Ads and monetization · Multi-agent</span>
        <h1>Ads are moving into AI assistants. Both sides of that market need help, and agent teams can do the work.</h1>
        <p className="lede">
          AI apps must pay for every answer they give away, and small businesses must learn to buy a new kind of ad. Revenue Agents puts a team of
          AI agents on each side: one designs how an AI app should make money without losing user trust; the other runs a local business’s campaign,
          buying media from ad platforms’ own agents.
        </p>
        <div className="cs-hero-stats">
          <div className="cs-hero-stat">
            <div className="v">$26B</div>
            <div className="k">US AI search ad spend by 2029, up from ~$2B in 2026 [1]</div>
          </div>
          <div className="cs-hero-stat">
            <div className="v">3x+</div>
            <div className="k">growth in consumer spending in AI apps in 2025, to $4–5B [3]</div>
          </div>
          <div className="cs-hero-stat">
            <div className="v">+{k(d.gainNet)}</div>
            <div className="k">monthly net from the agents’ plan for a 2.4M-user AI app (demo data)</div>
          </div>
          <div className="cs-hero-stat">
            <div className="v">+{pctTxt(coffee.gain)}–{pctTxt(bakery.gain)}</div>
            <div className="k">more customers for local businesses vs. an even budget split (demo data)</div>
          </div>
        </div>
        <div className="cs-hero-actions">
          <button className="cs-btn" onClick={() => go('#/agents')}>
            ▶ Watch the agents work
          </button>
          <button className="cs-btn ghost" onClick={() => go('#/skills')}>
            Browse the skills
          </button>
        </div>
      </header>

      <section className="cs-section">
        <div className="cs-head">
          <span className="cs-num">1</span>
          <div>
            <h2>The problem</h2>
            <p>The AI era changes the economics on both sides of advertising.</p>
          </div>
        </div>
        <div className="cs-cards">
          <div className="cs-card" style={{ ['--tone' as string]: 'var(--cs-4)' }}>
            <div className="ico">$</div>
            <h3>Free users aren’t free anymore</h3>
            <p>
              Every AI answer costs compute. In the demo app, a free daily user costs ${d.ue.free_cost_per_dau_month_usd.toFixed(2)} a month, and the
              heaviest {pctTxt(0.08)} of free users drive {pctTxt(d.ue.heaviest_8pct_of_free_users_share_of_free_cost)} of that cost.
            </p>
          </div>
          <div className="cs-card" style={{ ['--tone' as string]: 'var(--cs-1)' }}>
            <div className="ico">!</div>
            <h3>Ads can break trust</h3>
            <p>
              The highest-revenue ad setting puts sponsors next to health and money questions and costs {d.aggressive.est_free_user_churn_pct}% of free
              users a month, versus {d.safe.est_free_user_churn_pct}% for a careful one.
            </p>
          </div>
          <div className="cs-card" style={{ ['--tone' as string]: 'var(--cs-2)' }}>
            <div className="ico">☕</div>
            <h3>Small advertisers are left behind</h3>
            <p>A coffee shop owner has no media team. They split budget evenly, never move it, and won’t know how to buy a sponsored spot inside an AI assistant.</p>
          </div>
        </div>
      </section>

      <section className="cs-section">
        <div className="cs-head">
          <span className="cs-num">2</span>
          <div>
            <h2>How big is the opportunity</h2>
            <p>AI assistants are becoming an ad surface inside a large existing market, while AI apps already earn billions from consumers.</p>
          </div>
        </div>
        <div className="cs-market">
          <div className="cs-rings">
            <Rings
              layers={[
                { label: 'TAM', value: '$362B', color: '#059669' },
                { label: 'SAM', value: '$26B', color: '#0891b2' },
                { label: 'FIRST SLICE', value: '~$2.6B', color: '#1d4ed8' },
              ]}
            />
          </div>
          <div>
            <div className="cs-layers">
              <div className="cs-layer">
                <span className="sw" style={{ background: '#059669' }} />
                <div>
                  <div className="t">Total market</div>
                  <div className="v">
                    $362B <Ref n={2} />
                  </div>
                  <div className="d">US digital ad spending in 2025: the budget AI surfaces will compete for.</div>
                </div>
              </div>
              <div className="cs-layer">
                <span className="sw" style={{ background: '#0891b2' }} />
                <div>
                  <div className="t">Serviceable: ads in AI answers</div>
                  <div className="v">
                    $26B by 2029 <Ref n={1} />
                  </div>
                  <div className="d">US AI search ad spending, about 14% of all search ads by 2029, up from 1.3% in 2026.</div>
                </div>
              </div>
              <div className="cs-layer">
                <span className="sw" style={{ background: '#1d4ed8' }} />
                <div>
                  <div className="t">First slice (our assumption)</div>
                  <div className="v">~$2.6B</div>
                  <div className="d">10% of AI search ads bought by small and local businesses, who most need an agent to buy for them.</div>
                </div>
              </div>
            </div>
            <div className="cs-growth" aria-label="US AI search ad spending">
              <div className="cs-growth-row">
                <span>2026</span>
                <div className="bar" style={{ width: `${(2.08 / 25.93) * 100}%` }} />
                <span className="val">$2.1B</span>
              </div>
              <div className="cs-growth-row">
                <span>2029 forecast</span>
                <div className="bar" style={{ width: '100%' }} />
                <span className="val">$25.9B</span>
              </div>
            </div>
          </div>
        </div>
        <p className="cs-note">
          On the publisher side, consumers spent $4–5B in generative AI apps in 2025, more than triple 2024, with ChatGPT alone at $3.4B <Ref n={3} />.
          Monetization design for AI apps covers that spend plus the ad revenue above. The first-slice figure is an illustrative assumption, not a
          forecast.
        </p>
      </section>

      <section className="cs-section">
        <div className="cs-head">
          <span className="cs-num">3</span>
          <div>
            <h2>Why now</h2>
          </div>
        </div>
        <div className="cs-cards">
          <div className="cs-card" style={{ ['--tone' as string]: 'var(--cs-1)' }}>
            <div className="big">12x</div>
            <h3>A new ad surface is opening</h3>
            <p>AI search ads are forecast to grow about twelve times from 2026 to 2029 [1]. The rules for doing it well are being written now.</p>
          </div>
          <div className="cs-card" style={{ ['--tone' as string]: 'var(--cs-4)' }}>
            <div className="big">Cost</div>
            <h3>AI margins depend on it</h3>
            <p>Unlike classic apps, AI apps pay for every free answer. Routing, limits, pricing, and ads have to be designed together.</p>
          </div>
          <div className="cs-card" style={{ ['--tone' as string]: 'var(--cs-2)' }}>
            <div className="big">A2A</div>
            <h3>Platforms are getting agents</h3>
            <p>When every ad platform exposes an agent, a small business’s agent can get quotes and buy across all of them in one pass.</p>
          </div>
        </div>
      </section>

      <section className="cs-section">
        <div className="cs-head">
          <span className="cs-num">4</span>
          <div>
            <h2>How it works</h2>
            <p>Two missions on one agent platform. Each step is an agent with its own skill and tools.</p>
          </div>
        </div>
        <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Mission A: monetize an AI app’s free tier</h3>
        <div className="cs-flow" style={{ ['--steps' as string]: 5 }}>
          {[
            ['Diagnose', `Usage Analyst: free users cost ${k(d.ue.monthly_free_serving_cost_usd)} a month to serve; heavy users drive the cost.`, 'var(--cs-1)'],
            ['Design', 'Pricing Analyst and Ads Strategist work in parallel: model routing, a daily limit, price, and a sponsored-card tier.', 'var(--cs-1)'],
            ['Review (blocked)', 'Trust & Safety Reviewer blocks the first ad plan: sponsors next to health and money questions.', 'var(--cs-4)'],
            ['Fix and re-review', 'Ads Strategist excludes sensitive topics and minors. Approved.', 'var(--cs-5)'],
            ['Decide', `Experiment plan sized, memo saved: +${k(d.gainNet)} net per month.`, 'var(--cs-1)'],
          ].map(([t, desc, tone], i) => (
            <div key={t} className={`cs-step${i === 2 ? ' ext' : ''}`} style={{ ['--tone' as string]: tone }}>
              <span className="n">{i + 1}</span>
              <h4>{t}</h4>
              <p>{desc}</p>
            </div>
          ))}
        </div>
        <h3 style={{ margin: '22px 0 10px', fontSize: 15 }}>Mission B: run a local business’s ads, buying media agent to agent</h3>
        <div className="cs-flow" style={{ ['--steps' as string]: 5 }}>
          {[
            ['Research', 'Local Market Researcher: demand peaks, competitors, events, channel benchmarks.', 'var(--cs-1)'],
            ['Create', 'Creative Director writes three ad angles, scores them, and clears ad policy.', 'var(--cs-1)'],
            ['Buy (A2A)', 'Media Buyer gets quotes from four ad platforms’ own agents, including AI assistant ads.', 'var(--cs-4)'],
            ['Run and learn', 'Performance Analyst runs 4 weeks, moving budget to the lowest cost per customer.', 'var(--cs-1)'],
            ['Report', `${Math.round(coffee.ai)} customers vs ${Math.round(coffee.even)} with an even split for ${coffee.b.name}.`, 'var(--cs-5)'],
          ].map(([t, desc, tone], i) => (
            <div key={t} className={`cs-step${i === 2 ? ' ext' : ''}`} style={{ ['--tone' as string]: tone }}>
              <span className="n">{i + 1}</span>
              <h4>{t}</h4>
              <p>{desc}</p>
            </div>
          ))}
        </div>
        <div className="cs-legend">
          <span>
            <i style={{ background: 'var(--cs-1)' }} />
            Team agents
          </span>
          <span>
            <i style={{ background: 'var(--cs-4)' }} />
            Governance or another company
          </span>
          <span>
            <i style={{ background: 'var(--cs-5)' }} />
            Outcome
          </span>
        </div>
      </section>

      <section className="cs-section">
        <div className="cs-head">
          <span className="cs-num">5</span>
          <div>
            <h2>The AI team</h2>
            <p>Three groups of agents, organized like the human teams they support. Each agent owns one job and hands its work to the next.</p>
          </div>
        </div>
        <div className="cs-lanes">
          {[
            {
              title: `Monetization team · ${APP.name}`,
              desc: 'Decides how the AI app makes money without losing user trust.',
              tone: '#059669',
              rows: [
                ['ML', 'Monetization Lead', 'Runs the review and makes the final call.'],
                ['UA', 'Usage Analyst', 'Works out what free users cost and why.'],
                ['PA', 'Pricing Analyst', 'Designs limits, plans, and prices.'],
                ['AS', 'Ads Strategist', 'Designs where sponsored answers can appear.'],
                ['TS', 'Trust & Safety Reviewer', 'Blocks anything that would hurt users.', 'gate'],
                ['ED', 'Experiment Designer', 'Plans the test that proves it works.'],
              ],
            },
            {
              title: 'Campaign team · agency',
              desc: 'Runs a small business’s advertising from research to results.',
              tone: '#0891b2',
              rows: [
                ['CS', 'Campaign Strategist', 'Owns the plan and the report.'],
                ['MR', 'Market Researcher', 'Learns the neighborhood, competitors, and peak hours.'],
                ['CD', 'Creative Director', 'Writes the ads and checks them against policy.'],
                ['MB', 'Media Buyer', 'Gets quotes from every ad platform and buys.'],
                ['PF', 'Performance Analyst', 'Moves budget to what works, every week.'],
              ],
            },
            {
              title: 'Ad platforms · separate companies',
              desc: 'Each platform has its own agent and keeps its own data.',
              tone: '#1d4ed8',
              rows: platforms.map((p) => [p.initials, p.org, p.id === 'platform_chat' ? 'Sells sponsored suggestions inside AI assistants.' : `Quotes prices and expected results on ${p.org}.`]),
            },
          ].map((lane) => (
            <div className="cs-lane" key={lane.title} style={{ ['--tone' as string]: lane.tone }}>
              <div className="cs-lane-head">
                <div className="t">{lane.title}</div>
                <div className="d">{lane.desc}</div>
              </div>
              <div className="cs-lane-rows">
                {lane.rows.map(([ini, name, what, kind]) => (
                  <div className={`cs-lane-row${kind === 'gate' ? ' gate' : ''}`} key={name}>
                    <span className="av">{ini}</span>
                    <div>
                      <div className="n">{name}</div>
                      <div className="w">{what}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="cs-team-foot">
          <div>
            <strong>Runs on written playbooks</strong>
            Each agent follows a short playbook (a “skill”) the business owns and can edit in plain language. {Object.keys(SKILLS).length} in total.
          </div>
          <div>
            <strong>Sees only what its job needs</strong>
            Agents can only use the systems their role requires, and other companies’ agents share only what they choose.
          </div>
          <div>
            <strong>Fully traceable</strong>
            Every decision, handoff, and number is recorded, so a person can see exactly why the team recommended what it did.
          </div>
        </div>
      </section>

      <section className="cs-section">
        <div className="cs-head">
          <span className="cs-num">6</span>
          <div>
            <h2>Results in the demo</h2>
            <p>Synthetic app and businesses; every number comes from the same models the agents call.</p>
          </div>
        </div>
        <div className="cs-results">
          <div className="cs-result">
            <div className="v">+{k(d.gainNet)}</div>
            <div className="k">monthly net for {APP.name}: {k(d.base.monthly_net_usd)} → {k(d.base.monthly_net_usd + d.gainNet)}</div>
          </div>
          <div className="cs-result">
            <div className="v">{Math.round(d.aggressive.est_free_user_churn_pct / d.safe.est_free_user_churn_pct)}x</div>
            <div className="k">churn avoided by the trust review: blocked plan vs. approved plan</div>
          </div>
          <div className="cs-result">
            <div className="v">+{pctTxt(coffee.gain)}</div>
            <div className="k">
              customers for {coffee.b.name}, ${coffee.cpa.toFixed(2)} vs ${coffee.cpaEven.toFixed(2)} each
            </div>
          </div>
          <div className="cs-result">
            <div className="v">+{pctTxt(bakery.gain)}</div>
            <div className="k">customers for {bakery.b.name}’s holiday pre-orders</div>
          </div>
        </div>
        <div className="table-wrap" style={{ marginTop: 18 }}>
          <table className="cs-compare">
            <thead>
              <tr>
                <th>Decision</th>
                <th>Typical approach</th>
                <th>With the agent team</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Cover AI serving cost</td>
                <td>Raise the price</td>
                <td>Route to a smaller model first, then a visible limit, then price</td>
              </tr>
              <tr>
                <td>Add ads</td>
                <td>Maximize ad revenue</td>
                <td>Ads only on shopping and travel, reviewed before launch</td>
              </tr>
              <tr>
                <td>Prove it</td>
                <td>Ship and watch</td>
                <td>Sized A/B test with guardrails and a decision rule</td>
              </tr>
              <tr>
                <td>Local media budget</td>
                <td>Split evenly, set and forget</td>
                <td>Quotes from every platform, reallocated weekly</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="cs-section">
        <div className="cs-head">
          <span className="cs-num">7</span>
          <div>
            <h2>Guardrails and risks</h2>
          </div>
        </div>
        <div className="cs-split">
          <ul className="cs-list">
            <li>
              <span>
                <strong>Answers stay independent.</strong> Sponsored cards sit below the answer, labeled; sponsors can’t influence it.
              </span>
            </li>
            <li>
              <span>
                <strong>No ads where they don’t belong.</strong> Health, money, mental health, and users under 18 are excluded by policy, enforced by a
                reviewer agent.
              </span>
            </li>
            <li>
              <span>
                <strong>Data stays with each company.</strong> Platform agents quote from their own data; the agency never shares revenue or margins.
              </span>
            </li>
          </ul>
          <ul className="cs-list warn">
            <li>
              <span>
                <strong>Models are estimates.</strong> Elasticity and churn are modeled; the experiment plan exists to replace them with measurements.
              </span>
            </li>
            <li>
              <span>
                <strong>One week is noisy.</strong> The campaign moves budget gradually and blends results with benchmarks.
              </span>
            </li>
            <li>
              <span>
                <strong>Humans approve.</strong> Pricing changes and spend above budget need a person to sign off.
              </span>
            </li>
          </ul>
        </div>
      </section>

      <section className="cs-section">
        <div className="cs-head">
          <span className="cs-num">8</span>
          <div>
            <h2>What’s next</h2>
          </div>
        </div>
        <div className="cs-roadmap">
          <div className="cs-phase" style={{ ['--tone' as string]: 'var(--cs-1)' }}>
            <div className="when">Pilot</div>
            <h4>Model routing and limits</h4>
            <p>Ship the zero-visibility change first, then run the limit and price test with the sized sample.</p>
          </div>
          <div className="cs-phase" style={{ ['--tone' as string]: 'var(--cs-2)' }}>
            <div className="when">Scale</div>
            <h4>Sponsored cards, carefully</h4>
            <p>Launch on shopping and travel answers only, with the trust skill as the release gate.</p>
          </div>
          <div className="cs-phase" style={{ ['--tone' as string]: 'var(--cs-3)' }}>
            <div className="when">Expand</div>
            <h4>Self-serve for advertisers</h4>
            <p>Offer the campaign team to small businesses as the way to buy AI assistant ads alongside search, social, and maps.</p>
          </div>
        </div>
      </section>

      <div className="cs-cta">
        <div>
          <h3>See it run</h3>
          <p>Watch the trust reviewer block a plan, or a coffee shop’s agents buy media from four ad platforms.</p>
        </div>
        <button className="cs-btn" onClick={() => go('#/agents')}>
          ▶ Run a mission
        </button>
      </div>

      <footer className="cs-sources">
        <strong>Sources.</strong> Market figures are from the published sources below; all company, user, and performance figures in the demo are
        synthetic.
        <ol>
          {SOURCES.map((s) => (
            <li key={s.n} id={`src-${s.n}`}>
              {s.text}{' '}
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.url.replace(/^https?:\/\//, '').split('/')[0]}
              </a>
            </li>
          ))}
        </ol>
      </footer>
    </div>
  );
}
