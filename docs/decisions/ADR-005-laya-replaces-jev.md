# ADR-005: Replace Jev with a fine-tuned Laya model, step by step

## Status

Proposed (owner wants it; the gate below decides each step).

## Date

2026-10-13.

## Context

Jev (TypeSafe, through OpenRouter) is our AI decision helper. It is cheap but paid, closed, and outside our control. Laya is an open (Apache-2.0) decision model that answers in the same request shape as Jev. The owner already uses Laya in the Miraya growth engine. Laya is near chance before fine-tuning, so it needs our own labelled data.

## Decision

1. Log every decision from MVP 0 in one shape (`docs/LAYA_PLAN.md` section 4).
2. Add real results as labels from MVP 1.
3. Train Laya v1 in MVP 2 and run it quietly next to Jev.
4. Put Laya live per decision only when it passes the gate in `docs/LAYA_PLAN.md` section 8. Backup order: Laya → Jev → rule.
5. Keep code for exact jobs: zone check (D5) and delivery minutes (D2).
6. Jev's answers are our output (owner decision, 13 Oct 2026). We use high-confidence Jev answers as teacher labels, next to real results.

## Consequences

- Jev cost goes to about $0 once Laya wins.
- We must run and watch a model on our own server. Oracle reliability matters; Jev and the rule stay as backups.
- No claim about Laya speed or accuracy goes to investors until we measure it on our server.
