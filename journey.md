# Journey — CityMap Reliability Task (Itzik Gabay)

This file is the step-by-step record of what changed, **why**, and **how it was tested**. Code changes were kept to the minimum needed for the brief and `CONSTRAINTS.md`.

---

## Constraints checklist (re-verified)

| Constraint | How we comply | Test |
|------------|---------------|------|
| No IGW / No NAT in workload account | Removed both; default routes use Transit Gateway | `terraform test` asserts TGW on `0.0.0.0/0` |
| `transit_gateway_id` / attachment vars | Added variables; attachment optional via flag | Plan succeeds with mock provider |
| Inbound only via CloudFront + ingress LB | CloudFront origin = ingress domain; no public EKS API | Assert `endpoint_public_access == false` |
| Required tags `Project`, `Owner`, `DataClassification` | `default_tags` in `tags.tf` | Present on provider |
| Region `il-central-1` | Default `var.region` | Unchanged default |
| No external SaaS observability | Prometheus + Grafana in-cluster (`make observe`) | `kubectl apply -k deploy/observability` |
| Public data embeddable | Left CORS `origin: '*'` | Existing behaviour preserved |
| Personal data only in CityMap DB/backups | No new stores for PII | Review of changes |
| Partner quota 1000/min each | Per-API-key limiter at 1000 | Curl burst + Redis keys |

---

## Step 0 — Baseline

**What:** Imported the task as received (no functional edits).

**Why:** Clean starting point for incremental commits.

**Test:** N/A (import only).

---

## Part 1.1 — Run / deploy locally

**What:** `make destroy && make cluster && make deploy && make seed` (ops only; no app code). Fixed broken first image by rebuilding PostGIS `17-4` so `CREATE EXTENSION postgis` works.

**Why:** Cannot investigate tickets or capacity without a running system. Martin was CrashLoopBackOff until PostGIS extension existed.

**Test:**
- `curl http://localhost:8080/api/health` → `{"status":"ok","db":"up"}`
- `curl http://localhost:8080/tiles/catalog` → 200
- Seed row counts: parcels 50k, addresses 100k, admin_boundaries 50 (~900k vertices)

**Code change:** none required beyond using the provided Makefile/Terraform.

---

## Part 1.2 — Observability (self-hosted only)

**What (minimal):**
- API `/metrics` via `prom-client` (`code/services/api/src/metrics.ts` + hook in `main.ts`)
- `code/deploy/observability/` — Prometheus, Grafana, dashboard JSON, alert rules
- `make observe`

**Why:** Brief requires metrics, dashboard-as-code, ≥2 wake-up alerts; CONSTRAINTS forbid SaaS.

**Alerts chosen (would page on):**
1. `CityMapHighErrorRate` — 5xx ratio > 5% for 2m  
2. `CityMapHighLatency` — p95 on click/summary > 1s for 3m  
(+ `CityMapApiDown` as scrape survival)

**Test:**
- `make observe` → pods in `observability`
- `curl http://localhost:8080/api/metrics` returns Prometheus text
- Dashboard committed: `code/deploy/observability/grafana-dashboard.json`
- Rules committed: `code/deploy/observability/prometheus-config.yaml`

---

## Part 1.3 — Investigate tickets (evidence before fixes)

### R1 — Map slow when clicking (especially north)

**Finding:** Four northern coastal districts have 150k–300k vertices each. Click returned full `ST_AsGeoJSON` (~5.5 MB, slow).

**Why change:** Full survey geometry on interactive click saturates CPU/Redis and matches the ticket.

**Minimal fix:** Return `ST_Envelope(geom)` for `admin_boundaries` on click only (`layer-sources` + `features.service`).

**Test:** `evidence/tickets/r1-click-latency.txt` and postfix — size ~5.5 MB → ~381 B; HTTP ~15 ms.

### R2 — Freezes every few minutes

**Finding:** `admin_boundaries` summary used geodesic `ST_Area`/`ST_Perimeter` on ~900k vertices (~0.5–1s). Cache TTL was 120s → periodic stall. Under peak, DB pool hung readiness.

