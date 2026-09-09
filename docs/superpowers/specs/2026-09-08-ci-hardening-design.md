# CI Hardening — Design

**Date:** 2026-09-08
**Status:** Approved for planning

## Goal

Rebuild this project's CI from a single deploy-on-main workflow into a full
pre-submit / post-submit pipeline: every property we care about is proven on a
pull request, images are built once and the tested artifact is what ships.

This is deliberately an exercise in "what does the ideal look like" rather than
the minimum that works. Where a genuinely ideal practice is out of reach given
the production host's size, we implement the closest affordable substitute and
record the omission as an inline comment in the YAML, so the pipeline documents
its own compromises.

## Current State

One workflow, `.github/workflows/deploy.yaml`, triggered on `push: [main]` and
`workflow_dispatch`. Two jobs:

- `quality` — `ruff check src tests` (rules `E,F` only) and `pytest -v`
- `deploy` — writes `.env` from secrets, `docker compose down`, `build`, `up -d`,
  `sleep 10`, two `curl` health checks

### Defects found during the audit

| # | Defect | Consequence |
|---|---|---|
| D1 | No `pull_request` trigger | Nothing is verified before it reaches `main`; branch protection has no check to require |
| D2 | `docker compose down` runs **before** `build` | A failed build leaves production down with nothing to bring back up |
| D3 | Frontend is entirely absent from CI | 4 Playwright specs exist in `frontend/tests/` and never run; no lint, no build verification |
| D4 | Playwright is not a declared dependency | Specs run via ad-hoc `npx playwright test`; version is whatever npx resolves that day |
| D5 | `Dockerfile.bot` uses `python:3.11-slim`, CI tests on 3.12 | The tested interpreter is not the shipped interpreter |
| D6 | `requirements.txt` is entirely `>=` with no lock file | Two builds on different days produce different production images |
| D7 | Root `Dockerfile` is dead | Nothing in `docker-compose.yml` references it; a stale near-duplicate of `Dockerfile.bot` without ffmpeg |
| D8 | `pg_isready -U ${POSTGRES_USER:-bot}` | `POSTGRES_USER` is not in the job environment, so this always falls through to the literal `bot`; the check is vacuous |
| D9 | No `concurrency:` group | Two pushes to `main` deploy simultaneously against the same Docker host |
| D10 | No `permissions:` block | `GITHUB_TOKEN` runs with the repository default rather than least privilege |
| D11 | Actions referenced by mutable tag (`@v5`, `@v6`) | Tags are repointable; a compromised action tag executes on the self-hosted runner |
| D12 | `sleep 10` as a readiness gate | Guesswork; a 1-core host can take considerably longer to become ready |
| D13 | No rollback path | Images are built in place and untagged, so there is no previous artifact to return to |
| D14 | `.env` written with default permissions | Secrets sit world-readable on the production host |
| D15 | Public repository with a persistent self-hosted runner | Currently safe only because the sole workflow is `push: main`-triggered; nothing enforces that invariant |

## Key Constraint and the Insight That Resolves It

The production host is a single self-hosted runner with **1 CPU core and 2 GB of
RAM**. That budget cannot support a Playwright matrix, a parallel test suite, or
a second staging stack.

The repository is **public** (`fantom2513/vibe_ds_bot`). For public repositories
GitHub provides, at no cost:

- GitHub-hosted runners with **unmetered minutes** (4 cores / 16 GB per runner)
- **GHCR** with free storage and bandwidth for public packages
- CodeQL, Dependabot, OSSF Scorecard, and artifact attestations
- Merge queues

So the 1-core/2-GB limit constrains the *deployment target*, not CI. All
computation moves to GitHub-hosted runners. This is not merely a workaround: it
also removes the compile step from the production host, which currently spends
its only core running `vite build` while serving the bot.

## Architecture

### Two workflows, split by purpose

**`ci.yaml`** — proves a commit is good.
Triggers: `pull_request`, `merge_group`, `push: main`.
Runs on `ubuntu-latest` throughout.

**`deploy.yaml`** — ships an artifact that has already been proven.
Triggers: `workflow_run` on successful CI against `main`, plus
`workflow_dispatch` accepting an image digest (which doubles as the manual
rollback control).
Runs on the self-hosted runner.

The split delivers *build once, deploy the artifact you tested*: the image that
reaches production is byte-identical to the one the end-to-end tests ran
against.

### `ci.yaml` job graph

```
changes ─┬─► lint-backend ──────────┐
         ├─► typecheck-backend ─────┤
         ├─► test-backend (matrix) ─┤
         ├─► lint-frontend ─────────┤
         ├─► build-frontend ────────┤
         ├─► e2e (shard 1..3) ──────┼─► ci-ok ─► build-images
         ├─► integration-stack ─────┤            (main only)
         ├─► security ──────────────┤
         └─► hermeticity ───────────┘
```

Peak fan-out is roughly 16 concurrent jobs, within the 20-job concurrency
allowance for public repositories.

