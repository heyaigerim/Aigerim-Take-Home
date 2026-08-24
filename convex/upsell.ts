import { query } from "./_generated/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import {
  draftSegmentA,
  draftSegmentB,
  draftSegmentC,
  type Draft,
} from "./emailTemplates";
import {
  FREE_STARTER_LIMITS,
  PRO_LIMITS,
  DEPLOYMENT_CAPS,
  OVERAGE_RATE,
  PRO_SEAT_PRICE,
  regionOverageMultiplier,
  WINDOW_DAYS,
  RATIO_CAP,
} from "./planLimits";

type UsageRow = Doc<"usageDaily">;

// The first-30/last-30 comparison needs two non-overlapping windows. Below this many days of
// history the windows would share rows and double-count them, so growth is left unmeasured
// instead (callsFirst30/growthMultiple come back null).
const MIN_HISTORY_DAYS_FOR_GROWTH = 60;

function computeUsageStats(rows: UsageRow[]) {
  const sorted = rows.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  const last30 = sorted.slice(-WINDOW_DAYS);

  const callsLast30 = last30.reduce((s, r) => s + r.functionCalls, 0);
  const ioLast30 = last30.reduce((s, r) => s + r.dbBandwidthGb, 0);
  const latestStorage = sorted[sorted.length - 1]?.dbStorageGb ?? 0;
  const peakConcurrentMax = last30.reduce((m, r) => Math.max(m, r.peakConcurrentQueries), 0);

  let callsFirst30: number | null = null;
  let growthMultiple: number | null = null;
  if (sorted.length >= MIN_HISTORY_DAYS_FOR_GROWTH) {
    const first30 = sorted.slice(0, WINDOW_DAYS);
    callsFirst30 = first30.reduce((s, r) => s + r.functionCalls, 0);
    growthMultiple = callsFirst30 > 0 ? callsLast30 / callsFirst30 : callsLast30 > 0 ? Infinity : 0;
  }

  return { callsLast30, callsFirst30, ioLast30, latestStorage, peakConcurrentMax, growthMultiple };
}

function capped(ratio: number) {
  return Math.min(ratio, RATIO_CAP);
}

// callGrowthX is null when there's fewer than 60 days of history (no non-overlapping windows to
// compare) or when a team has zero calls in both windows (no growth signal at all). Otherwise
// it's last30/first30, floored at a baseline of 1 call so a near-zero baseline doesn't produce an
// outsized ratio; log-scaled and capped at 1.5x so growth alone can't dominate ranking.
function growthMultiplierFor(callsFirst30: number | null, callsLast30: number): number {
  if (callsFirst30 === null) return 1.0;
  const callGrowthX = callsFirst30 === 0 && callsLast30 === 0 ? null : callsLast30 / Math.max(callsFirst30, 1);
  return callGrowthX === null ? 1.0 : Math.min(1 + 0.05 * Math.log(Math.max(callGrowthX, 1)), 1.5);
}

function priorityScoreAB(severity: number, prodDeploymentCount: number, growthMultiplier: number, projectCount: number) {
  return severity * (prodDeploymentCount >= 1 ? 1.15 : 0.85) * growthMultiplier * (1 + 0.03 * projectCount);
}

function priorityScoreC(severity: number, memberCount: number, growthMultiplier: number, prodDeploymentCount: number) {
  return severity * (1 + 0.05 * memberCount) * growthMultiplier * (prodDeploymentCount >= 1 ? 1.1 : 0.9);
}

async function usageForTeam(ctx: { db: any }, teamId: number) {
  return await ctx.db
    .query("usageDaily")
    .withIndex("by_teamId_date", (q: any) => q.eq("teamId", teamId))
    .collect();
}

type SegmentKey = "A" | "B" | "C";

// Teams manually excluded from a segment's shortlist/outreach despite meeting the threshold.
// The seeded team/usage records are untouched — this is a presentation-layer override only,
// applied after review of the raw usage pattern.
const MANUAL_REVIEW_EXCLUSIONS: Partial<Record<SegmentKey, number[]>> = {
  B: [
    // Kormarch Games — 90-day usage is a flat, ~2.2-3.4M calls/day pattern with no day-to-day
    // variance and peakConcurrentQueries never above 0.76, on a solo account with 0 production
    // deployments. Reads as a scripted/load-test loop, not organic customer growth.
    // Likely automated/test traffic — needs manual account review before outreach.
    132945,
  ],
};

