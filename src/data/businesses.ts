/**
 * Small-business presets. Every business is fictional; the numbers are
 * plausible, not measured.
 */

export type ChannelId = 'search' | 'social' | 'maps' | 'chat';
export type Goal = 'Walk-ins' | 'Bookings' | 'Online orders' | 'Quote requests';

export interface Business {
  id: string;
  name: string;
  type: string;
  emoji: string;
  city: string;
  neighborhood: string;
  goal: Goal;
  monthlyBudget: number;
  offer: string;
  /** Short, concrete reason to choose them. */
  hero: string;
  /** Short convenience hook. */
  convenience: string;
  /** Call to action verb phrase. */
  action: string;
  /** Revenue per new customer in their first 90 days. */
  customerValue90d: number;
  /**
   * Prior response curve per channel for a month: customers(spend) = max x (1 - e^(-spend / scale)).
   * This is what the planner believes before launch.
   */
  prior: Record<ChannelId, { max: number; scale: number }>;
  /**
   * How each channel actually performs relative to the prior. Hidden from the planner;
   * only the in-flight learning loop can discover it.
   */
  truth: Record<ChannelId, number>;
}

export const BUSINESSES: Business[] = [
  {
    id: 'coffee', name: 'Bean & Bloom', type: 'Coffee shop', emoji: '☕', city: 'Portland', neighborhood: 'Alberta Arts',
    goal: 'Walk-ins', monthlyBudget: 1200, offer: 'Free pastry with your first latte',
    hero: 'Small-batch espresso, baked fresh daily', convenience: 'Open 6:30am, 2 min from the MAX stop', action: 'Stop by',
    customerValue90d: 58,
    prior: { search: { max: 70, scale: 900 }, social: { max: 110, scale: 1400 }, maps: { max: 80, scale: 600 }, chat: { max: 45, scale: 800 } },
    truth: { search: 0.85, social: 0.4, maps: 1.6, chat: 1.35 },
  },
  {
    id: 'yoga', name: 'FlowState Yoga', type: 'Yoga studio', emoji: '🧘', city: 'Austin', neighborhood: 'East Austin',
    goal: 'Bookings', monthlyBudget: 2000, offer: 'First week unlimited for $20',
    hero: 'Small classes, teachers who know your name', convenience: 'Classes at 6am, noon, and 6pm', action: 'Book a class',
    customerValue90d: 210,
    prior: { search: { max: 45, scale: 1550 }, social: { max: 70, scale: 2100 }, maps: { max: 30, scale: 900 }, chat: { max: 30, scale: 1200 } },
    truth: { search: 1.45, social: 1.1, maps: 0.55, chat: 0.7 },
  },
  {
    id: 'bike', name: 'Spoke & Gear', type: 'Bike repair shop', emoji: '🚲', city: 'Denver', neighborhood: 'Highlands',
    goal: 'Bookings', monthlyBudget: 800, offer: '$49 spring tune-up',
    hero: 'Certified mechanics, honest quotes', convenience: 'Drop off by 10am, ride home by 5pm', action: 'Book a tune-up',
    customerValue90d: 140,
    prior: { search: { max: 40, scale: 650 }, social: { max: 30, scale: 1200 }, maps: { max: 35, scale: 450 }, chat: { max: 25, scale: 600 } },
    truth: { search: 1.45, social: 0.5, maps: 0.75, chat: 1.4 },
  },
  {
    id: 'bakery', name: 'Crumb & Co.', type: 'Bakery', emoji: '🥐', city: 'Chicago', neighborhood: 'Logan Square',
    goal: 'Online orders', monthlyBudget: 1500, offer: '15% off your first online order',
    hero: 'Sourdough baked every morning at 4am', convenience: 'Order by 9pm, pick up from 7am', action: 'Order now',
    customerValue90d: 74,
    prior: { search: { max: 60, scale: 1050 }, social: { max: 120, scale: 1550 }, maps: { max: 50, scale: 650 }, chat: { max: 40, scale: 900 } },
    truth: { search: 0.6, social: 1.5, maps: 0.8, chat: 1.1 },
  },
  {
    id: 'cleaning', name: 'Sparkle Home', type: 'Home cleaning service', emoji: '🧽', city: 'Atlanta', neighborhood: 'Midtown',
    goal: 'Quote requests', monthlyBudget: 2500, offer: '$40 off your first deep clean',
    hero: 'Vetted, insured cleaners, same team every visit', convenience: 'Book online in 60 seconds', action: 'Get a quote',
    customerValue90d: 390,
    prior: { search: { max: 50, scale: 1800 }, social: { max: 40, scale: 2350 }, maps: { max: 25, scale: 1200 }, chat: { max: 30, scale: 1400 } },
    truth: { search: 1.1, social: 0.5, maps: 0.7, chat: 1.7 },
  },
];

export const CHANNELS: { id: ChannelId; name: string; short: string; blurb: string }[] = [
  { id: 'search', name: 'Search ads', short: 'Search', blurb: 'Shown when people search for what you sell nearby.' },
  { id: 'social', name: 'Social feed ads', short: 'Social', blurb: 'Photo ads in social feeds, targeted by area and interests.' },
  { id: 'maps', name: 'Maps & local listings', short: 'Maps', blurb: 'Promoted pin and listing when people browse the map.' },
  { id: 'chat', name: 'AI assistant ads', short: 'AI chat', blurb: 'Labeled sponsored suggestion when someone asks an AI assistant for a recommendation.' },
];
