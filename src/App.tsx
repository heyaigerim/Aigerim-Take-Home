import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

type SegmentKey = "A" | "B" | "C";
type MetricKey = "calls" | "storage" | "io" | "peakConcurrent";

const SEGMENT_META: Record<SegmentKey, { title: string; kicker: string; blurb: string }> = {
  A: {
    title: "Segment A — Free, approaching hard cap",
    kicker: "FREE → STARTER / PRO",
    blurb: "Free plan teams at 70%+ of calls, storage, or DB I/O. Free has no overage billing — these teams hit a wall, not a bill.",
  },
  B: {
    title: "Segment B — Starter, already paying overage",
    kicker: "STARTER → PROFESSIONAL",
    blurb: "Starter plan teams already over 100% of an included quota — they're being billed metered overage today.",
  },
  C: {
    title: "Segment C — Professional, pushing S256",
    kicker: "PROFESSIONAL → BUSINESS / ENTERPRISE",
    blurb: "Pro plan teams at 60%+ of concurrency, storage, or call volume — approaching the ceiling of shared serverless capacity.",
  },
};

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(2).replace(/\.00$/, "");
}

function Gauge({
  label,
  value,
  limit,
  ratio,
  unit,
  signature,
}: {
  label: string;
  value: number;
  limit: number;
  ratio: number;
  unit: string;
  signature: boolean;
}) {
  const pct = Math.min(ratio * 100, 100);
  const over = ratio > 1;
  const color = signature
    ? undefined
    : over
      ? "var(--severity-high)"
      : ratio >= 0.7
        ? "var(--severity-mid)"
        : "var(--severity-low)";

  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-dim)" }}>
        <span>{label}</span>
        <span className="mono">
          {formatNumber(value)}
          {unit} / {formatNumber(limit)}
          {unit} ({Math.round(ratio * 100)}%)
        </span>
      </div>
      <div className="gauge-track">
        <div
          className="gauge-fill"
          style={{
            width: `${pct}%`,
            background: signature ? "var(--gradient-signature)" : color,
          }}
        />
        <div className="gauge-tick" style={{ left: "25%" }} />
        <div className="gauge-tick" style={{ left: "50%" }} />
        <div className="gauge-tick" style={{ left: "75%" }} />
      </div>
    </div>
  );
}

