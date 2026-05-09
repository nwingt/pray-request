# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, Cursor, Aider, Codex, etc.) working with code in this repository. `CLAUDE.md` is a symlink to this file for tools that auto-discover by that name.

> Note: when this file mentions the **Claude API** (model: Sonnet 4.6, Haiku), it refers to the LLM the *product* will call to pick verses — not the agent reading this file. Don't conflate the two when editing.

## Repository status

**v2 stage — GitHub App built, no LLM yet.** Source of truth for product intent is `docs/plan.md`. Two coexisting paths:

- **Self-host (v0 Action).** `.github/workflows/prayrequest.yml` + `scripts/pick-verse.sh` + `.github/prayrequest-verses.json`. Pure bash + `jq` on `ubuntu-latest`. Auto-bless + summon, both keyword-matched. Posts via default `GITHUB_TOKEN`. Stays as the self-host fallback.
- **Hosted App (v2).** `app/` — Cloudflare Workers + TypeScript + Hono. Webhook server reachable at `https://prayrequest.<sub>.workers.dev/webhook`. Auto-bless, `@prayrequest` summon, `@prayrequest reroll`. Same keyword matcher, ported to TS in `app/src/verse-picker.ts`, **importing the same `.github/prayrequest-verses.json`** so behavior matches the Action.

Two project boundaries to keep in mind when editing:

- The **Action** path is pure bash. Do not introduce Node/Python in the repo root or in `scripts/`.
- The **App** path is a TypeScript Cloudflare Workers project at `app/`. `npm install --ignore-scripts` (sharp's postinstall fails and isn't needed). Tests: `cd app && npx vitest run`. Type check: `cd app && npx tsc --noEmit`. Bundle dry-run: `cd app && npx wrangler deploy --dry-run`.

v1 (LLM-powered verse selection) is **deferred**, not next. The plan now is: prove App distribution works on a real repo, then swap the keyword matcher in `app/src/verse-picker.ts` for a Claude API call. The Action path will likely stay keyword-only as the zero-secret self-host option.

## What PrayRequest is

A GitHub bot that comments a context-matched Bible verse on every PR — verse + reference only, no commentary. Readers interpret it themselves. Distributed two ways: as a hosted **GitHub App** (`app/`, the default) and as a self-hostable **GitHub Action** (`.github/workflows/prayrequest.yml`, the zero-secret fallback). See `docs/plan.md` for full pitch, sample interactions, and tradeoff rationale.

## Architecture (target, per plan)

```
PR event → Actions runner → signal extraction → Claude API → gh pr comment
```

Three trigger modes share **one workflow file**, dispatched by event type:

| Mode        | Event                                          | Behavior                          |
|-------------|------------------------------------------------|-----------------------------------|
| Auto-bless  | `pull_request: [opened, ready_for_review]` with `@prayrequest` in title or body | Drop verse on PR open |
| Summon      | `issue_comment: [created]` containing `@PrayRequest`        | Reply contextually to the thread  |
| Reroll      | `issue_comment` containing `@PrayRequest reroll`            | Generate an alternate verse       |

`issue_comment` covers PR comments because GitHub's API treats PRs as issues. Branching on event type inside one workflow keeps the surface area small.

**Signal extraction** runs *before* the LLM call to bias verse selection deterministically (hotfix detection, no-tests heuristic, security-path detection, TODO debt, massive-diff, force-push). These are passed as structured input to Claude so verse matching is predictable, not random. Full signal table in `docs/plan.md` § Signal extraction.

**Verse fallback:** a curated JSON of ~50 pre-tagged verses must exist to handle API failures, rate limits, and LLM hallucination of nonexistent references. Validate Claude's output against a known verse index before posting.

## Non-negotiable constraints from the plan

These are decisions already made — do **not** revisit without explicit user direction:

- **App is the default, Action is the fallback.** v0/v1 used the Action because it had no infra; v2 ships the hosted App (`app/`, Cloudflare Workers) so users no longer need a workflow file in their repo. The Action stays in tree as the self-host path — same verse-selection logic, same JSON file.
- **Opt-in per repo** (install/file presence) **and per PR** (`@prayrequest` must appear in PR title or body for auto-bless to fire; comment summon is always explicit). Skip bot-authored PRs (Dependabot, Renovate). Religious sensitivity → never on by default for someone else's repo, never on by accident on someone's PR.
- **Verse + reference only — no editorial commentary.** The bot does not add snark, sass, or interpretation. Readers project their own meaning onto the verse. This is a deliberate product decision (made post-plan): it lowers religious-sensitivity risk and makes the bot localizable without rewriting tone.
- **Don't auto-bless on `synchronize` events** — only initial open — to avoid spam on every push.
- **Cost ceiling: ~$0.002/PR** with prompt caching (verse-only output is cheaper than the original verse + sass spec). Sonnet 4.6 is default; Haiku is the explicit cost-mode fallback. A daily per-repo comment cap is required to prevent runaway cost.
- **Per-repo config** lives at `.github/prayrequest.yml` (language, opt-out paths, alternate quote sources like Tao Te Ching / Sun Tzu / Shakespeare for non-religious teams).

## v0 implementation notes

Things in the workflow that are easy to break by accident:

- **Verse priority is JSON order.** The matcher walks `verses[]` and picks the first one with any tag matching the (lowercased) PR title. Reorder carefully — putting `feat` before `security` would make every `feat: add admin endpoint` match `feat` not `security`.
- **Untrusted input goes through `env:`.** Never interpolate `${{ github.event.pull_request.title }}` directly into a `run:` script — that's a known GitHub Actions injection class. Always use `env:` and reference `$VAR`. Some agent harnesses run a security-reminder hook that will block writes that look unsafe.
- **Tag matching uses ASCII word-boundary regex** (`(^|[^[:alnum:]])tag([^[:alnum:]]|$)`) so `fix` doesn't match `prefix` and `auth` doesn't match `author`. If you add a tag containing `-` or `_`, sanity-check the regex still does what you want.
- **`massive` tag is a special override.** When `additions > 500` or `changed_files > 20`, the matcher short-circuits to the first verse tagged `massive`. Currently that's the refactor verse.
- **`gh pr comment` needs `pull-requests: write`** in the workflow's `permissions:` block. Don't drop it.

## Open questions still live in the plan

`docs/plan.md` § Open Questions lists 4 unresolved decisions (Marketplace publish vs internal, default language, bless-reviewers, self-host vs direct API). The original "default sass level" question was resolved by dropping sass entirely. If your task touches one of these, surface the question to the user before picking a direction.
