---
name: experiment-design
description: Design an A/B test for a monetization change - metric, guardrails, sample size, duration, and decision rule.
---
# Experiment design

1. **Primary metric** tied to the decision (for example, free-to-Pro conversion, net revenue per user).
2. **Guardrails** that stop the test if breached (free user retention, complaint rate).
3. **Sample size** per arm for the minimum lift worth acting on; use the sizing tool.
4. **Duration**: at least one full week, longer if the sample needs it.
5. **Decision rule** written before launch: ship if primary improves by at least the minimum lift and no guardrail breaks.

Stage risky changes: test the change with the smallest user impact first.
