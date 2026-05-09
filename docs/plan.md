# PrayRequest

> Every PR is a PrayRequest.
> 合併之前，先讀一段。

A GitHub bot that drops a context-aware Bible verse on every Pull Request —
matched to the title, description, and diff. Just the verse and the reference;
readers interpret it however they want.

---

## TL;DR

| | |
|---|---|
| **What** | GitHub bot that comments a Bible verse on PRs, matched to the PR's context |
| **Why** | Team's YOLO-PR culture has no artifact. Canonize the vibe. |
| **How** | GitHub Action → Claude API → `gh pr comment` |
| **Cost** | ~$0.005 per PR. ~$5/month at 1,000 PRs. |
| **Build effort** | PoC in 1 day. MVP in 2–3 days. |
| **Risk** | Religious sensitivity → opt-in per repo, alternate quote sources optional. |

---

## The Pitch

**Problem.** YOLO PRs — Friday 6pm hotfixes, no-test merges, 3,000-line
refactors, "I'll add tests later" — are a recurring team meme but leave
no artifact. The vibe deserves canonization.

**Solution.** PrayRequest auto-comments a fitting Bible verse and reference.
It reads the PR context (title, description, diff shape) and picks scripture
that matches the energy. No editorial commentary — the verse stands alone.

**Why it works.**
- **Context-aware, not random.** A `hotfix` PR gets a different verse than a
  refactor. That's the joke.
- **No commentary, no offense.** Verse + reference only. The reader does the
  interpretation. Lowers religious-sensitivity risk and makes the bot easy to
  localize without rewriting tone.
- **Low-cost to build.** One Action + one API call. No server, no webhook,
  no GitHub App registration.
- **Easy to disable.** Per-repo opt-in, `[skip prayrequest]` in title, or just
  delete the workflow file.

---

## What It Does

Three trigger modes:

| Mode | Trigger | Behavior |
|---|---|---|
| **Auto-bless** | PR opened / ready_for_review | Drop one verse + reference on PR open |
| **Summon** | `@PrayRequest` in any PR comment | Reply contextually to the thread |
| **Reroll** | `@PrayRequest reroll` | Generate an alternate verse if the first didn't land |

Optional future modes:
- **Last rites** — verse on merge ("rest in peace, prod")
- **Point-blessing** — `@PrayRequest bless @reviewer` to bless someone else
- **Daily verse** — scheduled team-wide verse via repo discussions

---

## How It Works

```
┌─────────────────┐
│  GitHub PR      │ opened / commented
│  event          │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│  GitHub Actions runner      │
│                             │
│  1. Extract context:        │
│     • title                 │
│     • description           │
│     • diff stats            │
│     • file paths touched    │
│     • signals (no tests,    │
│       hotfix, security,     │
│       TODO/FIXME, size)     │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  Claude API                 │
│  (sonnet-4-6 or haiku-4-5)  │
│                             │
│  System prompt asks for:    │
│  • Bible verse matching     │
│    the PR's energy          │
│  • Reference (book ch:v)    │
│  • JSON output              │
│  (No commentary — verse     │
│   speaks for itself)        │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  gh pr comment              │
│  (uses GITHUB_TOKEN)        │
└─────────────────────────────┘
```

### Trigger detection

```yaml
on:
  pull_request:
    types: [opened, ready_for_review]
  issue_comment:
    types: [created]
```

A single workflow handles both auto and @mention modes. `issue_comment` covers
PR comments because GitHub treats PRs as a subtype of issues at the API layer.

### Signal extraction

Before calling Claude, the Action enriches the PR with cheap heuristic signals
that bias verse selection:

| Signal | Detection | Vibe |
|---|---|---|
| Friday-late hotfix | title contains `hotfix\|urgent`, time after 5pm Fri | YOLO max |
| No tests | diff touches `src/` but no `test\|spec` files | faith-without-works |
| Security path | files in `auth/\|middleware/\|admin/` | watchman of the city |
| TODO debt | diff adds `TODO\|FIXME\|XXX` | hidden things |
| Massive diff | >500 lines or >20 files changed | new creation |
| Force push | commit count drop | revisionist |

Signals are passed to Claude as structured input so verse matching is
predictable and non-random.

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Trigger / runtime | **GitHub Actions** | Free for public repos, generous private quota, no infra |
| Comment posting | **`gh` CLI** | Uses default `GITHUB_TOKEN`, zero auth setup |
| LLM | **Claude API** (sonnet-4-6 default, haiku-4-5 for cost mode) | Better vibe-matching than smaller models, prompt caching cuts cost |
| Verse fallback | **Curated JSON** of ~50 pre-tagged verses | Used if API fails or rate-limited |
| Config | `.github/prayrequest.yml` per repo | Verse language, opt-out paths, alternate quote sources |
| Optional analytics | **PostHog** | Track 👍/👎 reactions to learn which verses land |

### Why not a real GitHub App?

Considered. Trade-off:

| | GitHub Action | GitHub App |
|---|---|---|
| Setup | Drop a workflow file | Register app, host server, handle webhooks |
| Latency | ~10s (runner cold start) | sub-second |
| Auth | Free with `GITHUB_TOKEN` | Manage app secrets, install per org |
| Cost | Free at small scale | Hosting + ops |