type Candidate = {
  segment: SegmentKey;
  teamId: number;
  teamName: string;
  plan: string;
  contactEmail: string;
  memberCount: number;
  metrics: {
    calls: { value: number; limit: number; ratio: number };
    storage: { value: number; limit: number; ratio: number };
    io: { value: number; limit: number; ratio: number };
    peakConcurrent?: { value: number; limit: number; ratio: number };
  };
  growthMultiple: number | null;
  overageCostUsd?: number;
  proFlatCostUsd?: number;
  severity: number;
  priorityScore: number;
};

async function buildCandidates(ctx: { db: any }, segment: SegmentKey): Promise<Candidate[]> {
  const teams: Doc<"teams">[] = await ctx.db.query("teams").collect();
  const wantPlan = segment === "A" ? "Free" : segment === "B" ? "Starter" : "Pro";
  const results: Candidate[] = [];

  for (const team of teams) {
    if (team.plan !== wantPlan) continue;
    if (MANUAL_REVIEW_EXCLUSIONS[segment]?.includes(team.teamId)) continue;
    const usage = await usageForTeam(ctx, team.teamId);
    if (usage.length === 0) continue;
    const stats = computeUsageStats(usage);
    const growthMultiplier = growthMultiplierFor(stats.callsFirst30, stats.callsLast30);

    if (segment === "A" || segment === "B") {
      const callsRatio = stats.callsLast30 / FREE_STARTER_LIMITS.calls;
      const storageRatio = stats.latestStorage / FREE_STARTER_LIMITS.storageGb;
      const ioRatio = stats.ioLast30 / FREE_STARTER_LIMITS.ioGb;

      const qualifies =
        segment === "A"
          ? callsRatio >= 0.7 || storageRatio >= 0.7 || ioRatio >= 0.7
          : callsRatio > 1.0 || storageRatio > 1.0 || ioRatio > 1.0;
      if (!qualifies) continue;

      const severity = (capped(callsRatio) + capped(storageRatio) + capped(ioRatio)) / 3;

      const candidate: Candidate = {
        segment,
        teamId: team.teamId,
        teamName: team.teamName,
        plan: team.plan,
        contactEmail: team.contactEmail,
        memberCount: team.memberCount,
        metrics: {
          calls: { value: stats.callsLast30, limit: FREE_STARTER_LIMITS.calls, ratio: callsRatio },
          storage: { value: stats.latestStorage, limit: FREE_STARTER_LIMITS.storageGb, ratio: storageRatio },
          io: { value: stats.ioLast30, limit: FREE_STARTER_LIMITS.ioGb, ratio: ioRatio },
        },
        growthMultiple: stats.growthMultiple,
        severity,
        priorityScore: priorityScoreAB(severity, team.prodDeploymentCount, growthMultiplier, team.projectCount),
      };

      if (segment === "B") {
        const regionMult = regionOverageMultiplier(team.region);
        const overageCostUsd =
          (Math.max(0, stats.callsLast30 - FREE_STARTER_LIMITS.calls) / 1_000_000) *
            OVERAGE_RATE.callsPerMillion *
            regionMult +
          Math.max(0, stats.latestStorage - FREE_STARTER_LIMITS.storageGb) * OVERAGE_RATE.storagePerGb * regionMult +
          Math.max(0, stats.ioLast30 - FREE_STARTER_LIMITS.ioGb) * OVERAGE_RATE.ioPerGb * regionMult;
        candidate.overageCostUsd = overageCostUsd;
        candidate.proFlatCostUsd = PRO_SEAT_PRICE * team.memberCount;
      }

      results.push(candidate);
    } else {
      const deploymentCap = DEPLOYMENT_CAPS[team.largestDeploymentClass] ?? 256;
      const peakRatio = stats.peakConcurrentMax / deploymentCap;
      const storageRatio = stats.latestStorage / PRO_LIMITS.storageGb;
      const callsRatio = stats.callsLast30 / PRO_LIMITS.calls;

      const qualifies = peakRatio >= 0.6 || storageRatio >= 0.6 || callsRatio >= 0.6;
      if (!qualifies) continue;

      const severity = (capped(peakRatio) + capped(storageRatio) + capped(callsRatio)) / 3;

      results.push({
        segment,
        teamId: team.teamId,
        teamName: team.teamName,
        plan: team.plan,
        contactEmail: team.contactEmail,
        memberCount: team.memberCount,
        metrics: {
          calls: { value: stats.callsLast30, limit: PRO_LIMITS.calls, ratio: callsRatio },
          storage: { value: stats.latestStorage, limit: PRO_LIMITS.storageGb, ratio: storageRatio },
          io: { value: stats.ioLast30, limit: PRO_LIMITS.ioGb, ratio: stats.ioLast30 / PRO_LIMITS.ioGb },
          peakConcurrent: { value: stats.peakConcurrentMax, limit: deploymentCap, ratio: peakRatio },
        },
        growthMultiple: stats.growthMultiple,
        severity,
        priorityScore: priorityScoreC(severity, team.memberCount, growthMultiplier, team.prodDeploymentCount),
      });
    }
  }

  return results.sort((a, b) => b.priorityScore - a.priorityScore);
}

