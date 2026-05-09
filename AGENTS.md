# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, Cursor, Aider, Codex, etc.) working with code in this repository. `CLAUDE.md` is a symlink to this file for tools that auto-discover by that name.

> Note: when this file mentions the **Claude API** (model: Sonnet 4.6, Haiku), it refers to the LLM the *product* will call to pick verses — not the agent reading this file. Don't conflate the two when editing.

## Repository status

**v0 PoC stage.** Source of truth for product intent is `docs/plan.md`. The first working pieces:

- `.github/workflows/prayrequest.yml` — single workflow, auto-bless only, fires on `pull_request: [opened, ready_for_review]`. Uses `gh pr comment` with the default `GITHUB_TOKEN`. No LLM yet.
- `.github/prayrequest-verses.json` — 20 hardcoded verses with tag arrays + a default fallback.

There is no Node/Python project — the workflow is pure bash + `jq` (preinstalled on `ubuntu-latest`). Do **not** invent `npm test` / `pytest` style commands.

To test v0, push to GitHub and open a PR. There's no useful local test harness; verse-picking logic could be extracted and unit-tested but hasn't been.

v1 (next milestone in `docs/plan.md` § Roadmap) layers in the Claude API call, the `@PrayRequest` summon mode, and `@PrayRequest reroll`.

## What PrayRequest is

A GitHub bot that comments a context-matched Bible verse on every PR — verse + reference only, no commentary. Readers interpret it themselves. Implemented as a **GitHub Action** (not a GitHub App) that calls the Claude API and posts via `gh pr comment` using the default `GITHUB_TOKEN`. See `docs/plan.md` for full pitch, sample interactions, and tradeoff rationale.

## Architecture (target, per plan)

```
PR event → Actions runner → signal extraction → Claude API → gh pr comment
```

Three trigger modes share **one workflow file**, dispatched by event type:

| Mode        | Event                                          | Behavior                          |
|-------------|------------------------------------------------|-----------------------------------|
| Auto-bless  | `pull_request: [opened, ready_for_review]`     | Drop verse on PR open             |
| Summon      | `issue_comment: [created]` containing `@PrayRequest`        | Reply contextually to the thread  |
| Reroll      | `issue_comment` containing `@PrayRequest reroll`            | Generate an alternate verse       |

`issue_comment` covers PR comments because GitHub's API treats PRs as issues. Branching on event type inside one workflow keeps the surface area small.

**Signal extraction** runs *before* the LLM call to bias verse selection deterministically (hotfix detection, no-tests heuristic, security-path detection, TODO debt, massive-diff, force-push). These are passed as structured input to Claude so verse matching is predictable, not random. Full signal table in `docs/plan.md` § Signal extraction.

**Verse fallback:** a curated JSON of ~50 pre-tagged verses must exist to handle API failures, rate limits, and LLM hallucination of nonexistent references. Validate Claude's output against a known verse index before posting.

## Non-negotiable constraints from the plan

These are decisions already made — do **not** revisit without explicit user direction:

- **Action, not App.** Trade-off accepted: ~10s cold-start latency in exchange for zero infra and free `GITHUB_TOKEN` auth.
- **Opt-in per repo**, plus `[skip prayrequest]` in PR title and skip bot-authored PRs (Dependabot, Renovate). Religious sensitivity → never on by default for someone else's repo.
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
