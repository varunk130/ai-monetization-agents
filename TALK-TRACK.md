# Talk track: Revenue Agents (about 8 minutes)

**Setup before you present:** `npm run dev`, open the app, stay on **Case study**. Two demos are available; for a short slot, run only the first.

---

## Part 1: The story (2–4 min, Case study page)

**Open (hero, 30s)**
> "Ads are moving into AI assistants. Both sides of that market need help: AI apps have to pay for every answer they give away, and small businesses have to learn to buy a new kind of ad. I built an agent team for each side."

Point to the hero numbers: **$26B** AI search ads by 2029, **3x+** growth in AI app spending, **+$704K/month** for the demo app, **+18–34%** more customers for local businesses.

**Problem (section 1, 45s)**
> "Free AI users cost real money: in the demo app, 60 cents a month each, and the heaviest 8% drive over a third of the cost. The obvious fix, ads, can break trust: the highest-revenue setting puts sponsors next to health and money questions and loses 5% of free users a month. And a coffee shop owner has no media team to buy any of this."

**Opportunity (section 2, 45s)**
> "US digital ads are a $362B market. eMarketer has AI search ads going from about $2B in 2026 to $26B in 2029, about 14% of all search. Consumers already spend $4–5B a year in AI apps. The first slice I'd target, about $2.6B, is small and local businesses buying AI assistant ads; that one is my assumption."

**How it works + the AI team (sections 4–5, 60s)**
> "One agent platform, two missions. On the publisher side: analyst, pricing, ads, a trust reviewer, and an experiment designer. The trust reviewer can block a plan and send it back. On the advertiser side: research, creative, a media buyer that gets quotes from four ad platforms' own agents, and an analyst that moves budget weekly."
> "Each agent has one skill, an expert playbook in a short file. The trust rules that block a bad plan are a skill the business owns and can audit."

Transition: *"Let me show you the trust review in action."* Click **▶ Watch the agents work**.

---

## Part 2: Live demo (2 min, Agent missions page)

**Demo A: Make the free tier pay for itself** (select it, **3x** speed, **▶ Run mission**)

1. **Usage Analyst**: *"Free serving costs $320K a month."*
2. **Pricing Analyst and Ads Strategist** run in parallel. *"The ads agent was asked for maximum revenue, and proposes ads on everything, including health questions."*
3. **Trust & Safety Reviewer**: the red **blocked the proposal** line opens automatically. *"Blocked: ads on health and finance."*
4. **Ads Strategist** fixes it; the reviewer approves. *"That's the governance loop real teams need."*
5. **Experiment Designer** sizes the test, and the lead saves the memo.

**Demo B (optional): Run Bean & Bloom's first month** (select it, **Instant** or **3x**)

> "Here the media buyer sends A2A quote requests to four ad platforms, including an AI assistant ad network. Then the analyst runs four weeks: 'Maps cost $6 per customer vs $34 on Social. Shifting budget.'"

---

## Part 3: Outcome and artifact (1 min)

When the **Mission complete** banner appears:

- Demo A: *"Plus $704K net a month, $694K to $1.40M. The trust review stopped a plan with 11 times the churn. And there's a 7-day test plan with 39K users per arm."* Click **Read the memo ↓**: recommendation, options tables, guardrails, experiment plan, and what we're not doing.
- Demo B: *"120 customers vs 101 with an even split, $10 per customer instead of $12, about $6,900 in 90-day revenue."* Click **Read the campaign report ↓**.

Close:
> "Every number in the memo came from a tool, and the trust rules are a file anyone can read. With an API key, the same agents run on Claude."


## Optional: Use cases (30s, Use cases tab)

> "The demo shows a few missions, but the same agents cover much more. Each card here reuses the existing team and adds one new playbook. The ones marked Live in demo are what you just saw."

---

## Likely questions

- **Is this real AI?** Replay scripts the decisions so it runs offline; the tools, models, and outputs are real. Live mode runs the same agents on Claude.
- **Why would the ads agent propose something bad?** It was asked to maximize revenue, which is exactly how bad proposals happen in real teams. The point is that review is built into the loop.
- **How would you validate the pricing numbers?** The experiment plan exists for that: ship model routing first, then test the limit and price, then sponsored cards, each against a control.
- **Where are the numbers from?** Market figures are cited (eMarketer, Sensor Tower). App and business figures are synthetic.
