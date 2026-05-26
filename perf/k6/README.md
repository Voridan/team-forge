# k6 performance tests — analytics service

Per-endpoint load scenarios for the analytics module. Each scenario logs in
once via `setup()`, then ramps virtual users and asserts both response status
and latency thresholds.

## Prerequisites

- The full dev stack is up: `./dev.sh up`
- Demo data is seeded: `./dev.sh seed` (the analytics endpoints expect the
  `00000000-0000-0000-0000-0000000d0000` demo team to exist)
- The k6 binary is installed *or* you run it in a container (see below)
- A user with **OWNER or ADMIN** role on the target team. Defaults assume
  `alice@example.com` / `Password123!` — if alice isn't on the demo team,
  either add her via the FE or override `K6_USERNAME` / `K6_PASSWORD` /
  `K6_TEAM_ID` on the command line.

## Run a single scenario

Native k6:
```bash
cd perf/k6
k6 run scenarios/overview.js
```

Containerized (no host install required):
```bash
docker run --rm -i --network=host \
  -v $(pwd)/perf/k6:/scripts \
  grafana/k6 run /scripts/scenarios/overview.js
```

## Run the full dashboard scenario

`scenarios/all.js` models a single user opening the analytics tab — parallel
GET to overview/workload/throughput/recommendations, then a navigation into
bottlenecks. Useful for end-to-end page-load timing.

```bash
k6 run scenarios/all.js
```

## Overriding defaults

Every scenario reads from environment variables via `lib/config.js`:

| Var | Default | Meaning |
|---|---|---|
| `K6_BASE_URL` | `http://localhost` | Nginx-fronted base (use `http://localhost:8000` to hit analytics directly, bypassing Nginx) |
| `K6_USERNAME` | `alice@example.com` | Login email |
| `K6_PASSWORD` | `Password123!` | Login password |
| `K6_TEAM_ID` | `00000000-0000-0000-0000-0000000d0000` | Demo team |

Example — hit the analytics container directly with a different team:
```bash
K6_BASE_URL=http://localhost:8000 \
K6_TEAM_ID=11111111-1111-1111-1111-111111111111 \
  k6 run scenarios/overview.js
```

## Thresholds

`lib/config.js` defines two threshold profiles:

- **DEFAULT_THRESHOLDS** — `p95 < 800ms`, `p99 < 2s`, error rate `< 1%`.
  Applied to the light endpoints (overview, workload, throughput,
  bottlenecks, recommendations).
- **HEAVY_THRESHOLDS** — `p95 < 3s`, `p99 < 6s`, error rate `< 1%`.
  Applied to CFD, which reconstructs 90 days of task state per task.

CFD also uses the `RAMP_HEAVY` profile (3 VUs vs 10) and a longer sleep
between iterations to respect the server's 10 req/min cap on that endpoint.

## Output

k6 prints a final summary to stdout. To export raw samples (one record per
HTTP request) for analysis:

```bash
k6 run --out json=results.json scenarios/overview.js
```

For a Grafana dashboard, export to InfluxDB:
```bash
k6 run --out influxdb=http://localhost:8086/k6 scenarios/overview.js
```

## Adding a new scenario

1. Copy `scenarios/overview.js`.
2. Adjust the URL path.
3. Add response-shape checks specific to the new endpoint.
4. Pick the threshold/ramp profile (DEFAULT vs HEAVY) in `lib/config.js`.

Everything else (login, base URL handling, team id) is shared via `lib/`.
