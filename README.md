# PrayRequest

> **Every PR is a PrayRequest.**
> 合併之前，先讀一段。

A GitHub bot that comments a context-matched Bible verse on every Pull
Request — verse and reference, nothing else. The bot offers scripture
and steps back; readers project their own meaning onto it.

---

## What It Does

PrayRequest reads the PR title and diff shape, picks a matching verse
from a curated list, and posts it as a comment. A sample of the
mapping:

| PR pattern                            | Verse reference   | Vibe                              |
|---------------------------------------|-------------------|-----------------------------------|
| `hotfix:` / `urgent` / `critical`     | 馬太福音 16:26    | what does it profit a man         |
| `refactor:` or 500+ lines / 20+ files | 啟示錄 21:5       | behold, I make all things new     |
| `feat:` / new feature                 | 創世記 1:31       | and it was good                   |
| `security` / `auth` / `admin` paths   | 詩篇 127:1        | except the Lord guard the city    |
| `fix:` / `bug` / `patch`              | 詩篇 51:10        | create in me a clean heart        |
| `revert:` / `rollback`                | 約拿書 2:2        | out of the depths I cried         |
| `test:` / `spec`                      | 雅各書 1:3        | testing of your faith             |
| `docs:` / `readme`                    | 提摩太後書 3:16   | all scripture is profitable       |
| (no match)                            | 詩篇 23:4         | through the valley of the shadow  |

Full mapping in
[`.github/prayrequest-verses.json`](.github/prayrequest-verses.json) —
20 entries plus a default fallback. The matcher walks the file in
order; **first matching tag wins**.

---

## What It Looks Like

A `hotfix:` PR gets:

> > 人若賺得全世界，賠上自己的生命，有甚麼益處呢？
> > — *馬太福音 16:26*
>
> *— 🙏 PrayRequest*

A 500+ line `refactor:` PR gets:

> > 看哪，我將一切都更新了。
> > — *啟示錄 21:5*
>
> *— 🙏 PrayRequest*

---

## When to Use

Real reasons teams put a verse on a PR — beyond "it's funny":

- **A pre-merge pause.** One non-functional line that doesn't summarize
  the diff, doesn't gate the merge, doesn't ping a reviewer. It just
  lives there. In teams where merge velocity is the only metric, a
  small ambient interruption is its own value.
- **Risk acknowledgment without finger-pointing.** A `hotfix` verse is
  a softer "are you sure?" than a red banner. The author and reviewer
  both read it; nobody has to type the word "YOLO" out loud.
- **Canonizing recurring memes.** Friday-night hotfixes, "I'll add
  tests later," 3,000-line refactors — these vibes recur but otherwise
  leave no artifact. The bot turns the meme into a durable thing in
  the PR timeline that future-you can scroll back through.
- **Cross-language team rituals.** Bilingual Chinese-English teams find
  「合併之前，先讀一段」 lands as an in-joke that survives translation
  in a way English-only humor doesn't.
- **Blameless callouts.** "PR touches `auth/middleware.ts`" plus
  詩篇 127:1 communicates the same thing as a bluntly-worded reviewer
  comment, but without singling anyone out. The verse is the medium;
  the targeting is implicit.
- **Onboarding signal.** New engineers learn which kinds of PRs the
  team treats as risky by noticing which verses keep showing up. The
  bot is a slow, ambient style guide.

When *not* to use:

- Repos where any religious reference would land badly. v3 plans
  alternate quote sources (Tao Te Ching, Sun Tzu, Shakespeare). Until
  then, opt-in only — never deploy to someone else's repo without
  asking.
- Bot-authored PRs (Dependabot, Renovate). Already auto-skipped.
- Solo repos where there's no audience for the joke.

---

## Status

The product is a hosted GitHub App, **PrayRequest** — install once at
the org level, no workflow file, summon in any PR thread with
`@prayrequest`. That's not built yet. Right now what exists is a v0
Action you can self-host. (The GitHub username `prayrequest` is
unclaimed as of this writing; the App's display name keeps the
"PrayRequest" casing, while the @-mention slug is lowercased per
GitHub convention and rendered as `@prayrequest[bot]`.)

- **v0 — Action PoC.** ✅ Shipped. Drop-in workflow, keyword-matched
  against title, hardcoded verses, auto-bless on PR open. Self-host
  path; not the long-term distribution. See *Try it now* below.
- **v1 — Claude-powered matching.** Replace the keyword matcher with
  the Claude API for context-aware verse selection (title +
  description + diff shape). Still workflow-based.
- **v2 — Hosted App `@prayrequest`.** The actual product. Install
  once at org level. Auto-bless on PR open, `@prayrequest` summon
  in any PR comment, `@prayrequest reroll` for an alternate.
  Likely also responds when added as a reviewer (the same way
  CodeRabbit and Greptile do — to be confirmed against GitHub App
  reviewer-permission docs).
- **v3 — Polish.** Alternate quote sources (Tao Te Ching, Sun Tzu,
  Shakespeare for non-religious teams), per-repo `prayrequest.yml`
  config, verse-fatigue dampening, 👍/👎 reaction feedback loop,
  Marketplace listing.

Full design and rationale: [`docs/plan.md`](docs/plan.md).

---

## Try It Now (v0 self-host)

Until the App ships, you can run the keyword-matched PoC by dropping
two files into your repo:

```
.github/
├── workflows/prayrequest.yml
└── prayrequest-verses.json
```

No API keys, no secrets, no GitHub App to register. The workflow posts
via the default `GITHUB_TOKEN` and runs on `ubuntu-latest` with only
`bash` and `jq` (preinstalled).

Open a PR to test. If the comment doesn't appear, check the Actions
tab — the most common cause is `pull-requests: write` being disabled
at the repo or org level.

### Configure

**Skip a single PR.** Include `[skip prayrequest]` anywhere in the PR
title.

**Skip bot PRs.** Already automatic. Dependabot, Renovate, and other
`Bot`-type users don't trigger the workflow.

**Customize verses.** Edit `.github/prayrequest-verses.json`. Each
entry has `tags`, `verse`, and `ref`. Two rules to know:

1. **JSON order is priority.** The first verse with any tag matching
   the PR title (case-insensitive, word-boundary) wins. Put specific
   tags like `security` and `hotfix` *before* generic ones like `feat`
   and `fix`, otherwise `feat: add admin endpoint` matches `feat`
   instead of `security` → `admin`.
2. **The `massive` tag is auto-selected** when a PR has more than 500
   additions or 20 changed files. Currently mapped to the refactor
   verse.

The `default` block at the bottom is the fallback when no tag matches.

---

## Why

YOLO PRs — Friday 6pm hotfixes, no-test merges, 3,000-line refactors,
"I'll add tests later" — are a recurring team meme but leave no
artifact. PrayRequest canonizes the vibe.

The verse-only format is intentional. The bot offers scripture and
gets out of the way. Whether the reader takes it as prayer, joke,
omen, or noise is up to them — and that ambiguity is the design.
