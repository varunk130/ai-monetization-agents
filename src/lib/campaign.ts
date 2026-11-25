/**
 * A live campaign the agents can operate one week at a time.
 *
 * The market's true channel performance (business.truth) is hidden from the
 * agents. They see only what each week returns, and must learn from it.
 */
import { CHANNELS, type Business, type ChannelId } from '../data/businesses';
import { customers, evenSplit, mulberry32, plan, type Allocation } from './plan';

export const WEEKS = 4;
const IDS = CHANNELS.map((c) => c.id);

export interface WeekResult {
  week: number;
  allocation: Allocation;
  customers: Record<ChannelId, number>;
  cost_per_customer: Record<ChannelId, number | null>;
  total_customers: number;
}

export class Campaign {
  readonly weekly: number;
  readonly noise: Record<ChannelId, number>[];
  readonly history: WeekResult[] = [];
  private evidence: Allocation = { search: 1, social: 1, maps: 1, chat: 1 };
  private weighted: Allocation = { search: 1, social: 1, maps: 1, chat: 1 };
  belief: Allocation = { search: 1, social: 1, maps: 1, chat: 1 };

  constructor(readonly business: Business, readonly monthlyBudget: number, readonly creativeLift = 1, seed = 11) {
    this.weekly = monthlyBudget / WEEKS;
    const rand = mulberry32(seed);
    this.noise = Array.from({ length: WEEKS }, () => Object.fromEntries(IDS.map((id) => [id, 0.8 + 0.4 * rand()])) as Record<ChannelId, number>);
  }

  /** Benchmark plan before any data: split the weekly budget by prior response curves. */
  launchPlan(): Allocation {
    return plan(this.business, this.weekly, undefined, 1 / WEEKS);
  }

  private actual(week: number, id: ChannelId, spend: number): number {
    return customers(this.business, id, spend, this.business.truth[id] * this.noise[week][id] * this.creativeLift, 1 / WEEKS);
  }

  runWeek(allocation: Allocation): WeekResult {
    const w = this.history.length;
    if (w >= WEEKS) throw new Error('The campaign has already run all 4 weeks.');
    const spent = IDS.reduce((s, id) => s + (allocation[id] ?? 0), 0);
    if (Math.abs(spent - this.weekly) > 1) throw new Error(`Weekly allocation must total $${this.weekly.toFixed(0)}; got $${spent.toFixed(0)}.`);
    const got = Object.fromEntries(IDS.map((id) => [id, this.actual(w, id, allocation[id] ?? 0)])) as Record<ChannelId, number>;
    const r: WeekResult = {
      week: w + 1,
      allocation,
      customers: Object.fromEntries(IDS.map((id) => [id, Number(got[id].toFixed(1))])) as Record<ChannelId, number>,
      cost_per_customer: Object.fromEntries(IDS.map((id) => [id, allocation[id] > 0 && got[id] > 0.05 ? Number((allocation[id] / got[id]).toFixed(2)) : null])) as Record<ChannelId, number | null>,
      total_customers: Number(IDS.reduce((s, id) => s + got[id], 0).toFixed(1)),
    };
    this.history.push(r);
    // Update beliefs: blend the benchmark (one unit of evidence) with observed/expected, weighted by spend.
    for (const id of IDS) {
      const spend = allocation[id];
      if (spend <= 0) continue;
      const ratio = got[id] / customers(this.business, id, spend, 1, 1 / WEEKS);
      const weight = Math.min(2, spend / (this.weekly / IDS.length));
      this.evidence[id] += weight;
      this.weighted[id] += weight * ratio;
      this.belief[id] = this.weighted[id] / this.evidence[id];
    }
    return r;
  }

  /** Best next-week split given what has been learned so far. */
  replan(): Allocation {
    return plan(this.business, this.weekly, this.belief, 1 / WEEKS);
  }

  /** Counterfactual: the same weeks with an even split, same market noise. */
  evenSplitBaseline(): number {
    const even = evenSplit(this.weekly);
    let total = 0;
    for (let w = 0; w < this.history.length; w++) for (const id of IDS) total += this.actual(w, id, even[id]);
    return Number(total.toFixed(1));
  }
}
