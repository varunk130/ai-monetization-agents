import { describe, expect, test } from 'vitest';
import { runMission } from '../agent/runtime';
import { ReplayDriver } from '../agent/drivers';
import { SKILLS } from '../agent/skills';
import type { TraceEvent } from '../agent/types';
import { estimateAds, policyCheck, sampleSize, simulatePricing } from '../lib/monetization';
import { AGENTS, MISSIONS } from './agents';
import { POLICIES } from './policies';
import { TOOLS } from './tools';

const network = { agents: AGENTS, tools: TOOLS };

async function replay(id: string) {
  const m = MISSIONS.find((x) => x.id === id)!;
  const events: TraceEvent[] = [];
  const res = await runMission(m.lead, m.brief, { network, driver: new ReplayDriver(POLICIES), onEvent: (e) => events.push(e) });
  return { ...res, events, artifacts: (res.state.artifacts ?? []) as { title: string; body: string }[] };
}

describe('wiring', () => {
  test('every agent has a replay policy, and its skills and tools exist', () => {
    expect(Object.keys(SKILLS)).toHaveLength(12);
    for (const a of Object.values(AGENTS)) {
      expect(POLICIES[a.id], a.id).toBeDefined();
      for (const s of a.skills) expect(SKILLS[s], `${a.id} -> ${s}`).toBeDefined();
      for (const t of a.tools) expect(TOOLS[t], `${a.id} -> ${t}`).toBeDefined();
    }
  });
  test('ad platform agents only have their own quoting tool', () => {
    for (const a of Object.values(AGENTS).filter((x) => x.id.startsWith('platform_'))) expect(a.tools).toEqual(['quote_inventory']);
  });
});

describe('models', () => {
  test('routing free traffic to the small model cuts cost with no user impact', () => {
    const base = simulatePricing({ free_daily_limit: null, pro_price: 12, free_on_small_model: false });
    const routed = simulatePricing({ free_daily_limit: null, pro_price: 12, free_on_small_model: true });
    expect(routed.monthly_net_usd).toBeGreaterThan(base.monthly_net_usd);
    expect(routed.free_dau_lost_per_month).toBe(0);
  });
  test('ads on sensitive topics earn more but churn far more', () => {
    const aggressive = estimateAds({ min_intent: 0.25, exclude_sensitive: false, exclude_minors: false, ad_load: 0.8 });
    const safe = estimateAds({ min_intent: 0.4, exclude_sensitive: true, exclude_minors: true, ad_load: 0.5 });
    expect(aggressive.monthly_ad_revenue_usd).toBeGreaterThan(safe.monthly_ad_revenue_usd);
    expect(aggressive.est_free_user_churn_pct).toBeGreaterThan(safe.est_free_user_churn_pct * 5);
  });
  test('policy check blocks ads on health questions', () => {
    expect(policyCheck('Show ads on health questions').approved).toBe(false);
    expect(policyCheck('Sponsored cards on shopping answers only').approved).toBe(true);
  });
  test('sample size matches the textbook value', () => {
    // 4% baseline, +10% relative lift, alpha 0.05, power 0.8: about 39-40K per arm.
    expect(sampleSize(0.04, 0.1)).toBeGreaterThan(38_000);
    expect(sampleSize(0.04, 0.1)).toBeLessThan(41_000);
  });
});

describe('monetization mission', () => {
  test('trust review blocks the first ad proposal, the fix is approved, and a memo is saved', async () => {
    const { events, artifacts } = await replay('monetize');
    const reviews = events.filter((e) => e.kind === 'agent_end' && e.agent === 'risk_reviewer').map((e) => (e as { output: string }).output);
    expect(reviews[0]).toMatch(/^\*\*Blocked/);
    expect(reviews[reviews.length - 1]).toMatch(/^\*\*Approved/);
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].body).toMatch(/## Experiment plan/);
    expect(artifacts[0].body).toMatch(/Trust review blocked the first ad proposal/);
    expect(events.some((e) => e.kind === 'tool_result' && e.isError)).toBe(false);
  });
});

describe.each(['coffee', 'bakery'])('campaign mission %s', (id) => {
  test('buys media from four platform agents, runs four weeks, beats an even split', async () => {
    const { events, artifacts, state } = await replay(id);
    expect(events.filter((e) => e.kind === 'a2a' && e.direction === 'request')).toHaveLength(4);
    expect(events.filter((e) => e.kind === 'tool_call' && e.tool === 'run_week')).toHaveLength(4);
    expect(events.some((e) => e.kind === 'tool_result' && e.isError)).toBe(false);
    expect(artifacts.map((a) => a.title)).toEqual([expect.stringMatching(/^Campaign report/)]);
    const c = state.campaign as { history: { total_customers: number }[]; evenSplitBaseline: () => number };
    const total = c.history.reduce((s, w) => s + w.total_customers, 0);
    expect(total).toBeGreaterThan(c.evenSplitBaseline() * 1.1);
  });
});
