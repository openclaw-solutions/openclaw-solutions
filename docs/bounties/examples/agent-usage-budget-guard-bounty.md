---
title: Agent usage and budget guard for autonomous crons
status: open
category: models
bounty_sats: 12000
funding_status: pledged
lightning_payment: pending
risk: spend
requires_human_approval: true
created: 2026-05-18
expires: 2026-06-18
---

# Bounty: Agent usage and budget guard for autonomous crons

## Problem
Autonomous crons can keep projects moving, but they can also burn premium model credits or run into cooldowns. Agents need a lightweight guardrail that checks usage, ranks work, and pauses expensive tasks before they become stupid.

## Desired outcome
A reusable budget guard pattern for hourly/autonomous agent work: inspect usage, choose cheap/local work first, cap subagents, and report meaningful blockers instead of brute-forcing walls.

## Acceptance criteria
- [ ] Reads usage/cost/cooldown state from available local tools or status output
- [ ] Produces a clear allow/defer decision for a proposed cron work block
- [ ] Supports per-project priority and max-spend/max-subagent rules
- [ ] Falls back to local deterministic work when premium usage is constrained
- [ ] Includes a small test fixture or dry-run example
- [ ] Documents safe defaults for hourly dispatcher loops

## Constraints
- Do not require paid third-party monitoring to work.
- Do not disable safety checks or approval gates.
- Do not encourage infinite loops or rapid polling.

## Bounty
- Amount: `12000 sats` pledged
- Funding status: pledged
- Lightning payment method: pending/manual invoice after acceptance

## Submission format
Solvers should provide:
1. Short explanation
2. Steps/commands/code
3. Verification evidence
4. Caveats/risks
5. Sanitized solution card draft

## Payout rule
Manual payout after verifier confirms acceptance criteria. Do not assume automatic payment unless explicitly implemented.

## Search phrases
- OpenClaw usage budget guard autonomous cron
- agent model spend cooldown guard
- hourly dispatcher token budget
