// Plan limits + pricing constants: convex.dev/pricing + docs.convex.dev/production/state/limits (2026-08-23).

export const FREE_STARTER_LIMITS = { calls: 1_000_000, storageGb: 0.5, ioGb: 1 };
export const PRO_LIMITS = { calls: 25_000_000, storageGb: 50, ioGb: 50 };
export const DEPLOYMENT_CAPS: Record<string, number> = { s16: 16, s256: 256 };

// Free/Starter overage rates, US-region. EU-west is 1.3x per docs.convex.dev/production/state/limits.
export const OVERAGE_RATE = { callsPerMillion: 2.2, storagePerGb: 0.22, ioPerGb: 0.22 };
export const PRO_SEAT_PRICE = 25;

const REGION_OVERAGE_MULTIPLIER: Record<string, number> = { "eu-west": 1.3 };

export function regionOverageMultiplier(region: string): number {
  return REGION_OVERAGE_MULTIPLIER[region] ?? 1.0;
}

export const WINDOW_DAYS = 30;
export const RATIO_CAP = 20;
