# Race week / announcement day runbook

## CDN policy (agreed interpretation of client plan)

| Path | Race week | Why |
|------|-----------|-----|
| `/tiles/*` | Cache **1 day** (`race_week_mode=true`) | Versioned `?v=`; sheds Martin/PostGIS load |
| `/api/announcements/*` | **max 60s**, prefer origin `Cache-Control` (15s) | Dataset must appear right after publish |
| Other `/api/*` | Longer TTL OK for safe GETs; still forward `Authorization` / `X-Api-Key` | Partners and staff must not share caches |

Set in Terraform: `race_week_mode = true` **before the Thursday freeze**.

## 18:00 publish cutover

1. Pre-scale: API HPA min ≥ 6, Martin replicas ≥ 4 (`values-production.yaml`).
2. Run publisher Job (dataset → `announcements`, bumps `updatedAt`).
3. **Immediately** invalidate CDN:
   ```bash
   aws cloudfront create-invalidation \
     --distribution-id "$DISTRIBUTION_ID" \
     --paths "/api/announcements/*"
   ```
4. Verify: `GET /api/announcements/latest` shows new `version` through the CDN hostname within 60s.
5. Do **not** purge `/tiles/*` unless necessary — new `?v=` already bypasses old tiles.

## Freeze (Thursday → after race weekend)

- No routine deploys.
- Allowed: CDN invalidation, HPA scale-out, restart unhealthy pods, rollback to last known-good image tags.
- Partner quota remains **1000 req/min per API key**.
