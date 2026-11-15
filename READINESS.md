# Readiness Report

## Summary

**Not fully ready for announcement day yet — but the blocking defects are identified, fixed in code, and the production module is sized to survive ×10 with CDN.** Local peak ×10 OOM-killed PostGIS and failed ~89% of requests; production therefore prioritises a larger Multi-AZ PostGIS, HA Redis, more EKS capacity, short announcement CDN TTLs, and a post-publish invalidation step. Do **not** enable day-long CDN caching for `/api/announcements/*`.

## Findings

| # | Issue | Severity | Evidence | Status |
|---|-------|----------|----------|--------|
| R1 | Map clicks slow up north; coastal admin boundaries return 150k–300k vertex GeoJSON (~5.5 MB, hundreds of ms) and stall the site | High | `evidence/tickets/r1-click-latency.txt` | **Fixed** — click geometry uses envelope for `admin_boundaries` (`features.service.ts`) |
| R2 | Site freezes every few minutes | High | `evidence/tickets/r2-summary-freeze.txt` — `admin_boundaries` summary ~0.5–1s via geodesic perimeter on 900k vertices; `SUMMARY_CACHE_TTL` was 120s | **Fixed** — envelope-based summary + TTL 600s; DB pool fail-fast timeouts |
| R3 | Partner blocked | High | `evidence/tickets/r3-*.txt` — quota 600/min keyed by **ingress IP** (`ratelimit:partner:10.42.0.6`); Redis limiter errors → HTTP 500 on one replica | **Fixed** — 1000/min **per API key**, `passOnStoreError`, resilient Redis client |
| C1 | Announcement freshness vs CDN | Critical for race | Inherited CDN cached `/api/announcements/*` for 86400s; API TTL was 3600s | **Fixed** — origin TTL 15s; CDN announcements `default_ttl=0` / `max_ttl=60`; race-week mode only lengthens tiles/API non-announcement paths |
| C2 | Landing-zone violations in `aws-production` | Blocker for network team | IGW + NAT present; missing org tags; public EKS endpoint | **Fixed** — TGW default routes, required tags, private EKS API |
| C3 | Capacity at ×10 / ×50 | Critical | `evidence/loadtests/CAPACITY.md` — ×10: 88.9% fail, PostGIS OOM; ×50: p95 10s timeouts | **Mitigated in prod design** — larger RDS/nodes/Redis + CDN tile offload; local laptop cannot validate prod scale |

## Capacity statement

**What breaks first at ×10:** without CDN, **tiles + PostGIS** (tile p95 ~50s, then PostGIS OOMKilled). API then times out (~10s) on almost everything (88.9% failures, ~578 req/s attempted).

**What breaks first at ×50:** the same bottleneck, faster — HTTP p95/p99 ~10s, heavy queueing; no new failure mode, just earlier collapse (~741 req/s attempted in 90s sample).

**Production expectation with this design:** CloudFront absorbs versioned `/tiles/*` (especially with `race_week_mode=true`). Origin must still handle API/partners; sizing targets ×10 web headroom on Multi-AZ `db.r6g.2xlarge` + API HPA 6–30. ×50 web without further CDN/edge caching of safe GETs is **not** claimed as proven.

## Next 7 days (prioritized)

1. **Apply `aws-production` in the landing zone** (TGW IDs from network account) and deploy chart with `values-production.yaml`.
2. **Enable `race_week_mode=true` before Thursday freeze**; keep announcements short-TTL; rehearse `aws cloudfront create-invalidation ... /api/announcements/*` immediately after publisher succeeds at 18:00.
3. **Pre-warm Martin/API replicas** (HPA min 6 / Martin 4) 24h before announcement; confirm partner keys still under 1000/min each.
4. **Page communications**: do **not** CDN-cache “everything for a full day” for announcements — tiles/basemap only.
5. **Freeze**: no deploys Thursday → race weekend; only emergency rollback + CDN invalidation playbooks.

## Next 90 days

- **DR:** Multi-AZ RDS + Redis already on; add cross-region snapshot copy and a documented restore drill; publisher replay for announcements.
- **SLO (needs client + Webiks agreement):** availability 99.9% monthly for `/api/health` and `/api/announcements/latest`; freshness SLO: new dataset visible globally ≤ 60s after publisher success (origin + CDN invalidation); map-click p95 ≤ 300 ms at baseline; partner 429 rate < 1% for keys within quota.
- Store simplified/generalized admin boundaries for interactive use; keep survey geometry for offline/GIS exports only.
- Add PgBouncer / RDS Proxy if connection storms recur.

## What I deliberately did not do, and why

- **Real AWS apply** — no cloud account in the brief; module is tested with `terraform test` instead.
- **Full ×50 soak / overnight soak** — ×10 already proved the hard limit; time better spent on prod sizing and CDN freshness.
- **Tracing** — metrics + two wake-up alerts shipped; tracing welcome later, not required to decide readiness.
- **Changing seed coastline complexity** — treated as a stand-in for production survey data; fixed the query path instead.

## Production design and cost

**Rough monthly (il-central-1, on-demand, exclude traffic spikes):**

| Component | Choice | Ballpark |
|-----------|--------|----------|
| EKS control plane | 1 cluster | ~$75 |
| Nodes | 6× m7g.2xlarge (scale → 18) | ~$1,500–1,800 |
| RDS PostGIS | db.r6g.2xlarge Multi-AZ, 1 TB gp3 | ~$1,200–1,600 |
| ElastiCache | 2× cache.r6g.xlarge HA | ~$700–900 |
| CloudFront | race-week GB transfer | highly variable ($100–1,000+) |
| **Total (steady)** | | **~$3.5–5k / month** |

**Main cost-versus-reliability trade-off:** paid for a **large Multi-AZ PostGIS and HA Redis plus spare node capacity** instead of the cheaper inherited `db.t4g.small` / single-node Redis / 3× m7g.large. Local evidence showed PostGIS memory is the first hard failure at ×10; saving money there would recreate announcement-day outage risk. CDN race-week tile caching is the cheap mitigator for the other half of the load.
