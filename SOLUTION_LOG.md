# Solution Log

## Approach

Prioritised like a first-week reliability engineer with ~3 hours of focus:

1. **Make it run** (`make cluster/deploy/seed`) and get evidence before guessing tickets.
2. **Tickets + capacity** — measure R1/R2/R3 and peak ×10/×50; fix only what evidence supports.
3. **Production path** — land `aws-production` on CONSTRAINTS (TGW, tags, no IGW/NAT), CDN freshness for announcements, then **size for a working production** (Multi-AZ PostGIS, HA Redis, spare node capacity).
4. **Observability** — self-hosted Prometheus/Grafana with dashboard-as-code and wake-up alerts.
5. Write `READINESS.md` for Shira with numbers, not vibes.

**My explicit preference: production must work; cost is secondary.** After ×10 OOM-killed PostGIS locally, I chose the larger/more expensive AWS defaults on purpose. A cheaper design that fails on announcement day is not acceptable.

Deliberately skipped: real cloud deploy, full tracing, overnight soak, redesigning the seed coastline.

## Log

| Time | What I did | Tool / AI prompt (summary) | Result | Did I accept, change, or reject the AI output? Why? |
|------|------------|----------------------------|--------|-----------------------------------------------------|
| T0 | Read INSTRUCTIONS, CONSTRAINTS, TICKETS, ARCHITECTURE, Makefile | — | Plan: deploy → measure → fix → prod → docs | — |
| T0 | `make destroy && make cluster && make deploy && make seed` | Shell | First deploy had PostGIS 17-3 without extension; clean rebuild to 17-4 fixed Martin | Accepted procedure from README |
| T1 | Measured north vs south clicks | curl + psql `ST_NPoints` | North coastal ~200k verts, ~5.5 MB payload | — |
| T1 | Measured partner limiter | redis-cli KEYS + burst curl | Keyed by IP; limit 600; Redis errors → 500 | — |
| T1 | Timed admin summary | psql `\timing` | ~0.5–1s geodesic perimeter; TTL 120s → R2 | — |
| T2 | Fixed API (envelope click/summary, per-key 1000/min, metrics, short announcement TTL) | AI-assisted code edits, reviewed | Built image 1.4.3; postfix evidence shows envelope clicks / 1000-per-key | Accepted after measurement checks |
| T2 | Observability kustomize (Prometheus + Grafana + alerts) | AI-assisted manifests | `make observe` | Accepted lean self-hosted stack (CONSTRAINTS) |
| T3 | Rewrote `aws-production` for TGW/tags/CDN/HA | AI-assisted Terraform | `terraform test` 2/2 pass | **Rejected AI’s cost-lean sizing** — I insisted on prod that works (larger Multi-AZ DB, HA Redis, more nodes) even at higher monthly cost |
| T4 | Load tests baseline / ×10 / ×50 | `make traffic` / `make peak` | Numbers in `evidence/loadtests/` | — |
| T5 | Recovered cluster after ×10/×50 (PostGIS OOM, API not ready) | kubectl + pool timeouts | Health OK again | Accepted fail-fast pool timeouts after overload hung probes |

## Where AI was wrong or incomplete

**The only thing AI did not do as needed was preferring a working production over cost.**  
It defaulted toward cheaper/smaller AWS choices (smaller DB/nodes/Redis). I overrode that: announcement day must not fail to save money. Local ×10 PostGIS OOM was the evidence; the human decision was **reliability first, cost second**.

Other AI drafts needed normal engineering review (e.g. simplify-vs-envelope for clicks, Terraform syntax), but those were ordinary iterate-and-fix loops — not a wrong product priority.

## What I'd ask the team

- Network account: confirm TGW attachment ownership (`manage_transit_gateway_attachment` true/false) and ALB reachability from CloudFront in the landing zone.
- Client communications: written exception that race-week “cache everything 1 day” **excludes** `/api/announcements/*`.
- Product: is envelope geometry acceptable on map click for districts, or do we need a precomputed simplified layer?
- Ops: who runs the 18:00 publish + CloudFront invalidation during the freeze, and is that automated off the publisher Job?
- Partners: confirm each integration’s steady rate stays under 1000/min after we enforce per-key quotas correctly.

## How AI was used

Cursor agent for repo navigation, drafting fixes, Terraform/tests, observability manifests, and this report. All capacity and ticket claims were verified with kubectl/curl/k6/psql locally. I accepted AI output when measurements agreed; I rejected the cost-optimised production sizing because **I prefer a working prod over a cheaper one that breaks**.
