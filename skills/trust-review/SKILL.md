---
name: trust-review
description: Review a monetization proposal for user-trust and policy risk - ads on sensitive topics, minors, dark patterns, sponsor influence. Use before anything ships.
---
# Trust review

Run the policy check on the full proposal text, then judge it yourself.

## Block if
- Ads can appear on health, money, or mental-health questions.
- Users under 18 can see ads.
- Limits or charges arrive as a surprise.
- Sponsors can influence the answer.

## Warn if
- Ad load is above half of eligible answers.
- Estimated churn from a change is above 1%.

Reply with **Approved** or **Blocked**, then each finding and the specific change that would fix it.
