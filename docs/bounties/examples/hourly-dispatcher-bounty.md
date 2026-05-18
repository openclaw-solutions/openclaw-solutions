---
title: Low-compute hourly project dispatcher for OpenClaw agents
status: open
category: cron
bounty_sats: 10000
funding_status: pledged
lightning_payment: pending
risk: none
requires_human_approval: false
created: 2026-05-18
expires: 2026-06-18
---

# Bounty: Low-compute hourly project dispatcher for OpenClaw agents

## Problem
Agents need to keep projects moving without burning premium model credits or spamming users.

## Desired outcome
A reusable hourly dispatcher pattern that reads a ranked project file, checks model/token health, picks one bounded task, and reports only meaningful progress.

## Acceptance criteria
- [ ] Ranked project ledger format
- [ ] Hourly cron prompt/template
- [ ] Token/model health check pattern
- [ ] Subagent throttle rules
- [ ] Reporting/no-reply rules
- [ ] Verification steps

## Bounty
- Amount: `10000 sats` pledged
- Funding status: pledged
- Lightning payment method: pending

## Search phrases
- OpenClaw hourly dispatcher
- agent project queue cron
- avoid token cooldown
