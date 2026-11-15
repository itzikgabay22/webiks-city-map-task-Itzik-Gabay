import { ENDPOINTS } from './metered.ts';

interface MetricValues { [k: string]: number }
interface SummaryData { metrics: Record<string, { values: MetricValues }>; state: { testRunDurationMs: number } }

const fmt = (n: number | undefined) => (n === undefined ? '-' : n >= 1000 ? `${(n / 1000).toFixed(2)}s` : `${n.toFixed(0)}ms`);

/** Writes the full k6 summary as JSON under traffic/results/ and prints a short per-endpoint table. */
export function writeSummary(data: SummaryData, label: string): Record<string, string> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const lines = [
    '',
    `CityMap traffic: ${label} (${(data.state.testRunDurationMs / 1000).toFixed(0)}s)`,
    '',
    `${'endpoint'.padEnd(18)}${'count'.padStart(8)}${'p50'.padStart(10)}${'p95'.padStart(10)}${'p99'.padStart(10)}${'max'.padStart(10)}`,
  ];
  for (const e of ENDPOINTS) {
    const m = data.metrics[`latency_${e}`]?.values;
    if (!m || !m.count) continue;
    lines.push(`${e.padEnd(18)}${String(m.count).padStart(8)}${fmt(m.med).padStart(10)}${fmt(m['p(95)']).padStart(10)}${fmt(m['p(99)']).padStart(10)}${fmt(m.max).padStart(10)}`);
  }
  const reqs = data.metrics.http_reqs?.values;
  const failed = data.metrics.http_req_failed?.values;
  const attempts = data.metrics.sdk_attempts?.values;
  const failedAttempts = data.metrics.sdk_failed_attempts?.values;
  const dropped = data.metrics.dropped_iterations?.values;
  lines.push(
    '',
    `http requests: ${reqs?.count ?? 0} (${(reqs?.rate ?? 0).toFixed(1)}/s), failed: ${((failed?.rate ?? 0) * 100).toFixed(2)}%`,
    `sdk attempts: ${attempts?.count ?? 0}, failed attempts: ${failedAttempts?.count ?? 0}, dropped iterations: ${dropped?.count ?? 0}`,
    '',
  );
  return {
    stdout: lines.join('\n'),
    [`traffic/results/${label}-${stamp}.json`]: JSON.stringify(data, null, 2),
  };
}
