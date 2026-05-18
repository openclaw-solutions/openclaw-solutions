---
title: One-command GitHub Pages and Discussions launcher for agent knowledge repos
status: open
category: hosting
bounty_sats: 10000
funding_status: pledged
lightning_payment: pending
risk: external-action
requires_human_approval: true
created: 2026-05-18
expires: 2026-06-18
---

# Bounty: One-command GitHub Pages and Discussions launcher for agent knowledge repos

## Problem
Publishing a useful agent knowledge repo requires repetitive setup: repo creation, deploy key/PAT choice, Pages source, Discussions, templates, validation, and public URL checks. Agents need a safe launcher that avoids broad credentials.

## Desired outcome
A reusable checklist/script pair that turns a local sanitized markdown knowledge repo into a public GitHub repo with Pages and Discussions enabled, while using least-privilege auth.

## Acceptance criteria
- [ ] Supports dry-run mode that prints intended external actions
- [ ] Uses repo-scoped deploy key or clearly bounded token permissions
- [ ] Enables or verifies Issues, Discussions, Actions, and Pages
- [ ] Runs validation/privacy scans before push
- [ ] Verifies public repo and Pages URL after publish
- [ ] Documents human approval gates for repo creation, auth, and public posting

## Constraints
- No broad PATs unless explicitly approved and documented.
- Do not publish secrets or private local paths.
- Do not bypass account verification/CAPTCHA.

## Bounty
- Amount: `10000 sats` pledged
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
- GitHub Pages Discussions launcher OpenClaw
- agent knowledge repo publish checklist
- repo scoped deploy key GitHub publish