function topPriorityMetric(candidate: any, segment: SegmentKey): MetricKey {
  const entries: [MetricKey, number][] =
    segment === "C"
      ? [
          ["calls", candidate.metrics.calls.ratio],
          ["storage", candidate.metrics.storage.ratio],
          ["peakConcurrent", candidate.metrics.peakConcurrent.ratio],
        ]
      : [
          ["calls", candidate.metrics.calls.ratio],
          ["storage", candidate.metrics.storage.ratio],
          ["io", candidate.metrics.io.ratio],
        ];
  return entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

function TeamCard({
  segment,
  candidate,
  signatureMetric,
}: {
  segment: SegmentKey;
  candidate: any;
  signatureMetric: MetricKey | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const draft = useQuery(api.upsell.outreachDraft, expanded ? { teamId: candidate.teamId } : "skip");

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <strong>{candidate.teamName}</strong>{" "}
          <span style={{ color: "var(--text-dim)", fontSize: 13 }}>
            {candidate.plan} · {candidate.memberCount} member{candidate.memberCount === 1 ? "" : "s"} · {candidate.contactEmail}
          </span>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="mono" style={{ fontSize: 28, color: "#f2a93c", lineHeight: 1 }}>
            {candidate.priorityScore.toFixed(2)}
          </div>
          <div className="mono" style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Priority
          </div>
        </div>
      </div>

      <div style={{ marginTop: 6 }}>
        <Gauge
          label="Function calls (30d)"
          value={candidate.metrics.calls.value}
          limit={candidate.metrics.calls.limit}
          ratio={candidate.metrics.calls.ratio}
          unit=""
          signature={signatureMetric === "calls"}
        />
        <Gauge
          label="DB storage"
          value={candidate.metrics.storage.value}
          limit={candidate.metrics.storage.limit}
          ratio={candidate.metrics.storage.ratio}
          unit=" GB"
          signature={signatureMetric === "storage"}
        />
        {segment !== "C" && (
          <Gauge
            label="DB I/O (30d)"
            value={candidate.metrics.io.value}
            limit={candidate.metrics.io.limit}
            ratio={candidate.metrics.io.ratio}
            unit=" GB"
            signature={signatureMetric === "io"}
          />
        )}
        {segment === "C" && candidate.metrics.peakConcurrent && (
          <Gauge
            label="Peak concurrent queries"
            value={candidate.metrics.peakConcurrent.value}
            limit={candidate.metrics.peakConcurrent.limit}
            ratio={candidate.metrics.peakConcurrent.ratio}
            unit=""
            signature={signatureMetric === "peakConcurrent"}
          />
        )}
      </div>

      {segment === "B" && (
        <div className="mono" style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 4 }}>
          Est. overage this month: ${candidate.overageCostUsd?.toFixed(2)} vs. Professional flat cost $
          {candidate.proFlatCostUsd?.toFixed(2)}
        </div>
      )}

      <button
        className="pill-btn"
        onClick={() => setExpanded((e) => !e)}
        style={{
          marginTop: 10,
          fontSize: 13,
          padding: "5px 14px",
          border: "1px solid var(--border)",
          background: "var(--bg)",
          color: "var(--text)",
        }}
      >
        {expanded ? "Hide outreach draft" : "View outreach draft"}
      </button>

      {expanded && (
        <div style={{ marginTop: 10, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, padding: 12 }}>
          {draft === undefined && <p style={{ margin: 0 }}>Loading draft…</p>}
          {draft === null && <p style={{ margin: 0 }}>No draft available.</p>}
          {draft && (
            <>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{draft.subject}</div>
              <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", margin: 0, fontSize: 13, color: "var(--text-dim)" }}>
                {draft.body}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<SegmentKey>("A");
  const segmentA = useQuery(api.upsell.segmentA);
  const segmentB = useQuery(api.upsell.segmentB);
  const segmentC = useQuery(api.upsell.segmentC);

  const data: Record<SegmentKey, any[] | undefined> = { A: segmentA, B: segmentB, C: segmentC };
  const candidates = data[tab];
  const meta = SEGMENT_META[tab];
  const topMetric = candidates && candidates.length > 0 ? topPriorityMetric(candidates[0], tab) : null;

  return (
    <main style={{ fontFamily: "var(--font-body)", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, letterSpacing: "0.01em", margin: "0 0 16px" }}>
        Headroom
      </h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(Object.keys(SEGMENT_META) as SegmentKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="pill-btn"
            style={{
              padding: "8px 16px",
              border: tab === key ? "1px solid var(--text)" : "1px solid var(--border)",
              background: tab === key ? "var(--text)" : "transparent",
              color: tab === key ? "var(--bg)" : "var(--text)",
              fontSize: 13,
              fontFamily: "var(--font-display)",
              textTransform: "uppercase",
              letterSpacing: "0.03em",
            }}
          >
            Segment {key} {data[key] ? `(${data[key]!.length})` : ""}
          </button>
        ))}
      </div>

      <div className="kicker" style={{ marginBottom: 10 }}>
        {meta.kicker}
      </div>
      <h2 style={{ marginBottom: 4, fontFamily: "var(--font-display)", fontWeight: 400, fontSize: 20 }}>{meta.title}</h2>
      <p style={{ color: "var(--text-dim)", marginTop: 0 }}>{meta.blurb}</p>

      {candidates === undefined && <p>Loading…</p>}
      {candidates && candidates.length === 0 && <p>No candidates in this segment.</p>}
      {candidates &&
        candidates.map((c, i) => (
          <TeamCard key={c.teamId} segment={tab} candidate={c} signatureMetric={i === 0 ? topMetric : null} />
        ))}
    </main>
  );
}