export const segmentA = query({
  args: {},
  handler: async (ctx) => buildCandidates(ctx, "A"),
});

export const segmentB = query({
  args: {},
  handler: async (ctx) => buildCandidates(ctx, "B"),
});

export const segmentC = query({
  args: {},
  handler: async (ctx) => buildCandidates(ctx, "C"),
});

export const outreachDraft = query({
  args: { teamId: v.number() },
  handler: async (ctx, { teamId }): Promise<Draft | null> => {
    const team = await ctx.db
      .query("teams")
      .withIndex("by_teamId", (q) => q.eq("teamId", teamId))
      .unique();
    if (!team) return null;

    const usage = await usageForTeam(ctx, teamId);
    if (usage.length === 0) return null;
    const stats = computeUsageStats(usage);

    if (team.plan === "Free") {
      const callsRatio = stats.callsLast30 / FREE_STARTER_LIMITS.calls;
      const storageRatio = stats.latestStorage / FREE_STARTER_LIMITS.storageGb;
      const ioRatio = stats.ioLast30 / FREE_STARTER_LIMITS.ioGb;
      if (callsRatio < 0.7 && storageRatio < 0.7 && ioRatio < 0.7) return null;
      return draftSegmentA({
        teamName: team.teamName,
        callsLast30: stats.callsLast30,
        callsRatio,
        storageGb: stats.latestStorage,
        storageRatio,
        ioLast30: stats.ioLast30,
        ioRatio,
        growthMultiple: stats.growthMultiple,
      });
    }

    if (team.plan === "Starter") {
      if (MANUAL_REVIEW_EXCLUSIONS.B?.includes(teamId)) return null;
      const callsRatio = stats.callsLast30 / FREE_STARTER_LIMITS.calls;
      const storageRatio = stats.latestStorage / FREE_STARTER_LIMITS.storageGb;
      const ioRatio = stats.ioLast30 / FREE_STARTER_LIMITS.ioGb;
      if (callsRatio <= 1.0 && storageRatio <= 1.0 && ioRatio <= 1.0) return null;
      const regionMult = regionOverageMultiplier(team.region);
      const overageCostUsd =
        (Math.max(0, stats.callsLast30 - FREE_STARTER_LIMITS.calls) / 1_000_000) *
          OVERAGE_RATE.callsPerMillion *
          regionMult +
        Math.max(0, stats.latestStorage - FREE_STARTER_LIMITS.storageGb) * OVERAGE_RATE.storagePerGb * regionMult +
        Math.max(0, stats.ioLast30 - FREE_STARTER_LIMITS.ioGb) * OVERAGE_RATE.ioPerGb * regionMult;
      return draftSegmentB({
        teamName: team.teamName,
        callsLast30: stats.callsLast30,
        callsRatio,
        storageGb: stats.latestStorage,
        storageRatio,
        ioLast30: stats.ioLast30,
        ioRatio,
        memberCount: team.memberCount,
        overageCostUsd,
        proFlatCostUsd: PRO_SEAT_PRICE * team.memberCount,
      });
    }

    if (team.plan === "Pro") {
      const deploymentCap = DEPLOYMENT_CAPS[team.largestDeploymentClass] ?? 256;
      const peakConcurrentRatio = stats.peakConcurrentMax / deploymentCap;
      const storageRatio = stats.latestStorage / PRO_LIMITS.storageGb;
      const callsRatio = stats.callsLast30 / PRO_LIMITS.calls;
      if (peakConcurrentRatio < 0.6 && storageRatio < 0.6 && callsRatio < 0.6) return null;
      return draftSegmentC({
        teamName: team.teamName,
        peakConcurrentMax: stats.peakConcurrentMax,
        peakConcurrentRatio,
        deploymentCap,
        storageGb: stats.latestStorage,
        storageRatio,
        callsLast30: stats.callsLast30,
        callsRatio,
      });
    }

    return null;
  },
});
