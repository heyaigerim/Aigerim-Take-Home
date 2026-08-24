# Convex upsell analysis & outreach motion

## Methodology

Three segments, each tied to a specific Convex plan and a specific commercial trigger. Segment membership (which teams qualify) is fixed by hard thresholds against real Convex plan limits (convex.dev/pricing, docs.convex.dev/production/state/limits). Within a qualifying segment, teams are ranked by `priorityScore` to decide outreach order.

For every team, computed from the last 30 days of `usageDaily`: sum of function calls, sum of DB bandwidth/IO, the latest day's storage value (a snapshot, not summed), and the max peak concurrent queries. The first 30 days of calls are also summed, to derive a growth signal.

**Plan limits used:**

| Plan | Calls/month | Storage | DB I/O/month | Concurrency |
|---|---|---|---|---|
| Free / Starter | 1,000,000 | 0.5 GB | 1 GB | S16 (16) |
| Professional | 25,000,000 | 50 GB | 50 GB | S256 (256) |

**Segment definitions (unchanged by this pass):**

- **Segment A — Free, approaching hard cap.** `plan == Free` and (calls/1M ≥ 0.7 OR storage/0.5 ≥ 0.7 OR IO/1 ≥ 0.7). Free's limits are hard caps, not billed overage — these teams are heading toward functions failing outright.
- **Segment B — Starter, already paying overage.** `plan == Starter` and any of those same three ratios is > 1.0 — they're being billed metered overage today.
- **Segment C — Professional, pushing S256.** `plan == Pro` and (peakConcurrent/deploymentCap ≥ 0.6 OR storage/50 ≥ 0.6 OR calls/25M ≥ 0.6), where deploymentCap is 16 for `largestDeploymentClass: "s16"` and 256 for `"s256"`.

**Severity:** the average of the segment's defining ratios, each capped at 20 so one extreme outlier metric can't dominate.

**priorityScore (current formula, `convex/planLimits.ts` + `convex/upsell.ts`):**

Segments A and B (Free, Starter) weight toward teams that are already running production traffic and have room to grow across projects, and dampen pure usage spikes that aren't backed by real growth:

```
priorityScore = severity
  × (prodDeploymentCount >= 1 ? 1.15 : 0.85)
  × growthMultiplier
  × (1 + 0.03 × projectCount)
```

Segment C (Professional) keeps seats as the direct proxy for MRR at stake, and treats a production deployment as a signal the concurrency pressure is real, not a load test:

```
priorityScore = severity
  × (1 + 0.05 × memberCount)
  × growthMultiplier
  × (prodDeploymentCount >= 1 ? 1.1 : 0.9)
```

**growthMultiplier** — log-scaled and capped at 1.5x so a team with a near-zero call baseline that "grows" to a large multiple can't dominate the ranking on that artifact alone:

```
callGrowthX = (calls in both windows are 0) ? null : callsLast30 / max(callsFirst30, 1)
growthMultiplier = callGrowthX === null ? 1.0 : min(1 + 0.05 × ln(max(callGrowthX, 1)), 1.5)
```

**Regional overage pricing:** Segment B's "you're already paying more than Professional would cost" claim computes actual overage dollars from Free/Starter per-unit rates ($2.20/1M calls, $0.22/GB storage, $0.22/GB I/O). EU-west pricing is 1.3x US (docs.convex.dev/production/state/limits) — that multiplier is now applied to the per-unit rates before computing overage cost for any team with `region == "eu-west"`.

## A note on the data

A number of accounts in this dataset are already many multiples past their plan's nominal limit — including "Free" teams at 20x+ the storage cap. Real Convex would have throttled or billed that before it got there, so this reflects the dataset being illustrative rather than enforcement-accurate. Rather than treat that as noise to filter out, overshoot is treated as signal: a team already far past a limit is, if anything, a more urgent outreach candidate than one approaching it — which is what the capped-severity scoring does with it.

The one exception is Kormarch Games (see Segment B note below) — usage that's real in the data but doesn't read as a real customer. The discipline that applies going forward: severity alone doesn't clear an account for outreach if the underlying traffic pattern doesn't look human (flat, no variance, near-zero concurrency at high volume). Worth a manual skim of the top of each list before every outreach cycle, not just a trust of the score.

---

## Segment A shortlist — Free, approaching hard cap

Top 8 by priorityScore. Storage is the dominant trigger for almost this entire segment — most of these teams are 10–20x over the 0.5 GB Free storage cap while barely touching their call quota, which reads as "data-heavy app on the wrong plan" rather than "about to hit a wall on traffic."

