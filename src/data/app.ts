/**
 * Lumen Notes: a fictional consumer AI notes and assistant app with a free
 * tier and a Pro plan. Numbers are plausible, not measured.
 */

export const APP = {
  name: 'Lumen Notes',
  mau: 2_400_000,
  dau: 610_000,
  proSubscribers: 96_000,
  proPrice: 12,
  /** Assistant queries per active free user per day. */
  freeQueriesPerDau: 9,
  /** Pro users query about 3x as much. */
  proQueriesPerDay: 27,
  freeDailyLimit: null as number | null,
  /** Blended model cost per assistant query, in dollars. */
  costPerQuery: { mini: 0.0009, standard: 0.0031 },
  /** Share of free queries currently routed to the standard model. */
  standardShare: 0.6,
  monthlyChurnPro: 0.045,
  /** Share of users under 18 (declared age). */
  minorShare: 0.07,
};

/** What people ask the assistant about. Drives ad eligibility. */
export const QUERY_MIX: { topic: string; share: number; commercial: number; sensitive: boolean }[] = [
  { topic: 'Work and writing', share: 0.36, commercial: 0.06, sensitive: false },
  { topic: 'Study and learning', share: 0.21, commercial: 0.03, sensitive: false },
  { topic: 'Shopping and product research', share: 0.11, commercial: 0.72, sensitive: false },
  { topic: 'Travel and plans', share: 0.08, commercial: 0.45, sensitive: false },
  { topic: 'Personal and journaling', share: 0.12, commercial: 0.02, sensitive: false },
  { topic: 'Health and wellbeing', share: 0.07, commercial: 0.3, sensitive: true },
  { topic: 'Money and finance', share: 0.05, commercial: 0.35, sensitive: true },
];

/** Daily query distribution of free users: share of free DAU hitting each daily volume. */
export const FREE_USAGE_BUCKETS: { queries: number; share: number }[] = [
  { queries: 2, share: 0.34 },
  { queries: 5, share: 0.27 },
  { queries: 10, share: 0.19 },
  { queries: 20, share: 0.12 },
  { queries: 45, share: 0.08 },
];
