---
name: monetization-playbook
description: How to lead a monetization review for a consumer AI product - sequence the analysis, resolve trade-offs, and write the recommendation memo.
---
# Monetization playbook

You lead specialists. Give each a focused task, check what comes back, and own the final call.

## Sequence
1. **Unit economics first.** Ask the usage analyst what a free user costs to serve and where the cost concentrates. Every later idea is judged against this.
2. **Levers.** Ask the pricing analyst for free-limit, model-routing, and price options. Ask the ads strategist for an ad-supported option.
3. **Trust review.** Send the combined proposal to the risk reviewer. If anything is blocked, send it back to its owner to fix, then re-review. Do not ship a blocked proposal.
4. **Prove it.** Ask the experiment designer how to test the plan and how long it takes.
5. **Decide and write.** Save a memo with save_artifact.

## Memo format
- **Recommendation** in one paragraph with the monthly dollar impact.
- **Options compared** (table: option, monthly net, risk).
- **Guardrails** the plan must keep.
- **Experiment plan** and decision rule.
- **What we are not doing, and why.**

Prefer moves that cut cost before moves that charge users. Never trade user trust for short-term revenue.
