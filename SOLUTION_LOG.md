# Solution Log

## Approach

Prioritised like a first-week reliability engineer with ~3 hours of focus:

1. **Make it run** (`make cluster/deploy/seed`) and get evidence before guessing tickets.
2. **Tickets + capacity** — measure R1/R2/R3 and peak ×10/×50; fix only what evidence supports.
3. **Production path** — land `aws-production` on CONSTRAINTS (TGW, tags, no IGW/NAT), CDN freshness for announcements, size for reliability over cost after seeing PostGIS OOM.
4. **Observability** — self-hosted Prometheus/Grafana with dashboard-as-code and wake-up alerts.
5. Write `READINESS.md` for Shira with numbers, not vibes.

Deliberately skipped: real cloud deploy, full tracing, overnight soak, redesigning the seed coastline.

## Log

| Time | What I did | Tool / AI prompt (summary) | Result | Did I accept, change, or reject the AI output? Why? |
|------|------------|----------------------------|--------|-----------------------------------------------------|
| T0 | Read INSTRUCTIONS, CONSTRAINTS, TICKETS, ARCHITECTURE, Makefile | — | Plan: deploy → measure → fix → prod → docs | — |
| T0 | `make destroy && make cluster && make deploy && make seed` | Shell | First deploy had PostGIS 17-3 without extension; clean rebuild to 17-4 fixed Martin | Accepted procedure from README |
| T1 | Measured north vs south clicks | curl + psql `ST_NPoints` | North coastal ~200k verts, ~5.5 MB payload | — |
| T1 | Measured partner limiter | redis-cli KEYS + burst curl | Keyed by IP; limit 600; Redis errors → 500 | — |
| T1 | Timed admin summary | psql `\timing` | ~0.5–1s geodesic perimeter; TTL 120s → R2 | — |
| T2 | Fixed API (envelope click/summary, per-key 1000/min, metrics, short announcement TTL) | AI-assisted code edits, reviewed | Built image 1.4.3; postfix evidence shows 54 KB / 1000-per-key | **Changed** AI’s first simplify-on-click: still too expensive under peak → switched to envelope |
| T2 | Observability kustomize (Prometheus + Grafana + alerts) | AI-assisted manifests | `make observe` | Accepted lean stack over kube-prometheus-stack (RAM) |
| T3 | Rewrote `aws-production` for TGW/tags/CDN/HA | AI-assisted Terraform | `terraform test` 2/2 pass | **Rejected** cheap sizing; upsized after ×10 OOM per user guidance (reliability > cost) |
| T4 | Load tests baseline / ×10 / ×50 | `make traffic` / `make peak` | Numbers in `evidence/loadtests/` | — |
| T5 | Recovered cluster after ×10/×50 (PostGIS OOM, API not ready) | kubectl + pool timeouts | Health OK again | Added `connectionTimeoutMillis` + `statement_timeout` after overload hung probes |

## Where AI was wrong or incomplete

1. **ST_SimplifyPreserveTopology for click responses** — fixed payload size but still burned hundreds of ms and contributed to PostGIS pressure under ×10. Caught by slow-query logs + OOMKilled. Replaced with `ST_Envelope`.
2. **Assuming partner 429s were the only R3 symptom** — burst tests also produced **500s** from a dead rate-limit Redis client (`MaxRetriesPerRequestError`). Needed logs on both API replicas.
3. **Terraform cache policy block name** — first draft used a non-existent nested block; `terraform test` caught it immediately.
4. **Concurrent shell `curl` in zsh background jobs** — path/env quirks wasted a measurement attempt; re-ran sequentially.

## What I'd ask the team

- Network account: confirm TGW attachment ownership (`manage_transit_gateway_attachment` true/false) and ALB reachability from CloudFront in the landing zone.
- Client communications: written exception that race-week “cache everything 1 day” **excludes** `/api/announcements/*`.
- Product: is envelope geometry acceptable on map click for districts, or do we need a precomputed simplified layer?
- Ops: who runs the 18:00 publish + CloudFront invalidation during the freeze, and is that automated off the publisher Job?
- Partners: confirm each integration’s steady rate stays under 1000/min after we enforce per-key quotas correctly.

## How AI was used

Cursor agent for repo navigation, drafting fixes, Terraform/tests, observability manifests, and this report. All capacity and ticket claims were verified with kubectl/curl/k6/psql locally; AI suggestions that disagreed with measurements were changed or rejected.