**Minimal fix:** Envelope-based summary SQL; `SUMMARY_CACHE_TTL=600`; pool `connectionTimeoutMillis=2000` + `statement_timeout=5s`; liveness on `/health/live`.

**Test:** `evidence/tickets/r2-summary-freeze.txt`; uncached summary ~1s → ~14 ms after fix.

### R3 — Partner blocked

**Finding:** Limit was **600**/min keyed by **ingress IP** (`ratelimit:partner:10.42.0.6`), not per partner. Client promise is **1000/min per partner**. Dead Redis limiter client also caused HTTP 500s.

**Minimal fix:** `keyGenerator` from `X-Api-Key`; `PARTNER_RATE_LIMIT=1000`; `passOnStoreError`; resilient Redis options.

**Test:** `evidence/tickets/r3-*.txt` + postfix — 1000×200 then 429s for key1; key2 still has its own 1000 budget; Redis keys are `ratelimit:partner:key:…`.

---

## Part 1.4 — Load test + capacity statement

**What:** `make traffic DURATION=2m`, `make peak MULTIPLIER=10 DURATION=3m`, `make peak MULTIPLIER=50 DURATION=90s`. Committed raw k6 JSON + logs under `code/traffic/results/` and `evidence/loadtests/`.

**Why:** Brief asks what breaks first at ×10 and ×50 with measured numbers.

**Results (summary):**
| Scenario | Fail % | What broke first |
|----------|--------|------------------|
| Baseline | 0% | — |
| ×10 | ~89% | Tiles latency, then PostGIS **OOMKilled (137)** |
| ×50 | ~23% in short window (already collapsing) | Same bottleneck, faster (p95 ~10s) |

**Test:** Files in `evidence/loadtests/CAPACITY.md`; kubectl showed `OOMKilled` on PostGIS at ×10.

---

## Part 2.1 / 2.2 — Production Terraform vs CONSTRAINTS

**What (necessary for landing zone + race freshness):**
- Remove IGW/NAT; TGW default routes
- Required org tags via `default_tags`
- Private EKS endpoint
- Multi-AZ RDS + backups; HA Redis (sized after ×10 OOM — reliability over cost)
- CDN: announcements short TTL; `race_week_mode` lengthens **tiles** only
- Stronger `terraform test` assertions

**Why:** Inherited module violated CONSTRAINTS and would cache announcements for a day (conflicts with “see it right away”).

**Test:** `cd code/deploy/terraform/aws-production && terraform test` → **2 passed, 0 failed**.

**Helm overlay only:** `values-production.yaml` documents prod replica/memory targets (not applied locally by default).

---

## Part 2.3 — Cost + trade-off

Documented in `READINESS.md`: ~$3.5–5k/mo ballpark; trade-off = large Multi-AZ PostGIS/HA Redis/spare nodes instead of cheap small DB, because local ×10 OOM’d PostGIS.

---

## Deliverables

| File | Purpose |
|------|---------|
| `READINESS.md` | Report for Shira / client |
| `SOLUTION_LOG.md` | How work was done + AI use |
| `journey.md` | This file — what / why / how tested |
| `code/docs/RACE_WEEK.md` | CDN + freeze/publish runbook |
| Evidence dirs | Tickets + load tests |

---

## What we deliberately did **not** change

- Seed coastline geometry (stand-in for prod survey data) — fixed query path instead
- Martin/PostGIS image recipes beyond using the provided 17-4 tag
- Adding SaaS APM/tracing products
- Real AWS apply (optional; no account; no extra points)

---

## Commit map (exercise steps)

See `git log` — one commit per step:
1. Baseline import  
2. Observability  
3. Ticket evidence  
4. Ticket fixes (minimal API/Helm)  
5. Load-test results + capacity  
6. AWS production / CONSTRAINTS / terraform tests  
7. Readiness docs + journey + race-week notes  
