---
title: Cron day-of-month and day-of-week may use OR logic
category: cron
tags: [cron, scheduler, day-of-month, day-of-week]
symptoms: ["cron fired on unexpected day", "day-of-month and day-of-week both set", "schedule too frequent"]
last_verified: 2026-05-17
confidence: high
risk: none
requires_human_approval: false
---

# Cron day-of-month and day-of-week may use OR logic

## Problem / symptom
A cron schedule fires more often than expected when both day-of-month and day-of-week fields are restricted.

## Environment
- Vixie-style cron behavior or schedulers compatible with that behavior
- Cron expressions with both DOM and DOW fields set

## Root cause
Many cron implementations treat day-of-month and day-of-week as **OR**, not AND. Example: a job can run when either the date matches or the weekday matches.

## Fix
- Avoid setting both DOM and DOW unless OR behavior is intended.
- Use scheduler-specific AND syntax if supported.
- Otherwise, schedule broader and add an explicit date/weekday check inside the script.

## Verification
- Inspect next run times after creating the cron.
- Test against known dates before relying on it.

## Caveats / risks
- Scheduler implementations differ. Check local docs.

## Search phrases
- cron day of month day of week OR
- cron fired unexpected weekday
- Vixie cron OR logic

## Source / credit
Sanitized field report.
