# Capacity measurements (local k3d)

Environment: single-node k3d `citymap`, Docker Desktop ~8 GB / 8 CPU.
PostGIS chart limit was 2 GiB during ×10 (OOM); later patched to 3 GiB for recovery.

Raw k6 exports: `code/traffic/results/`.

## Baseline (2m)

Files: `baseline-2m.txt`, `baseline-*.json`

| Metric | Value |
|--------|-------|
| HTTP request rate | ~54 req/s |
| Failed requests | **0.00%** |
| HTTP p95 | ~15 ms |
| tiles p95 | ~2 ms |
| partner_features p95 | ~6 ms |

## Peak ×10 (3m)

Files: `peak-x10-3m.txt`, `peak-x10-*.json`

| Metric | Value |
|--------|-------|
| Attempted rate | ~578 req/s |
| Failed requests | **88.87%** |
| API p95 / p99 | ~10.0s / ~16.9s (client timeout) |
| tiles p95 / max | **49.5s / 60s** |
| First failure mode | Tile origin latency, then API timeouts |
| Hard failure | PostGIS **OOMKilled (exit 137)** |

```text
kubectl ... lastState.terminated → {"exitCode":137,"reason":"OOMKilled"}
```

## Peak ×50 (90s)

Files: `peak-x50-90s.txt` (partial log), `peak-x50-*.json`

| Metric | Value |
|--------|-------|
| Attempted rate | ~741 req/s |
| Failed requests | **23.2%** in the short window (still collapsing; many 10s timeouts) |
| HTTP p95 / p99 | **10.0s / 10.1s** |
| Observation | Queueing saturates the API pool; readiness probes fail while DB is overloaded |

×50 does not “break a new component” — it accelerates the same PostGIS/origin saturation seen at ×10.

## What breaks first (answer for Shira)

1. **Without CDN:** Martin/PostGIS tile generation and PostGIS memory break first under web ×10.
2. **With production CDN (versioned tile URLs + race-week day TTL on `/tiles/*`):** most tile load leaves the origin; remaining risk is PostGIS CPU/memory for uncached clicks, summaries, and partner bbox queries.
3. **Production sizing in `aws-production` + `values-production.yaml`:** Multi-AZ `db.r6g.2xlarge`, HA Redis, 6× `m7g.2xlarge` nodes (scale to 18), API HPA 6–30, Martin ×4 — chosen for reliability after measuring local OOM at ×10.
