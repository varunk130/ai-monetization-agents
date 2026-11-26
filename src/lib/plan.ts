/**
 * Budget planning and in-flight learning.
 *
 * plan():      split a budget across channels to maximize expected customers,
 *              using diminishing-returns curves (greedy marginal allocation).
 * simulate():  run four weeks. The AI strategy observes results each week,
 *              updates its belief about each channel, and re-plans. Compared
 *              against keeping the launch plan, and against an even split.
 */
import { CHANNELS, type Business, type ChannelId } from '../data/businesses';

export type Allocation = Record<ChannelId, number>;
const IDS = CHANNELS.map((c) => c.id);
const zero = (): Allocation => ({ search: 0, social: 0, maps: 0, chat: 0 });

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Expected customers from `spend` over `months` (fractional months allowed), with an efficiency multiplier. */
export function customers(b: Business, ch: ChannelId, spend: number, mult = 1, months = 1): number {
  const { max, scale } = b.prior[ch];
  return mult * max * months * (1 - Math.exp(-spend / (scale * months)));
}

export function plan(b: Business, budget: number, mult: Allocation = { search: 1, social: 1, maps: 1, chat: 1 }, months = 1, step = 10): Allocation {
  const alloc = zero();
  let left = Math.floor(budget / step) * step;
  while (left > 0) {
    let best: ChannelId = IDS[0];
    let bestGain = -1;
    for (const id of IDS) {
      const gain = customers(b, id, alloc[id] + step, mult[id], months) - customers(b, id, alloc[id], mult[id], months);
      if (gain > bestGain) {
        bestGain = gain;
        best = id;
      }
    }
    alloc[best] += step;
    left -= step;
  }
  alloc[IDS[0]] += budget - Object.values(alloc).reduce((s, v) => s + v, 0);
  return alloc;
}

export function evenSplit(budget: number): Allocation {
  const each = budget / IDS.length;
  return { search: each, social: each, maps: each, chat: each };
}

export function expectedTotal(b: Business, alloc: Allocation, mult?: Allocation, months = 1): number {
  return IDS.reduce((s, id) => s + customers(b, id, alloc[id], mult?.[id] ?? 1, months), 0);
}

export interface WeekLog {
  week: number;
  allocation: Allocation;
  customers: Record<ChannelId, number>;
  spend: number;
  /** Human-readable decisions the AI made going into this week. */
  decisions: string[];
}

export interface StrategyResult {
  name: string;
  weeks: WeekLog[];
  totalCustomers: number;
  totalSpend: number;
  costPerCustomer: number;
  revenue90d: number;
  roas: number;
}

export interface SimResult {
  ai: StrategyResult;
  launchPlan: StrategyResult;
  even: StrategyResult;
  /** What the AI believed about each channel after week 4 (1 = as expected). */
  learned: Allocation;
}

const WEEKS = 4;

export function simulate(b: Business, budget: number, creativeLift = 1, seed = 11): SimResult {
  const rand = mulberry32(seed);
  // Common random numbers: every strategy sees the same weekly noise per channel.
  const noise: Record<ChannelId, number>[] = Array.from({ length: WEEKS }, () =>
    Object.fromEntries(IDS.map((id) => [id, 0.8 + 0.4 * rand()])) as Record<ChannelId, number>,
  );
  const weekly = budget / WEEKS;
  const actual = (week: number, id: ChannelId, spend: number) => customers(b, id, spend, b.truth[id] * noise[week][id] * creativeLift, 1 / WEEKS);

  const run = (name: string, allocFor: (week: number, history: WeekLog[]) => { allocation: Allocation; decisions: string[] }): StrategyResult => {
    const weeks: WeekLog[] = [];
    for (let w = 0; w < WEEKS; w++) {
      const { allocation, decisions } = allocFor(w, weeks);
      const got = Object.fromEntries(IDS.map((id) => [id, actual(w, id, allocation[id])])) as Record<ChannelId, number>;
      weeks.push({ week: w + 1, allocation, customers: got, spend: weekly, decisions });
    }
    const totalCustomers = weeks.reduce((s, w) => s + IDS.reduce((t, id) => t + w.customers[id], 0), 0);
    const totalSpend = weekly * WEEKS;
    const revenue90d = totalCustomers * b.customerValue90d;
    return { name, weeks, totalCustomers, totalSpend, costPerCustomer: totalSpend / totalCustomers, revenue90d, roas: revenue90d / totalSpend };
  };

  const launch = plan(b, weekly, undefined, 1 / WEEKS);
  const belief: Allocation = { search: 1, social: 1, maps: 1, chat: 1 };
  // Running evidence per channel. The prior counts as one unit of evidence at 1.0 (as planned).
  const evidence: Allocation = { search: 1, social: 1, maps: 1, chat: 1 };
  const weightedRatio: Allocation = { search: 1, social: 1, maps: 1, chat: 1 };
  const ai = run('AI-optimized', (w, history) => {
    if (w === 0) return { allocation: launch, decisions: ['Launched with the planned split.'] };
    const last = history[w - 1];
    for (const id of IDS) {
      const spent = last.allocation[id];
      if (spent <= 0) continue;
      const ratio = last.customers[id] / customers(b, id, spent, 1, 1 / WEEKS);
      // More spend means a more trustworthy reading, capped so one week can't dominate.
      const weight = Math.min(2, spent / (weekly / IDS.length));
      evidence[id] += weight;
      weightedRatio[id] += weight * ratio;
      belief[id] = weightedRatio[id] / evidence[id];
    }
    const next = plan(b, weekly, belief, 1 / WEEKS);
    return { allocation: next, decisions: explainShift(last, next) };
  });
  const launchPlan = run('Launch plan, never adjusted', () => ({ allocation: launch, decisions: [] }));
  const even = run('Even split', () => ({ allocation: evenSplit(weekly), decisions: [] }));
  return { ai, launchPlan, even, learned: { ...belief } };
}

function explainShift(last: WeekLog, next: Allocation): string[] {
  const name = (id: ChannelId) => CHANNELS.find((c) => c.id === id)!.short;
  const cpa = (id: ChannelId) => (last.customers[id] > 0.05 ? last.allocation[id] / last.customers[id] : Infinity);
  const delta = IDS.map((id) => ({ id, d: next[id] - last.allocation[id] })).sort((a, b) => a.d - b.d);
  const from = delta[0];
  const to = delta[delta.length - 1];
  if (to.d < 25) return ['Kept the split: every channel performed close to plan.'];
  const fmt = (v: number) => (Number.isFinite(v) ? `$${v.toFixed(0)}` : 'n/a');
  const amount = `$${Math.round(to.d)}`;
  const paused = next[from.id] === 0 && last.allocation[from.id] > 0 ? ` Paused ${name(from.id)} for now.` : '';
  if (cpa(to.id) < cpa(from.id))
    return [`Moved ${amount} from ${name(from.id)} to ${name(to.id)}: ${name(to.id)} cost ${fmt(cpa(to.id))} per customer last week vs. ${fmt(cpa(from.id))} on ${name(from.id)}.${paused}`];
  return [`Moved ${amount} from ${name(from.id)} to ${name(to.id)}: ${name(from.id)} is past its sweet spot, so the next dollar buys more customers on ${name(to.id)}.${paused}`];
}

/** Cumulative customers by week (with week 0 = 0), for charting. */
export function cumulative(r: StrategyResult): number[] {
  const out = [0];
  for (const w of r.weeks) out.push(out[out.length - 1] + IDS.reduce((s, id) => s + w.customers[id], 0));
  return out;
}