### Job responsibilities

**`changes`** — path filtering producing `backend`, `frontend`, `docker`, and
`ci` outputs. Downstream jobs gate on these. This is a coarse approximation of
affected-target analysis: a change confined to `src/db/` should not pay for the
frontend end-to-end suite.

**`lint-backend`** — `ruff check` with the full rule set plus
`ruff format --check`, against a ratchet baseline (see below).

**`typecheck-backend`** — `mypy` against the same ratchet baseline. Nothing
type-checks the backend today.

**`test-backend`** — matrix over Python 3.11 and 3.12. `pytest-xdist` for
parallelism, `pytest-timeout` so a hung test fails in seconds rather than
consuming the six-hour job limit, coverage reporting, and JUnit XML surfaced as
inline pull-request annotations.

**`lint-frontend`** — ESLint and Prettier. Neither is configured today.

**`build-frontend`** — `vite build` plus a bundle-size budget check that fails
on regression beyond a threshold.

**`e2e`** — Playwright across 3 shards with `retries: 2`. Traces and videos are
uploaded on failure; blob reports from all shards merge into a single HTML
report in a follow-up job.

**`integration-stack`** — the ephemeral staging environment. Brings up the full
`docker compose` stack on the runner, runs `alembic upgrade head`, executes
smoke tests against the live API, then runs `alembic downgrade -1` followed by
`upgrade` again to prove the migration is reversible. Migration reversibility is
routinely untested and is what makes a rollback impossible when it is needed.

**`security`** — CodeQL for Python and JavaScript, Trivy against the built
images and the compose/Dockerfile configuration, gitleaks for secret scanning,
`pip-audit`, and `npm audit`.

**`hermeticity`** — verifies lock files are in sync with their source manifests,
and runs `actionlint` and `zizmor` against the workflow files themselves.
`zizmor` also enforces the self-hosted-runner isolation invariant described
under Security below.

**`ci-ok`** — an aggregating job with `needs` on every other job, and the single
required status check in branch protection. This job is mandatory rather than
cosmetic: when jobs are conditional on path filters, a skipped job reports as
successful to branch protection, so requiring the individual jobs would let a
path-filtered failure through. `ci-ok` must explicitly assert that no dependency
concluded in `failure` or `cancelled`.

**`build-images`** — `docker buildx` with the layer cache backed by the GitHub
Actions cache. On `main` only, pushes to GHCR tagged `sha-<sha>` and `main`,
attaches an SBOM, and generates SLSA build provenance attestation. Emits a
`digests.json` artifact consumed by the deploy workflow.

### `deploy.yaml`

```yaml
on:
  workflow_run: { workflows: [CI], types: [completed], branches: [main] }
  workflow_dispatch:
    inputs:
      digest: "image digest to deploy — also the rollback control"

concurrency: { group: production, cancel-in-progress: false }
permissions: { contents: read, packages: read }
environment: production
```

`cancel-in-progress: false` queues deployments rather than cancelling one
mid-flight, which would leave the stack in an indeterminate state.

Steps, and how each differs from today:

| Today | Becomes | Rationale |
|---|---|---|
| `docker compose down` as the first step | removed entirely | Source of D2. `up -d` replaces changed services on its own |
| `docker compose build` on the host | `docker compose pull` by **digest** | The host stops compiling. Digest rather than tag because tags are repointable |
| — | capture running containers' digests into `previous.json` | Without this there is nothing to roll back to |
| `sleep 10 && curl` | poll for `healthy` with a timeout | Fixes D12 |
| — | on health-check failure, restore `previous.json` digests, verify, then `exit 1` | Production recovers automatically; the run still reports red |
| `.env` at default permissions | `umask 077` and explicit `chmod 600` | Fixes D14 |
| `pg_isready -U ${POSTGRES_USER:-bot}` | user supplied from the secret | Fixes D8 |
| — | `docker image prune` at the end | Accumulated tags will exhaust a small disk within months |

`docker-compose.yml` gains `healthcheck` definitions for `bot-api` and
`frontend`. Only `postgres` has one today, so `depends_on: service_healthy` is
unavailable for the other services and the readiness poll would have nothing to
poll.

### Security: public repository plus self-hosted runner

GitHub explicitly warns against this combination — a pull request from a fork
can execute arbitrary code on the runner host. Today the only thing preventing
that is the incidental fact that the sole workflow triggers on `push: main`.

Under this design the isolation becomes structural. The self-hosted runner is
named in exactly one place, `deploy.yaml`, which triggers only from
`workflow_run` on `main` and from `workflow_dispatch`. No job reachable by a
fork can be scheduled onto the production host. `zizmor` in the `hermeticity`
job guards against regression of this invariant.

## Ratchet Baseline Strategy

Enabling the full `ruff` rule set, `mypy`, and ESLint on an existing codebase
surfaces a large backlog. Rather than blocking work on a cleanup, or weakening
the checks to non-blocking:

1. Record the current set of violations in a committed baseline file.
2. CI fails only on violations absent from the baseline.
3. Fixing a violation removes it from the baseline; it can never return.

New code is held to the full standard from day one, and the legacy backlog
shrinks monotonically without gating development.

## Repository Configuration

Applied via the `gh` CLI so the configuration is reproducible rather than
click-through:

- **Branch protection on `main`**: `ci-ok` as the sole required check; linear
  history required; force-push denied; branches required to be up to date
- **Merge queue** — free for public repositories, supplies the `merge_group`
  trigger. A pull request is tested combined with already-accepted changes
  before merging, which is the pre-submit/post-submit distinction in miniature
- **Environment `production`** with a deployment branch policy limiting it to
  `main`
- `dependabot.yml` covering pip, npm, docker, and github-actions
- `CODEOWNERS` and a pull-request template
- **OSSF Scorecard** as a separate workflow, producing a supply-chain rating
  badge for the README
- **`nightly.yaml`** running the end-to-end suite five times consecutively and
  reporting a per-test flake rate. Three `fix: flaky ...` commits in recent
  history indicate this is a real problem that is currently discovered by
  accident rather than measured

## Project Changes Beyond YAML

- `requirements.txt` (all `>=`) becomes `requirements.in` plus a hashed
  `requirements.lock`, generated with `uv pip compile`. `uv` is a CI and
  development tool only and does not enter the application runtime.
- `frontend/package.json` gains `@playwright/test` as a dev dependency, plus
  `playwright.config.js`, ESLint, and Prettier configuration. Resolves D4.
- Every `uses:` reference is pinned to a commit SHA. Resolves D11.
- `Dockerfile.bot` moves to `python:3.12-slim`, becomes multi-stage, and runs as
  a non-root user. Resolves D5; the upgrade is validated by
  `integration-stack` before it can ship.
- The root `Dockerfile` is deleted. Resolves D7.

## Omitted, With Reasons

Each of these is recorded as an inline comment at the relevant point in the
workflow files.

| Omitted | Reason | Substitute |
|---|---|---|
| Persistent staging environment | 2 GB of RAM cannot hold a second postgres + api + frontend alongside production | `integration-stack`: a full ephemeral stack on the runner, per pull request |
| Blue/green and canary deployment | Requires double the RAM for parallel stacks on a single host | Digest-pinned rollback: roughly 15 seconds of downtime rather than zero, acceptable for a Discord bot |
| Multi-architecture images (arm64) | The host is x64; cross-building doubles build time for no benefit | — |
| Bazel or a remote build cache | The repository is 605 KB; the infrastructure would cost an order of magnitude more than the project | Lock files, SHA pinning, and digest-based deployment provide most of the same guarantee |
| Load testing as a gate | A 1-core production host has no headroom; a separate machine would be required | — |
| Ephemeral or autoscaling runners | A single fixed machine | The self-hosted runner is isolated to one deploy workflow (see Security above) |
| Test impact analysis | Requires a build graph | The `changes` job approximates it with path filters |

## Implementation Phases

Ordered so each phase is independently useful and the sequence can be halted at
any boundary.

1. **Foundation** — `ci.yaml` with path filters, `ci-ok`, SHA pinning,
   `permissions`, `concurrency`. Backend tests on the 3.11 + 3.12 matrix.
   (D1, D9, D10, D11)
2. **Hermeticity** — lock files via `uv` and `npm ci`, the Python version
   alignment, deletion of the dead `Dockerfile`. (D5, D6, D7)
3. **Frontend in CI** — Playwright as a declared dependency, configuration,
   sharding, ESLint, bundle-size budget. (D3, D4)
4. **Strictness with ratchet** — full `ruff` rule set, `mypy`, baseline files.
5. **Integration** — ephemeral stack plus migration reversibility check.
6. **Security** — CodeQL, Trivy, gitleaks, pip-audit, actionlint, zizmor,
   Scorecard. (D15)
7. **Artifacts** — GHCR, SBOM, provenance, buildx cache.
8. **Deploy** — rewritten `deploy.yaml` with rollback, compose health checks.
   (D2, D8, D12, D13, D14)
9. **Repository configuration** — branch protection, merge queue, Dependabot,
   nightly flake hunt.

## Decisions Taken

| Decision | Choice | Reasoning |
|---|---|---|
| Where CI executes | GitHub-hosted runners; self-hosted for deploy only | The public repository makes hosted runners free and unmetered; it removes compilation from a 1-core production host |
| Image registry | GHCR | Free for public packages, requires no new secret (`GITHUB_TOKEN` suffices), and provides tagged history for rollback |
| Legacy lint backlog | Ratchet baseline | Full strictness on new code without blocking development on a cleanup |
| Python version | Production raised to 3.12; tests run 3.11 and 3.12 | Aligns the shipped and tested interpreter while retaining coverage of both |
| Python locking | `uv pip compile` | Single binary, an order of magnitude faster than pip on both runner and image build, confined to CI and development |
