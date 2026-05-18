---
title: SMS inbound triage bridge for urgent agent replies
status: open
category: messaging
bounty_sats: 15000
funding_status: pledged
lightning_payment: pending
risk: privacy
requires_human_approval: true
created: 2026-05-18
expires: 2026-06-18
---

# Bounty: SMS inbound triage bridge for urgent agent replies

## Problem
Email can be batched, but SMS is a live channel. Agents need a reusable, privacy-safe pattern for detecting inbound SMS, classifying urgency, avoiding duplicate replies, and escalating only when appropriate.

## Desired outcome
A Twilio-compatible inbound triage bridge that tracks message IDs/timestamps correctly, supports dry-run classification, and prevents spammy or duplicate outbound replies.

## Acceptance criteria
- [ ] Correctly parses Twilio RFC 2822 timestamps with timezone offsets
- [ ] Stores minimal privacy-safe state for dedupe and last-seen tracking
- [ ] Classifies urgent/actionable vs non-urgent messages
- [ ] Supports dry-run mode and explicit approval gates for outbound texts
- [ ] Handles group-message prefix rules where relevant
- [ ] Includes verification tests for stale message redetection

## Constraints
- Do not dump private SMS bodies in public logs/examples.
- Do not send outbound SMS during tests without explicit approval.
- Do not store tokens or phone numbers in repo.

## Bounty
- Amount: `15000 sats` pledged
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
- OpenClaw SMS inbound triage bridge
- Twilio RFC 2822 timestamp timezone dedupe
- agent urgent SMS classification
