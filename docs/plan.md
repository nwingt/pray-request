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
| **Cost** | ~$0.002 per PR. ~$2/month at 1,000 PRs. |
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
- **Low-cost to start.** v0 ships as a single workflow file with no
  infra. v2 graduates to a hosted App when adoption justifies it.
- **Opt-in per PR.** Auto-bless only fires when `@prayrequest` appears
  in the PR title or body. Repos that install the App don't get a
  verse on every PR — only on the ones that ask for one.

---

## What It Does

Three trigger modes:

| Mode | Trigger | Behavior |
|---|---|---|
| **Auto-bless** | PR opened / ready_for_review *with `@prayrequest` in title or body* | Drop one verse + reference on PR open |
| **Summon** | `@prayrequest` in any PR comment | Reply contextually to the thread |
| **Reroll** | `@prayrequest reroll` | Generate an alternate verse if the first didn't land |

Optional future modes:
- **Last rites** — verse on merge ("rest in peace, prod")
- **Point-blessing** — `@prayrequest bless @reviewer` to bless someone else
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
| Verse fallback | **Curated JSON** of ~20 pre-tagged verses + default | Used if API fails or rate-limited |
| Config | `.github/prayrequest.yml` per repo | Verse language, opt-out paths, alternate quote sources |
| Optional analytics | **PostHog** | Track 👍/👎 reactions to learn which verses land |

### Action vs GitHub App

Both have a place. Trade-off:

| | GitHub Action | GitHub App |
|---|---|---|
| Setup | Drop a workflow file per repo | Install once at org level |
| Distribution | Self-host / Marketplace publish | `@prayrequest` install link |
| Latency | ~10s (runner cold start) | sub-second |
| Auth | Free with `GITHUB_TOKEN` | Manage app secrets, host server |
| Cost | Free at small scale | Hosting + ops |
| Summon UX | Workflow listens on `issue_comment` | Native `@mention`, request-review |

**Verdict:** v0/v1 ship as an Action because it's faster to build and
proves out the verse-matching logic with zero infra. **v2 graduates to
a hosted GitHub App (`@prayrequest`)** because that's how teams
actually adopt review-bots — install once, no per-repo workflow file,
@-mention or add-as-reviewer to summon. The Action stays available as
the self-host path.

#### Request-review as a trigger

GitHub Apps can be added to `requested_reviewers` and respond on
`pull_request: [review_requested]`, the same way CodeRabbit and
Greptile do. So `@prayrequest` could plausibly work both as an
@-mention summon and as a "add the bot as a reviewer" target. The UI
affordance of *appearing in the reviewer picker* without typing is
currently a Copilot-only privilege (first-party integration), but the
underlying API capability exists for any App with the right
permissions. Worth confirming against GitHub docs before locking the
v2 spec.

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

The realistic adoption path is the **hosted `@prayrequest` GitHub
App** — install once at the org level, no workflow file. The Action
is the bootstrap PoC and the long-term self-host fallback while the
App is built.

### v0 — Action PoC (½ day) ✅
- Single workflow, auto-bless only
- Hard-coded list of 20 verses chosen by simple keyword match (no AI)
- Goal: prove the comment plumbing works

### v2 — Hosted GitHub App: `@prayrequest` ✅ (code; deploy pending)
- The actual product. Install once at org level, no per-repo workflow
  file required.
- `app/` — Cloudflare Workers + TypeScript + Hono. Webhook handler
  verifies `X-Hub-Signature-256`, mints installation tokens, posts
  via the App's bot identity.
- Auto-bless on `pull_request: [opened, ready_for_review]`
- `@prayrequest` mention in any PR comment → summon
- `@prayrequest reroll` → walks the issue's comments, finds the bot's
  last verse, excludes it from the next pick
- **No LLM yet** — same keyword matcher as v0, ported to TypeScript
  in `app/src/verse-picker.ts`, importing the same
  `.github/prayrequest-verses.json`. Action and App behave identically.
- Action remains available as the self-host path
- Open: **Request-review as trigger** — add `@prayrequest` as a
  reviewer, respond on `pull_request: [review_requested]`.
  Underlying API supports this for any App; UI sidebar prominence
  may stay Copilot-only. To be confirmed.

### v1 — Claude-powered matching (deferred until App distribution proven)
- Replace `pickVerse` in `app/src/verse-picker.ts` with a Claude API
  call (full PR context: title + description + diff shape + signals)
- Validate Claude's output against the curated verse JSON to guard
  against hallucinated references; fall back to keyword matcher on
  API failure or invalid response
