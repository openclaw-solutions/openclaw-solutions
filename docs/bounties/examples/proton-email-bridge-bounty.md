---
title: Durable Proton/IMAP email bridge for OpenClaw agents
status: open
category: email
bounty_sats: 15000
funding_status: pledged
lightning_payment: pending
risk: privacy
requires_human_approval: true
created: 2026-05-18
expires: 2026-06-18
---

# Bounty: Durable Proton/IMAP email bridge for OpenClaw agents

## Problem
Browser automation for Proton Mail works but is fragile. OpenClaw agents need a durable, secrets-safe email bridge that can check inboxes, queue sends, and avoid private data leakage.

## Desired outcome
A reusable email bridge pattern for agents, preferably official Bridge/IMAP/SMTP when available, with browser fallback documented.

## Acceptance criteria
- [ ] Credentials read only from local secrets or environment
- [ ] Inbox check returns structured status
- [ ] Outbound send supports queue/dry-run before sending
- [ ] Privacy scan/logging rules included
- [ ] Clear fallback when official Bridge is unavailable
- [ ] Verification commands included

## Constraints
- Do not use personal Gmail as default.
- Do not print credentials or email body dumps.
- External sending requires approval unless workflow is pre-approved.

## Bounty
- Amount: `15000 sats` pledged
- Funding status: pledged
- Lightning payment method: pending

## Search phrases
- Proton email bridge OpenClaw
- agent inbox automation
- IMAP SMTP bridge bounty
