# Hype research synthesis

## Status and method

This is a research plan and hypothesis synthesis for the prototype, not a report of completed primary research. No interview transcripts, survey responses, or production analytics were supplied. Statements below are testable hypotheses derived from the product brief; they must not be cited as observed user evidence.

## User segments

| Segment | Need | Likely risk | Research priority |
|---|---|---|---|
| Casual viewers | Understand Hype without learning a new system | Forget a hidden weekly allowance | High |
| Creator-supporting regulars | Allocate scarce Hypes intentionally | Regret an accidental or premature choice | High |
| Power viewers | Track activity across many emerging creators | Treat the quota as friction | Medium |
| Emerging creators | Receive authentic, broadly distributed support | Coordinated manipulation crowds out organic support | High |
| Free viewers | Get a fair, understandable participation path | Assume Premium users receive an unfair advantage | High |
| Premium viewers | See whether membership changes the experience | Confuse Hype with a paid entitlement | Medium |

Premium status should be analyzed as a comparison dimension, not assumed to cause different behavior unless the product actually varies eligibility or quota.

## Current journey hypothesis

| Stage | Viewer action | Information available | Likely friction | Opportunity |
|---|---|---|---|---|
| Discover | Encounters an eligible emerging video | Eligibility label | Does not know the value or scarcity of Hype | Show balance beside eligibility |
| Consider | Decides whether to Hype | Button label | Cannot confidently plan remaining Hypes | Persistent counter and exact reset time |
| Act | Presses Hype | Confirmation | Accidental or emotionally impulsive allocation | 24-hour undo |
| Reflect | Remembers another creator later | Little or no history | Cannot compare earlier choices | Queue with countdowns |
| Return | Comes back later in the week | Reset may be unclear | Forgets when allowance returns | Timezone-aware reset date |
| Reward | Sees a supported video gain momentum | Outcome may be disconnected from prior action | Support feels invisible | Minimal badges and outcome notification |

## Five recurring problem hypotheses

1. Quota invisibility causes avoidable surprise when the final Hype is used.
2. A weekday reset can create end-of-week scarcity when viewing is highest.
3. Irreversible allocation creates regret and makes users hesitate.
4. Users cannot easily recall which videos received their Hypes or when undo expires.
5. Support lacks a durable feedback loop, reducing motivation to return.

## Counter evidence plan

The persistent counter is supported by the brief's stated concern about quota visibility, but no quantitative evidence is currently available. Validate it with:

- An unmoderated comprehension test: after viewing a video card, ask participants for remaining Hypes and reset date. Target: at least 85% correct in treatment and a 20-point lift over control.
- A two-week A/B test comparing hidden-until-first-use and always-visible counters. Measure quota-related help opens, blocked fourth attempts, and Hype completion.
- A one-question intercept after the third Hype: “Before tapping, did you know this was your last Hype?”
- Qualitative follow-up on whether the counter feels useful, pressuring, or visually noisy.

Reject or simplify the counter if comprehension does not improve, satisfaction drops materially, or feed engagement declines beyond the guardrail threshold.

## Prioritization matrix

Scores use 1–5, where 5 is highest. Priority score is impact divided by effort; it is directional, not a business case.

| Feature | User impact | Learning value | Effort | Risk | Priority score | Recommendation |
|---|---:|---:|---:|---:|---:|---|
| Persistent counter + reset date | 5 | 5 | 1 | 1 | 5.0 | Ship to experiment first |
| 24-hour undo | 5 | 5 | 3 | 3 | 1.7 | Test after counter instrumentation |
| Hype queue | 4 | 4 | 3 | 2 | 1.3 | Pair with undo treatment |
| Weekend bonus schedule | 4 | 5 | 3 | 4 | 1.3 | A/B test with abuse guardrails |
| Badges | 3 | 3 | 2 | 2 | 1.5 | Keep minimal; validate motivation |
| Real-time cross-device updates | 3 | 2 | 4 | 2 | 0.8 | Poll first; add push only if needed |

## Recommended study sequence

1. Run five comprehension sessions on the persistent counter and exact reset date.
2. Run eight task-based usability sessions on queue discovery, undo, and reassignment.
3. Launch the counter instrumentation to all experiment groups.
4. Randomize the five treatment groups described in the PRD for at least two full quota periods.
5. Review segment-level outcomes and abuse guardrails before any permanent schedule change.