| # | Team | Contact | Priority | Calls | Storage | I/O |
|---|---|---|---|---|---|---|
| 1 | Grucrest Bio | ivy.larsen@gmail.com | 8.59 | 0% | 2276% | 0% |
| 2 | Halbourne Analytics | nina@halbourne.com | 8.14 | 0% | 2171% | 3% |
| 3 | Zanwick Health | elena.haddad@zanwick.co | 5.93 | 0% | 1874% | 0% |
| 4 | Tangrove Media | otto.okoro@proton.me | 5.61 | 64% | 38% | 1647% |
| 5 | Fenspire Health | iris.reyes@proton.me | 4.39 | 1% | 1325% | 89% |
| 6 | Indmarch Analytics | omar@indmarch.com | 4.15 | 132% | 7% | 1086% |
| 7 | Velridge Cloud | elena.bergstrom@velridge.io | 3.75 | 1% | 878% | 5% |
| 8 | Indvale Media | noah.silva@yahoo.com | 3.69 | 6% | 1134% | 32% |

## Segment B shortlist — Starter, already paying overage

Top 8 by priorityScore, with estimated current monthly overage vs. flat Professional cost.

**Kormarch Games (teamId 132945) has been excluded from this shortlist** — flagged in `convex/upsell.ts` as `MANUAL_REVIEW_EXCLUSIONS`, not deleted from the seeded data. Its 90-day usage is a flat ~2.2–3.4M calls/day pattern with no day-to-day variance and `peakConcurrentQueries` never above 0.76, on a solo account with 0 production deployments — reads as a scripted/load-test loop, not organic customer growth. Marked "likely automated/test traffic, needs manual account review" rather than routed to outreach. Calreach Media (previously #9) moves up into the #8 slot below.

| # | Team | Contact | Priority | Calls | Storage | I/O | Est. overage | Pro flat cost |
|---|---|---|---|---|---|---|---|---|
| 1 | Arcgate Works | ivy@outlook.com | 18.00 | 66% | 4385% | 3586% | $16.10 | $25.00 |
| 2 | Pavwick Media | raj@pavwick.ai | 14.14 | 77% | 11196% | 1359% | $14.98 | $25.00 |
| 3 | Torwick Logistics | maya.larsen@gmail.com | 13.98 | 76% | 10805% | 2074% | $16.12 | $25.00 |
| 4 | Jungrove Digital | elena.ibarra@jungrove.co | 13.72 | 569% | 2354% | 1991% | $16.95 | $25.00 |
| 5 | Melmarch Health | hana.quinn@melmarch.io | 11.39 | 717% | 707% | 1263% | $21.83 | $25.00 |
| 6 | Halharbor Games | ben.reyes@halharbor.co | 10.48 | 2% | 3427% | 196% | $3.87 | $25.00 |
| 7 | Norcliff Health | dev@proton.me | 10.30 | 82% | 1902% | 332% | $2.49 | $25.00 |
| 8 | Calreach Media | malik.oyelaran@outlook.com | 9.93 | 12% | 2162% | 241% | $3.35 | $50.00 |

## Segment C shortlist — Professional, pushing S256

Top 8 by priorityScore. This segment skews toward call-volume and I/O growth well past what S256 concurrency was sized for — Cynmere Health and Hexmarch Group are both running call volumes 80–120x their included 25M/month.

| # | Team | Contact | Priority | Calls | Storage | Peak concurrent |
|---|---|---|---|---|---|---|
| 1 | Cynmere Health | sam@cynmere.io | 20.13 | 8487% | 174% | 2417% |
| 2 | Wexhaven Dynamics | malik.ashworth@wexhaven.io | 18.89 | 4721% | 623% | 1176% |
| 3 | Hexmarch Group | petra@hexmarch.com | 17.85 | 12393% | 187% | 1687% |
| 4 | Torbourne Media | nina@torbourne.io | 16.26 | 7538% | 171% | 1201% |
| 5 | Vinshore Commerce | theo.kaur@vinshore.com | 16.17 | 5173% | 769% | 457% |
| 6 | Pavmoor Logistics | raj@pavmoor.com | 13.58 | 4920% | 801% | 404% |
| 7 | Sarbrook Labs | priya.nakamura@sarbrook.com | 13.57 | 3470% | 670% | 45% |
| 8 | Calhollow Networks | elena.oyelaran@calhollow.co | 13.52 | 3330% | 869% | 51% |

## The motion

Trigger, not blast. Each segment gets a different trigger, owner, and channel — not one "you're using a lot of Convex!" email to everyone.

**Segment A (Free → Starter/Pro).** In-product first: a dashboard banner and email at the moment a team crosses ~70% of a Free cap, written like an ops alert, not a sales email. No human follow-up until they reply or hit the cap and open a support ticket — by then the pain is already real.

Live draft for the current #1 team (Grucrest Bio), pulled from `upsell:outreachDraft`:

> **Subject: Grucrest Bio: 2276% of your Free database storage cap**
>
> Hi there,
>
> You're at 11.38 GB stored right now (Free includes 0.5 GB) — 2276% of what Free includes.
>
> Worth knowing: Free's limits are hard caps, not metered overage. Cross 0.5 GB of storage in a month and functions start failing, not billing you.
>
> Two ways off that cliff:
> - Starter: same included amounts, but you pay as you go past them instead of hitting a wall.
> - Professional ($25/seat/month): 25M calls, 50 GB storage, 50 GB I/O included, plus the stuff Free doesn't have — team roles, audit log, and S256 concurrency instead of S16.
>
> Given the trend, Professional is probably worth looking at before you outgrow Starter too. Happy to walk through your numbers — no deck, I promise.

**Segment B (Starter → Professional).** Founder/growth-lead outreach, timed to land right after a billing cycle closes, so the overage line item is fresh. Lead with their own numbers and a real computed breakeven, not a generic "upgrade now."

Live draft for the current #1 team (Arcgate Works), pulled from `upsell:outreachDraft`:

> **Subject: Arcgate Works: at 4385% of Starter's included quota**
>
> Hi there,
>
> Your last 30 days on Starter:
> - Storage: 21.93 GB, 21.43 GB over the 0.5 GB included.
> - Database I/O: 35.86 GB in 30 days, 34.86 GB over the 1 GB included.
>
> That's roughly $16.10 in metered overage this month, on top of the plan itself. Professional is a flat $25/seat — for your 1-person team that's $25.00/month.
>
> You're close to the point where the metered bill and the flat rate cross. Professional also bumps you from S16 to S256 concurrency and includes 25M calls / 50 GB storage / 50 GB I/O outright, so this isn't just a pricing swap.
>
> Want the full breakdown? Takes ten minutes.

**Segment C (Professional → Business/Enterprise).** Sales-assist, not an email blast — multi-seat teams here expect a conversation. The email's job is just to get the call booked.

Live draft for the current #1 team (Cynmere Health), pulled from `upsell:outreachDraft`:

> **Subject: Cynmere Health: pushing 2417% of your S256 concurrency ceiling**
>
> Hi there,
>
> Peak concurrent queries have hit 6186.5 against your S256 deployment's ceiling of 256 — that's 2417%. You're also at storage at 87.0 GB of 50 GB included and 2,121,727,663 calls of the 25M included.
>
> Professional's shared serverless capacity is designed to be outgrown eventually; S256 is the top of that ladder, not a dial you can turn further. Business and Enterprise plans run on dedicated deployment classes — D1024 and D2048 — so you get guaranteed capacity instead of headroom you're already using up. You'd also move from a 99.9% to a 99.95% SLA, which sounds small until it's your on-call rotation.
>
> Worth a conversation before this shows up as latency instead of a line item.

**Voice notes:** short paragraphs, real numbers instead of "significant usage," plain verbs, one joke max per email, no "unlock," "leverage," "seamless," or "supercharge." Convex's own copy leans on lines like "all gas, no breakages" — confident and dry, never hypey.

---

## Ranking changes from the previous priorityScore formula

Segment membership didn't change (same thresholds). Within-segment order shifted:

- **Segment A:** mostly stable — ranks 1–6 only swapped #1/#2 (Grucrest Bio and Halbourne Analytics traded places). **Velridge Cloud entered the top 8 (was #9), displacing Torreach Systems (was #8, now outside).**
- **Segment B:** the most reshuffled segment, since `prodDeploymentCount` and `projectCount` weren't factors before. **Norcliff Health and Halharbor Games entered the top 8 (were #11 and #14), displacing Junridge Interactive and Nyxbrook Bio.** Arcgate Works jumped from #3 to #1.
- **Segment C:** stable — same 8 teams, only #1/#2 (Cynmere Health, Wexhaven Dynamics) and #3/#5 (Hexmarch Group, Vinshore Commerce) swapped.

---

## What I'd watch post-launch

- **Segment A conversion** should be near-immediate — it's a "your app breaks otherwise" trigger. Slow conversion means the copy or timing is off, not the targeting.
- **Segment B breakeven accuracy** — if teams push back that Professional isn't actually cheaper for them, the per-account overage math needs a second look (it's computed from real usage and now real regional pricing, so this would flag an assumption worth revisiting).
- **Segment C sales cycle length** — track separately from the other two, since it's the only segment with a real sales cycle and would otherwise distort the read on whether the faster segments are working.
- **Recurring anomaly check** — Kormarch Games was caught by hand this round. Worth a lightweight repeatable check (e.g. flag any account with near-zero peak concurrency alongside high call volume) before each outreach cycle, so the next one isn't manual.
