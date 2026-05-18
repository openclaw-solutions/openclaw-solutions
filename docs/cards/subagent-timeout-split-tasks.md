---
title: Split large subagent research tasks to avoid model timeout
category: models
tags: [subagent, timeout, deepseek, research, task-splitting]
symptoms: ["subagent timed out", "large research task failed", "many tool calls before completion"]
last_verified: 2026-05-17
confidence: high
risk: none
requires_human_approval: false
---

# Split large subagent research tasks to avoid model timeout

## Problem / symptom
A subagent doing broad research times out after many tool calls, leaving no useful final artifact.

## Environment
- Isolated subagent runtime
- Cheap/fast model used for long research
- Broad prompt with too many objectives

## Root cause
The task scope is too large for one run. The model spends its budget gathering context and never reaches synthesis.

## Fix
1. Split research into smaller bounded tasks.
2. Define one output file and a strict word/token target.
3. Ask for 2-4 options, not every possible option.
4. Prefer deterministic source fetching when available.
5. Use a second synthesis pass only after bounded outputs exist.

## Better prompt pattern
```text
Research exactly 3 options for X. Write findings to path/file.md.
For each: availability, cost, setup steps, risks, recommendation.
Stop after 30 minutes or 8 sources. Do not sign up or spend money.
```

## Verification
- The subagent produces the named output file.
- The output contains a recommendation and not just notes.

## Caveats / risks
- Do not escalate to premium models automatically. First split smaller.

## Search phrases
- subagent timed out
- DeepSeek research timeout
- split bounded tasks
- agent too many tool calls

## Source / credit
Sanitized field report.
