// Outreach copy for each upsell segment. Plain language, real numbers, no
// "unlock" / "leverage" / "seamless". Each draft gets at most one joke.

export type Draft = { subject: string; body: string };

export type SegmentAInput = {
  teamName: string;
  callsLast30: number;
  callsRatio: number;
  storageGb: number;
  storageRatio: number;
  ioLast30: number;
  ioRatio: number;
  growthMultiple: number | null;
};

export function draftSegmentA(input: SegmentAInput): Draft {
  const metrics = [
    {
      name: "function calls",
      ratio: input.callsRatio,
      detail: `${Math.round(input.callsLast30).toLocaleString()} calls in the last 30 days (Free includes 1,000,000/month)`,
      capLine: "1,000,000 calls",
    },
    {
      name: "database storage",
      ratio: input.storageRatio,
      detail: `${input.storageGb.toFixed(2)} GB stored right now (Free includes 0.5 GB)`,
      capLine: "0.5 GB of storage",
    },
    {
      name: "database I/O",
      ratio: input.ioRatio,
      detail: `${input.ioLast30.toFixed(2)} GB moved in the last 30 days (Free includes 1 GB/month)`,
      capLine: "1 GB of I/O",
    },
  ];
  const closest = metrics.reduce((a, b) => (b.ratio > a.ratio ? b : a));
  const pct = Math.round(closest.ratio * 100);

  const subject = `${input.teamName}: ${pct}% of your Free ${closest.name} cap`;

  const growthLine =
    input.growthMultiple !== null && input.growthMultiple > 1.05 && Number.isFinite(input.growthMultiple)
      ? ` Usage is up ${input.growthMultiple.toFixed(1)}x over the last 30 days compared to the 30 before that — this isn't a one-week spike.`
      : "";

  const body = `Hi there,

You're at ${closest.detail} — ${pct}% of what Free includes.${growthLine}

Worth knowing: Free's limits are hard caps, not metered overage. Cross ${closest.capLine} in a month and functions start failing, not billing you.

Two ways off that cliff:
- Starter: same included amounts, but you pay as you go past them instead of hitting a wall.
- Professional ($25/seat/month): 25M calls, 50 GB storage, 50 GB I/O included, plus the stuff Free doesn't have — team roles, audit log, and S256 concurrency instead of S16.

Given the trend, Professional is probably worth looking at before you outgrow Starter too. Happy to walk through your numbers — no deck, I promise.
`;

  return { subject, body };
}

export type SegmentBInput = {
  teamName: string;
  callsLast30: number;
  callsRatio: number;
  storageGb: number;
  storageRatio: number;
  ioLast30: number;
  ioRatio: number;
  memberCount: number;
  overageCostUsd: number;
  proFlatCostUsd: number;
};

export function draftSegmentB(input: SegmentBInput): Draft {
  const savings = input.overageCostUsd - input.proFlatCostUsd;
  const pct = Math.round(Math.max(input.callsRatio, input.storageRatio, input.ioRatio) * 100);

  const subject =
    savings > 0
      ? `${input.teamName}: your overage bill is already past what Professional costs`
      : `${input.teamName}: at ${pct}% of Starter's included quota`;

  const lines: string[] = [];
  if (input.callsRatio > 1) {
    lines.push(
      `- Function calls: ${Math.round(input.callsLast30).toLocaleString()} in 30 days, ${Math.round((input.callsRatio - 1) * 100)}% over the 1M included.`,
    );
  }
  if (input.storageRatio > 1) {
    lines.push(
      `- Storage: ${input.storageGb.toFixed(2)} GB, ${(input.storageGb - 0.5).toFixed(2)} GB over the 0.5 GB included.`,
    );
  }
  if (input.ioRatio > 1) {
    lines.push(
      `- Database I/O: ${input.ioLast30.toFixed(2)} GB in 30 days, ${(input.ioLast30 - 1).toFixed(2)} GB over the 1 GB included.`,
    );
  }

  const body = `Hi there,

Your last 30 days on Starter:
${lines.join("\n")}

That's roughly $${input.overageCostUsd.toFixed(2)} in metered overage this month, on top of the plan itself. Professional is a flat $25/seat — for your ${input.memberCount}-person team that's $${input.proFlatCostUsd.toFixed(2)}/month.

${savings > 0 ? `You're already paying about $${savings.toFixed(2)} more than Professional would cost, and that gap grows every month usage does.` : "You're close to the point where the metered bill and the flat rate cross."} Professional also bumps you from S16 to S256 concurrency and includes 25M calls / 50 GB storage / 50 GB I/O outright, so this isn't just a pricing swap.

Want the full breakdown? Takes ten minutes.
`;

  return { subject, body };
}

export type SegmentCInput = {
  teamName: string;
  peakConcurrentMax: number;
  peakConcurrentRatio: number;
  deploymentCap: number;
  storageGb: number;
  storageRatio: number;
  callsLast30: number;
  callsRatio: number;
};

export function draftSegmentC(input: SegmentCInput): Draft {
  const pct = Math.round(input.peakConcurrentRatio * 100);
  const subject = `${input.teamName}: pushing ${pct}% of your S256 concurrency ceiling`;

  const otherLines: string[] = [];
  if (input.storageRatio >= 0.6) {
    otherLines.push(`storage at ${input.storageGb.toFixed(1)} GB of 50 GB included`);
  }
  if (input.callsRatio >= 0.6) {
    otherLines.push(`${Math.round(input.callsLast30).toLocaleString()} calls of the 25M included`);
  }
  const otherLine = otherLines.length > 0 ? ` You're also at ${otherLines.join(" and ")}.` : "";

  const body = `Hi there,

Peak concurrent queries have hit ${input.peakConcurrentMax.toFixed(1)} against your S256 deployment's ceiling of ${input.deploymentCap} — that's ${pct}%.${otherLine}

Professional's shared serverless capacity is designed to be outgrown eventually; S256 is the top of that ladder, not a dial you can turn further. Business and Enterprise plans run on dedicated deployment classes — D1024 and D2048 — so you get guaranteed capacity instead of headroom you're already using up. You'd also move from a 99.9% to a 99.95% SLA, which sounds small until it's your on-call rotation.

Worth a conversation before this shows up as latency instead of a line item.
`;

  return { subject, body };
}