**Verdict:** start as Action. If we hit a latency problem (we won't — it's a
joke bot), graduate to App later.

---

## Costs

Per-PR cost breakdown using Claude Sonnet 4.6 with prompt caching:

| Item | Tokens | Cost |
|---|---|---|
| Cached system prompt | ~800 in (cached) | negligible |
| PR context (title + desc + diff summary) | ~500 in | $0.0015 |
| Output (verse + reference) | ~50 out | $0.0008 |
| **Per PR** | | **~$0.002** |

At 1,000 PRs/month: **~$2**. At 10,000: ~$20. The Actions runner minutes are
within most plans' free tier.

A Haiku-only "cost mode" cuts this by ~5×.

---

## Roadmap

### v0 — PoC (½ day)
- Single workflow, auto-bless only
- Hard-coded list of 20 verses chosen by simple keyword match (no AI)
- Goal: prove the comment plumbing works

### v1 — MVP (2–3 days)
- Claude-powered verse matching with full PR context
- All 3 trigger modes (auto / summon / reroll)
- `[skip prayrequest]` opt-out via PR title
- Skip bot-authored PRs (Dependabot, Renovate)

### v2 — Smart (1 week)
- React-emoji feedback loop (👍/👎 → log to PostHog)
- Verse-fatigue dampening (don't repeat same verse within N PRs)
- Per-repo config (`.github/prayrequest.yml`): language, alternate quote
  sources (Tao Te Ching, Sun Tzu, Shakespeare for non-religious teams)

### v3 — Public (open-ended)
- Publish to GitHub Marketplace as a reusable Action
- Landing page, docs, examples
- Optional: managed-hosted version as a real GitHub App for orgs that want
  zero setup

---

## Sample Interactions

### Friday 6:47pm hotfix
**PR:** `hotfix: payment gateway timeout (URGENT)` — +3 / −1, no tests

> 🙏 **PrayRequest received.**
>
> > 「人若賺得全世界，賠上自己的生命，有甚麼益處呢？」
> > — *馬太福音 16:26*

### Massive refactor
**PR:** `refactor: rewrite auth module` — +2,847 / −3,102, 30 files

> 🙏 **PrayRequest received.**
>
> > 「看哪，我將一切都更新了。」
> > — *啟示錄 21:5*

### No tests added
**PR:** `feat: add user export to CSV` — +312 / −4, 0 test files

> 🙏 **PrayRequest received.**
>
> > 「信心若沒有行為就是死的。」
> > — *雅各書 2:17*

### Security path touched
**PR:** `fix: bypass JWT check for internal calls` — touches `middleware/auth.ts`

> 🙏 **PrayRequest received.**
>
> > 「若不是耶和華看守城池，看守的人就枉然儆醒。」
> > — *詩篇 127:1*

### TODO debt
**Diff:**
```diff
+ // TODO: handle edge case when user has no email
+ // FIXME: this is a hack, refactor later
```

> 🙏 **PrayRequest received.**
>
> > 「掩蓋自己罪過的，必不亨通；承認且離棄罪過的，必蒙憐恤。」
> > — *箴言 28:13*

---

## Risks & Considerations

| Risk | Mitigation |
|---|---|
| **Religious sensitivity** | Opt-in per repo. Allow alternate quote sources (Tao Te Ching, Sun Tzu, Shakespeare). Verse + reference only — no editorial commentary, so the bot never appears to be mocking the verse or the author. |
| **Cost runaway** | Daily comment cap per repo. Fallback to curated verse list if API errors. Skip bot-authored PRs. |
| **Spam fatigue** | `[skip prayrequest]` keyword in title. Per-author opt-out via `.github/prayrequest.yml`. Don't auto-bless on `synchronize` events (only initial open). |
| **Verse repetition** | Track recently-used verses per repo, dampen reuse within N PRs. |
| **LLM hallucination of verses** | Validate Claude's output against a known verse index; fall back to curated list if reference doesn't exist. |
| **Verse–context mismatch** | Maintain a small eval set of PR scenarios + expected verse category; run before each prompt change. |

---

## Open Questions

1. **Public Marketplace Action or internal-only?** Public maximizes reach but
   raises support burden.
2. **Default language: English, Cantonese, or bilingual?** Bilingual is the
   most "us" but verbose in comments.
3. **Should it bless reviewers too, or only authors?** Reviewer-blessing is
   funnier but adds noise.
4. **Self-host the LLM call vs use Anthropic API directly from the Action?**
   Direct is simpler; self-hosted gives caching/rate-limit control.

---

## Tagline candidates (pick one for the repo README)

- **"Every PR is a PrayRequest."** ← primary
- **"Submit your PrayRequest."**
- **"Where every PR comes with a prayer."**
- **"PrayRequest — because `LGTM` won't save you."**
- **"For when `LGTM` isn't enough."**
- **「合併之前，先讀一段。」**

### Bot reply opener template

```
🙏 **PrayRequest received.**

> *[verse]*
> — *[reference]*
```

---

## Next Step

Build v0 PoC: a single `.github/workflows/prayrequest.yml` that auto-comments one
of 20 hardcoded verses on PR open, keyword-matched. ~2 hours of work. Drops
into any repo as a single file. Use it as the demo for team buy-in before
investing in v1.
