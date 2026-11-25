/**
 * Ad copy: generate three creative angles from a business brief, then score
 * any copy (generated or edited) for likely click-through and ad-policy risk.
 *
 * The generator is template-based so the demo runs offline. The scorer encodes
 * the checklist a good performance marketer applies by eye.
 */
import type { Business } from '../data/businesses';

export type Angle = 'Offer' | 'Quality' | 'Convenience';

export interface Creative {
  id: string;
  angle: Angle;
  headline: string;
  body: string;
  cta: string;
}

export function generateCreatives(b: Business): Creative[] {
  return [
    {
      id: 'A',
      angle: 'Offer',
      headline: b.offer,
      body: `${b.hero} in ${b.neighborhood}. ${b.action} this week.`,
      cta: b.action,
    },
    {
      id: 'B',
      angle: 'Quality',
      headline: b.hero,
      body: `A ${b.neighborhood} ${b.type.toLowerCase()} since 2016. ${b.offer}.`,
      cta: b.action,
    },
    {
      id: 'C',
      angle: 'Convenience',
      headline: b.convenience,
      body: `${b.name} in ${b.neighborhood}, ${b.city}. ${b.offer}.`,
      cta: b.action,
    },
  ];
}

export interface PolicyFlag {
  term: string;
  why: string;
}

const POLICY: { re: RegExp; why: string }[] = [
  { re: /\bbest\b|#1|\bnumber one\b/i, why: 'Unverifiable superlative. Most ad platforms limit claims you cannot prove.' },
  { re: /\bguarantee[ds]?\b|\b100%/i, why: 'Absolute promise. Needs terms or proof, or it can be rejected.' },
  { re: /\bcures?\b|\bheals?\b|\blose \d+ ?(lbs|pounds|kg)\b/i, why: 'Health claim. Restricted in most ad policies.' },
  { re: /!{2,}/, why: 'Repeated punctuation reads as spam and is often disallowed.' },
  { re: /\b[A-Z]{4,}\b/, why: 'All-caps words are disallowed in most search ads.' },
];

export function policyFlags(c: Pick<Creative, 'headline' | 'body'>): PolicyFlag[] {
  const text = `${c.headline} ${c.body}`;
  const out: PolicyFlag[] = [];
  for (const { re, why } of POLICY) {
    const m = text.match(re);
    if (m) out.push({ term: m[0], why });
  }
  return out;
}

export interface CopyScore {
  /** 0..100 */
  score: number;
  /** Predicted click-through rate. */
  ctr: number;
  good: string[];
  improve: string[];
  flags: PolicyFlag[];
}

export function scoreCreative(c: Creative, b: Business): CopyScore {
  const text = `${c.headline} ${c.body}`;
  const good: string[] = [];
  const improve: string[] = [];
  let score = 30;

  if (/\$\d|\d+%|\bfree\b/i.test(text)) {
    score += 20;
    good.push('Concrete offer');
  } else improve.push('Add a concrete offer (a price, % off, or something free)');

  if (text.toLowerCase().includes(b.neighborhood.toLowerCase()) || text.toLowerCase().includes(b.city.toLowerCase())) {
    score += 15;
    good.push('Says where you are');
  } else improve.push(`Mention ${b.neighborhood} so locals know it is near them`);

  const len = c.headline.trim().length;
  if (len >= 15 && len <= 40) {
    score += 15;
    good.push('Headline fits on one line');
  } else improve.push(len < 15 ? 'Headline is too short to say much' : 'Shorten the headline to 40 characters or less');

  if (/\b(book|order|stop by|visit|get|try|call|reserve|shop)\b/i.test(c.body) || /\b(book|order|stop by|visit|get|try)\b/i.test(c.cta)) {
    score += 10;
    good.push('Clear next step');
  } else improve.push('Tell people what to do next');

  if (/\d/.test(c.headline)) {
    score += 10;
    good.push('Specific detail in the headline');
  }

  const flags = policyFlags(c);
  score -= flags.length * 25;
  score = Math.max(0, Math.min(100, score));
  return { score, ctr: 0.008 + (score / 100) * 0.03, good, improve, flags };
}
