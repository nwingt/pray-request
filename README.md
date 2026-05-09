# PrayRequest

> **Every PR is a PrayRequest.**
> 合併之前，先讀一段。

A GitHub Action that drops a context-matched Bible verse on every Pull
Request. Verse and reference only — no commentary, no snark. Readers
interpret it however they want.

---

## What it looks like

A `hotfix:` PR gets:

> 🙏 **PrayRequest received.**
>
> > 「人若賺得全世界，賠上自己的生命，有甚麼益處呢？」
> > — *馬太福音 16:26*

A `refactor:` PR (or any 500+ line diff) gets:

> 🙏 **PrayRequest received.**
>
> > 「看哪，我將一切都更新了。」
> > — *啟示錄 21:5*

A `feat:` PR gets:

> 🙏 **PrayRequest received.**
>
> > 「神看著一切所造的都甚好。」
> > — *創世記 1:31*

The full title-tag-to-verse mapping lives in
[`.github/prayrequest-verses.json`](.github/prayrequest-verses.json).

---

## Install (v0)

Copy two files into your repo:

```
.github/
├── workflows/prayrequest.yml
└── prayrequest-verses.json
```

No API keys, no secrets, no app to register. The workflow posts via the
default `GITHUB_TOKEN` and runs on `ubuntu-latest` with only `bash` and
`jq` (preinstalled).

Open a PR to test. If the comment doesn't appear, check the Actions tab
— the most common issue is `pull-requests: write` permission being
disabled at the repo or org level.

---

## Configure

**Skip a single PR.** Include `[skip prayrequest]` anywhere in the PR
title.

**Skip bot PRs.** Already automatic. Dependabot, Renovate, and other
`Bot`-type users don't trigger the workflow.

**Customize verses.** Edit `.github/prayrequest-verses.json`. Each entry
has `tags`, `verse`, and `ref`. Two rules to know:

1. **JSON order is priority.** The first verse with any tag matching the
   PR title (case-insensitive, word-boundary) wins. Put specific tags
   like `security` and `hotfix` *before* generic ones like `feat` and
   `fix`, otherwise `feat: add admin endpoint` matches `feat` instead of
   `security` → `admin`.
2. **The `massive` tag is auto-selected** when a PR has more than 500
   additions or 20 changed files. Currently mapped to the refactor
   verse.

The `default` block at the bottom is the fallback when no tag matches.

---

## Status

- **v0** — Shipped. Keyword-match against title, hardcoded verses, auto-bless on PR open.
- **v1** — Next. Claude API for context-aware verse matching;
  `@PrayRequest` summon mode; `@PrayRequest reroll` for an alternate
  verse.
- **v2** — Per-repo `prayrequest.yml` config, alternate quote sources
  (Tao Te Ching, Sun Tzu, Shakespeare for non-religious teams),
  verse-fatigue dampening, 👍/👎 reaction feedback loop.
- **v3** — Publish to GitHub Marketplace as a reusable Action.

Full design and rationale: [`docs/plan.md`](docs/plan.md).

---

## Why

YOLO PRs — Friday 6pm hotfixes, no-test merges, 3,000-line refactors,
"I'll add tests later" — are a recurring team meme but leave no
artifact. PrayRequest canonizes the vibe.
