# Convex GTM Engineer challenge

Welcome!

In this repo are two synthetic datasets, designed to fit a similar shape to Convex's
real user data. One is a teams file, the other is a daily usage table. Both are in
CSV and JSONL formats.

Your assignment:

1. Look at Convex's pricing and limits documentation.
2. Analyze the data we've provided and find companies you think are good candidates
   for an upsell motion.
3. Design the motion and the outreach.
4. Build a Convex app to showcase your findings.

Feel free to use AI (you will use it heavily in the real job) but be prepared to
discuss your findings and reasoning. It should also be noted that we are allergic to
any copy that sounds like generic AI writing; make sure yours doesn't (bonus points if
you spend some time reading our blog and write in the "Convex voice").

Have fun!

---

## What I built

"Headroom" — a three-segment upsell dashboard scored live off `usageDaily`, not a static export. It flags Free teams approaching a hard cap, Starter teams already paying metered overage, and Professional teams pushing their S256 concurrency ceiling, ranks each segment by a priority score, and generates a personalized outreach draft per team straight from the same data.

## Running it

```
npm install
npx convex dev
npm run seed
npm run dev
```

`npx convex dev` pushes the schema and functions to a Convex deployment (local and anonymous by default, or your own account after `npx convex login`) and writes the deployment URL to `.env.local`. `npm run seed` imports `teams.jsonl` and `usage_daily.jsonl` into that deployment. `npm run dev` starts the frontend.

## Full writeup

See [analysis-and-motion.md](analysis-and-motion.md) for the methodology, plan-limit sourcing, segment shortlists, and the outreach motion per segment.

## Live deployment

https://robust-shrimp-932.convex.site