- Same surface (auto-bless, summon, reroll), smarter picks
- The Action path likely stays keyword-only as the zero-secret
  self-host option — flipping it to LLM would require users to set
  `ANTHROPIC_API_KEY` in repo secrets, defeating the "drop in two
  files" pitch.

### v3 — Polish (open-ended)
- React-emoji feedback loop (👍/👎 → log to PostHog)
- Verse-fatigue dampening (don't repeat same verse within N PRs)
- Per-repo config (`.github/prayrequest.yml`): language, alternate quote
  sources (Tao Te Ching, Sun Tzu, Shakespeare for non-religious teams)
- Publish App on Marketplace, landing page, docs

---

## Sample Interactions

### Friday 6:47pm hotfix
**PR:** `hotfix: payment gateway timeout (URGENT)` — +3 / −1, no tests

> > 人若賺得全世界，賠上自己的生命，有甚麼益處呢？
> > — *馬太福音 16:26*
>
> *— 🙏 PrayRequest*

### Massive refactor
**PR:** `refactor: rewrite auth module` — +2,847 / −3,102, 30 files

> > 看哪，我將一切都更新了。
> > — *啟示錄 21:5*
>
> *— 🙏 PrayRequest*

### No tests added
**PR:** `feat: add user export to CSV` — +312 / −4, 0 test files

> > 信心若沒有行為就是死的。
> > — *雅各書 2:17*
>
> *— 🙏 PrayRequest*

### Security path touched
**PR:** `fix: bypass JWT check for internal calls` — touches `middleware/auth.ts`

> > 若不是耶和華看守城池，看守的人就枉然儆醒。
> > — *詩篇 127:1*
>
> *— 🙏 PrayRequest*

### TODO debt
**Diff:**
```diff
+ // TODO: handle edge case when user has no email
+ // FIXME: this is a hack, refactor later
```

> > 掩蓋自己罪過的，必不亨通；承認且離棄罪過的，必蒙憐恤。
> > — *箴言 28:13*
>
> *— 🙏 PrayRequest*

---

## Risks & Considerations

| Risk | Mitigation |
|---|---|
| **Religious sensitivity** | Opt-in per repo. Allow alternate quote sources (Tao Te Ching, Sun Tzu, Shakespeare). Verse + reference only — no editorial commentary, so the bot never appears to be mocking the verse or the author. |
| **Cost runaway** | Daily comment cap per repo. Fallback to curated verse list if API errors. Skip bot-authored PRs. |
| **Spam fatigue** | Auto-bless is opt-in per PR (`@prayrequest` must appear in title or body); silent on every PR that doesn't ask for it. Don't auto-bless on `synchronize` events (only initial open). |
| **Verse repetition** | Track recently-used verses per repo, dampen reuse within N PRs. |
| **LLM hallucination of verses** | Validate Claude's output against a known verse index; fall back to curated list if reference doesn't exist. |
| **Verse–context mismatch** | Maintain a small eval set of PR scenarios + expected verse category; run before each prompt change. |

---

## Open Questions

1. **Default language: English, Cantonese, or bilingual?** Bilingual is the
   most "us" but verbose in comments.
2. **Should it bless reviewers too, or only authors?** Reviewer-blessing is
   funnier but adds noise.
3. **Self-host the LLM call vs use Anthropic API directly from the Action?**
   Direct is simpler; self-hosted gives caching/rate-limit control.
4. **App reviewer integration**: confirm `requested_reviewers` works for a
   third-party App without Copilot-tier UI privileges. If yes, advertise
   "add `@prayrequest` as a reviewer" as a first-class summon mode.

---

## Tagline candidates (pick one for the repo README)

- **"Every PR is a PrayRequest."** ← primary
- **"Submit your PrayRequest."**
- **"Where every PR comes with a prayer."**
- **"PrayRequest — because `LGTM` won't save you."**
- **"For when `LGTM` isn't enough."**
- **「合併之前，先讀一段。」**

### Comment format

```
> [verse]
> — *[reference]*

*— 🙏 PrayRequest*
```

---

## Next Step

v0 ✅ shipped (Action). v2 ✅ code-shipped (App at `app/`, no LLM yet).
Next: deploy the App to Cloudflare, register the GitHub App entry,
install on a test repo, and validate auto-bless / summon / reroll
end-to-end. Setup checklist in [`app/README.md`](../app/README.md).

Once distribution is proven, v1 layers in: swap the `pickVerse`
keyword matcher in `app/src/verse-picker.ts` for a Claude API call
with full PR context. The Action stays keyword-only so its
zero-secret pitch survives.
