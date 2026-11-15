# CityMap

National public mapping platform for the Republic of Veloria. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how it fits together and [docs/CONSTRAINTS.md](docs/CONSTRAINTS.md) for the rules production must follow.

## Layout

```
services/api         NestJS public API
services/publisher   dataset publisher (Kubernetes Job)
services/sdk         client SDK (Node.js and k6 transports)
tiles/               Martin tile server configuration
db/                  PostGIS image, schema migrations, deterministic seed
deploy/helm/citymap  Helm chart for the whole platform
deploy/terraform/
  local/             deploys the chart and ingress-nginx to the local k3d cluster
  aws-production/    production module for AWS (tested with mock providers)
traffic/             k6 traffic generator (uses the SDK)
docker-compose.yml   quick run without Kubernetes (development only)
```

## Running locally

Prerequisites: Docker, k3d, kubectl, helm, terraform ≥ 1.7, make and bash (macOS, Linux or WSL2). k6 runs in a container (`grafana/k6`); a local k6 ≥ 1.0 works too with `K6=k6`.

```bash
make cluster      # k3d cluster "citymap"; ingress on http://localhost:8080, API server on 127.0.0.1:6550
make deploy       # builds images, imports them into k3d, terraform apply in deploy/terraform/local
make seed         # loads the seed data (about 10 s; safe to re-run)
make status       # pods, autoscaler, jobs
```

| URL | |
|---|---|
| `http://localhost:8080/api/health` | API |
| `http://localhost:8080/tiles/catalog` | Tile catalog |

### Local credentials

These exist only in the seed data.

| What | Value |
|---|---|
| Users | `alice`, `bob` (`POST /api/auth/dev-login` with `{"username": "alice"}`) |
| Partner API key — Velorian Transit Co. | `velt-transit-2b81c4e9d7a6f350` |
| Partner API key — PitLane Live | `pitlane-live-91d0a3f5e2c8b764` |

```bash
curl "http://localhost:8080/api/features/at?lon=4.2&lat=-42.4"
curl -H "X-Api-Key: pitlane-live-91d0a3f5e2c8b764" \
  "http://localhost:8080/api/partner/v1/features?layer=parcels&bbox=4.0,-42.2,4.05,-42.15"
```

## Traffic

```bash
make traffic                    # baseline, 10 minutes
make traffic DURATION=3m
make peak MULTIPLIER=10         # web traffic x10 for 5 minutes (partners stay steady)
make peak MULTIPLIER=50
make soak DURATION=20m
make publish                    # publish the race-weekend dataset
```

The generator uses fixed seeds, so runs are repeatable. Each run prints a per-endpoint table and writes the full k6 summary to `traffic/results/`. k6 runs in a container on the cluster's Docker network, so the load does not go through your machine's port forwarding (which saturates first on Docker Desktop). Pass extra k6 options with `K6_FLAGS`, e.g. `make traffic K6_FLAGS="--out csv=traffic/results/run.csv"`.

## Development

```bash
npm install     # npm workspaces: api, publisher, sdk
npm test
npm run build
```

`docker compose up` runs the stack without Kubernetes; load the schema and seed with `docker compose exec -T postgis psql -U citymap -d citymap < db/seed/seed.sql`.

## Troubleshooting

- **Port 8080 or 6550 already in use:** stop whatever uses it, or change the ports in the `cluster` target.
- **`make deploy` times out waiting for pods:** check `make status` and `kubectl -n citymap describe pod ...`; Docker needs about 8 GB of memory.
- **Starting over:** `make destroy && make cluster && make deploy && make seed`.
