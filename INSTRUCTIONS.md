# CityMap — Reliability Readiness Review

## Welcome! 👋

Thank you for your interest in joining Webiks! We're excited to learn more about how you work.

This is a hands-on task built around a real kind of situation: a public platform that people rely on, a big day coming up, and a short runway to get it ready. You'll be doing what a reliability engineer does in their first week — run the system, measure it, find out what will hurt, and decide what to do about it first.

**Use AI tools as you normally would — we expect you to.** Tell us how you used them in `SOLUTION_LOG.md`.

---

## The Client

**Velorian Digital Services** runs the public digital infrastructure of the Republic of Veloria. One of its services is **CityMap**, the national public mapping platform: residents look up addresses and parcels, businesses and partners pull data through an API, and official datasets are published on it for everyone to see.

Webiks builds and operates CityMap for them.

---

## The Brief

### Message from Shira Carto, CityMap Project Manager

> Hi, and welcome aboard.
>
> I'll get straight to it, because the timing is not ideal. In about a week, Velorian Digital Services will publish the official race-weekend dataset for the **Velorian Grand Prix**: road closures, detours, spectator zones and shuttle stops. It goes out through our publisher job and appears on the map and in the API. Last year the announcement day brought roughly ten times our normal traffic, and the race weekend itself was higher than that. The client was very clear on one thing: once the dataset is published, people need to see it right away. Nobody should be driving towards a road that closed an hour ago.
>
> Support has forwarded three tickets that came in recently. They're in `code/docs/TICKETS.md`. They're vague, because that's how tickets are. I'd rather you understood what's behind them than guessed.
>
> We also have a production module for AWS that we inherited from the previous team. It has never been applied from this repository and it has not been checked against the government landing-zone rules we now have to follow (`code/docs/CONSTRAINTS.md`). The client's network team will ask about it soon.
>
>
> The client's communications team has also sent their plan for race week:
>
> - the dataset goes live at **18:00 on announcement day**, during the evening news, and straight after publishing we purge the whole CDN so that nobody can see anything old;
> - during race week the CDN caches **everything for a full day**, to take the pressure off our servers;
> - no deployments from **Thursday** until after the race weekend.
>
> Could you get the CDN side of this ready as part of your work, and plan around the freeze?
>
> A couple of things I've promised the client over time, in case they matter: every integration partner gets its own quota of 1,000 requests a minute, and we don't use any external SaaS tools.
>
> Some parts of the repository are simplified versions of what runs in production, so the whole thing fits on a laptop. If something looks like a stand-in, it probably is. Treat it as the real thing anyway.
>
> I need to know: are we ready for the announcement, and if not, what do we do first?
>
> — Shira

---

## Setup

### Prerequisites

| Tool | Version |
|---|---|
| Docker (Desktop, Engine or OrbStack) | recent, with ~8 GB RAM available to containers |
| k3d | 5.6 or later |
| kubectl | 1.30 or later |
| helm | 3.14 or later |
| terraform | 1.7 or later |
| k6 | optional — `make traffic`/`peak`/`soak` run it in a container |
| make, bash | macOS, Linux, or Windows with WSL2 |

A laptop with 4 cores and 16 GB of RAM is enough. All images support both amd64 and arm64 (Apple Silicon). No cloud account and no paid tool is needed at any point.

### Run it

```bash
cd code
make cluster    # local k3d cluster, ingress on http://localhost:8080
make deploy     # builds the images and deploys everything with Terraform
make seed       # loads the deterministic seed data
make traffic    # baseline traffic for 10 minutes (DURATION=... to change)
```

The API is at `http://localhost:8080/api` and the tiles at `http://localhost:8080/tiles`. `make help` lists everything else, including `peak`, `soak` and `publish`. `code/README.md` has more detail on the system.

---

## Your Tasks

You have **about 3 hours** of focused work. You won't be able to do everything, and that's by design. **How you prioritise is part of what we evaluate.** The tickets may not be the only problems.

### Part 1 — Run it

1. Deploy the system locally with the provided Terraform (`code/deploy/terraform/local`).
2. Add observability of your choice — open-source and self-hosted only, per `CONSTRAINTS.md`. We want metrics, a dashboard as code, and at least two alert rules you would actually want to be woken up by. Tracing is welcome.
3. Investigate the three tickets. Use the traffic generator (`code/traffic`).
4. Load test the system and write a short capacity statement: **what breaks first at ×10 and at ×50**, with your measured numbers. Commit the raw k6 output.

### Part 2 — Take it to production (no cloud account needed)

1. Review and improve `code/deploy/terraform/aws-production` against `CONSTRAINTS.md` and what you learned in Part 1.
2. Make `terraform test` pass with assertions that matter. Mock providers are already set up.
3. Give a short cost estimate for your design and one cost-versus-reliability trade-off you made.

A real cloud deployment is optional and earns no extra points.

---

## Deliverables

- Your changes, with **incremental commits** that show how you worked.
- `SOLUTION_LOG.md` — how you worked and how you used AI.
- `READINESS.md` — your readiness report for Shira and the client.
- Raw load-test results, dashboards and alert rules, committed as files.

**Evidence rule:** every claim about a problem or a fix should be backed by something you measured or ran, and that evidence should be in the repository.

---

## Submission

**Estimated effort:** about 3 hours
**Deadline:** Please submit within **5 days** of receiving this task.

1. Push your solution to a **private** GitHub repository, keeping this layout (`INSTRUCTIONS.md`, `SOLUTION_LOG.md`, `READINESS.md` and `code/` at the root)
2. Add **webiks-reviewer** as a collaborator
3. Fill in `SOLUTION_LOG.md` and `READINESS.md` — these are an important part of our evaluation
4. Email **hr@webiks.com** with the link to your repo and any setup notes

> ⚠️ **Your repository MUST be private.** Public repos risk leaking the test to other candidates, which would disqualify your submission.

---

## Questions?

If something blocks you completely, email **hr@webiks.com**. Otherwise, make a reasonable assumption, write it down in `SOLUTION_LOG.md`, and keep going — that's what we'd do too.

Good luck, and enjoy it! 🏁
