# Artifact-based production deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build production images once on GitHub-hosted runners, publish them to GHCR, and deploy only immutable digests with readiness checks and automatic container rollback.

**Architecture:** `ci.yaml` validates every change and, after a successful push to `main`, builds two GHCR images and uploads their digests. `deploy.yaml` runs only after that successful CI run (or from explicit digest inputs), asks the production host to pull rather than build, and restores the saved previous images if the three-service stack is not healthy within two minutes.

**Tech Stack:** GitHub Actions, Buildx, GHCR, Docker Compose, Bash, pytest.

**Spec:** `docs/superpowers/specs/2026-09-09-artifact-deploy-design.md`

## Global Constraints

- Production has one CPU core and 2 GB RAM; it never builds or runs tests.
- Only `push` to `main` and explicit manual dispatch can reach the self-hosted runner.
- Production images are GHCR references pinned with `@sha256:`; tags are never deploy inputs.
- A release gets 120 seconds, checked every five seconds, to make PostgreSQL, API, and frontend healthy.
- Failed rollout restores containers only. Alembic migrations remain forward-only.
- `.env` is written with mode `600`.
- Deployments use one `production` queue and are never cancelled mid-flight.

---

### Task 1: Validate image digests and render a production Compose override

**Files:**
- Create: `scripts/ci/deploy_images.py`
- Create: `tests/test_scripts/test_deploy_images.py`

**Interfaces:**
- Produces `validate_image_ref(value: str) -> str`, accepting only a `ghcr.io/...@sha256:` reference with a 64-character lowercase hexadecimal digest.
- Produces `render_override(bot_image: str, frontend_image: str) -> str`, returning a Compose YAML document that replaces only `bot-api.image` and `frontend.image`.
- Produces `write_override_from_json(source: Path, destination: Path) -> None`, which validates `bot_image` and `frontend_image` from `digests.json` and writes `docker-compose.deploy.yaml`.

- [ ] **Step 1: Write failing tests**

```python
from pathlib import Path

import pytest

from scripts.ci.deploy_images import render_override, validate_image_ref, write_override_from_json


BOT = "ghcr.io/fantom2513/vibe_ds_bot-bot-api@sha256:" + "a" * 64
FRONTEND = "ghcr.io/fantom2513/vibe_ds_bot-frontend@sha256:" + "b" * 64


def test_accepts_a_complete_ghcr_digest_reference():
    assert validate_image_ref(BOT) == BOT


@pytest.mark.parametrize("value", [
    "ghcr.io/fantom2513/vibe_ds_bot-bot-api:main",
    "docker.io/library/python@sha256:" + "a" * 64,
    "ghcr.io/fantom2513/vibe_ds_bot-bot-api@sha256:" + "a" * 63,
])
def test_rejects_a_non_immutable_or_non_ghcr_image(value: str):
    with pytest.raises(ValueError):
        validate_image_ref(value)


def test_rendered_override_changes_only_production_images():
    override = render_override(BOT, FRONTEND)

    assert "bot-api:" in override
    assert f"image: {BOT}" in override
    assert f"image: {FRONTEND}" in override
    assert "build:" not in override


def test_json_artifact_writes_a_validated_override(tmp_path: Path):
    source = tmp_path / "digests.json"
    destination = tmp_path / "docker-compose.deploy.yaml"
    source.write_text('{"bot_image": "' + BOT + '", "frontend_image": "' + FRONTEND + '"}')

    write_override_from_json(source, destination)

    assert f"image: {BOT}" in destination.read_text()
```

- [ ] **Step 2: Run the tests to verify RED**

Run: `.venv/Scripts/python.exe -m pytest tests/test_scripts/test_deploy_images.py -v` on Windows, or `python -m pytest tests/test_scripts/test_deploy_images.py -v` on Linux.

Expected: collection fails because `scripts.ci.deploy_images` does not exist.

- [ ] **Step 3: Implement the minimal module**

```python
"""Helpers for converting CI image digests into a production Compose override."""

from __future__ import annotations

import re
import json
from pathlib import Path

_IMAGE_REF = re.compile(r"^ghcr\.io/[a-z0-9._/-]+@sha256:[0-9a-f]{64}$")


def validate_image_ref(value: str) -> str:
    if not _IMAGE_REF.fullmatch(value):
        raise ValueError(f"expected a GHCR sha256 image reference, got {value!r}")
    return value


def render_override(bot_image: str, frontend_image: str) -> str:
    bot_image = validate_image_ref(bot_image)
    frontend_image = validate_image_ref(frontend_image)
    return (
        "services:\n"
        "  bot-api:\n"
        f"    image: {bot_image}\n"
        "  frontend:\n"
        f"    image: {frontend_image}\n"
    )


def write_override_from_json(source: Path, destination: Path) -> None:
    payload = json.loads(source.read_text())
    destination.write_text(render_override(payload["bot_image"], payload["frontend_image"]))
```

- [ ] **Step 4: Run the unit tests and the existing script tests**

Run:

```bash
python -m pytest tests/test_scripts/test_deploy_images.py tests/test_scripts/test_junit_summary.py -v
node --test scripts/ci/check_bundle_size.test.mjs
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/ci/deploy_images.py tests/test_scripts/test_deploy_images.py
git commit -m "feat: validate immutable production image references"
```

### Task 2: Make Compose declare service readiness without changing local builds

**Files:**
- Modify: `docker-compose.yml`
- Modify: `.github/workflows/ci.yaml`

**Interfaces:**
- `bot-api` reports healthy when `http://localhost:8000/health` returns 2xx.
- `frontend` reports healthy when nginx returns 2xx from `http://localhost/`.
- `docker compose -f docker-compose.yml -f docker-compose.deploy.yaml config` is valid with digest-pinned images.

- [ ] **Step 1: Add a failing Compose validation step to the existing Docker CI job**

Insert after the current image checks in `docker-build`:

```yaml
      - name: Verify production compose override shape
        run: |
          cat > docker-compose.deploy.yaml <<'EOF'
          services:
            bot-api:
              image: ghcr.io/fantom2513/vibe_ds_bot-bot-api@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
            frontend:
              image: ghcr.io/fantom2513/vibe_ds_bot-frontend@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
          EOF
          docker compose -f docker-compose.yml -f docker-compose.deploy.yaml config | grep -F 'healthcheck:'
```

- [ ] **Step 2: Run the Docker CI job on a draft PR to verify RED**

Push only this test commit and inspect `Build bot image`.

Expected: it fails because neither `bot-api` nor `frontend` declares a healthcheck.

- [ ] **Step 3: Add healthchecks and healthy dependencies**

Add the following under the existing `bot-api` service; Python is guaranteed to
exist in the image, unlike `curl`:

```yaml
    healthcheck:
      test:
        ["CMD", "python", "-c", "from urllib.request import urlopen; urlopen('http://localhost:8000/health', timeout=3)"]
      interval: 5s
      timeout: 3s
      retries: 12
      start_period: 15s
```

Add the following under `frontend`; BusyBox `wget` ships in the nginx Alpine
base image:

```yaml
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O /dev/null http://localhost/ || exit 1"]
      interval: 5s
      timeout: 3s
      retries: 12
      start_period: 10s
```

Replace frontend's list-form dependency with:

```yaml
    depends_on:
      bot-api:
        condition: service_healthy
```

- [ ] **Step 4: Re-run the draft-PR Docker CI job**

Expected: `Build bot image` passes, including `docker compose config`; existing
local `docker compose up --build` remains supported by the unchanged `build`
blocks.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml .github/workflows/ci.yaml
git commit -m "feat: add compose readiness checks"
```

### Task 3: Publish production images from successful main CI

**Files:**
- Modify: `.github/workflows/ci.yaml`

**Interfaces:**
- Produces an artifact named `production-image-digests` containing:

```json
{
  "bot_image": "ghcr.io/fantom2513/vibe_ds_bot-bot-api@sha256:<64 hex>",
  "frontend_image": "ghcr.io/fantom2513/vibe_ds_bot-frontend@sha256:<64 hex>"
}
```

- [ ] **Step 1: Re-run the artifact contract test from Task 1**

Run: `python -m pytest tests/test_scripts/test_deploy_images.py::test_json_artifact_writes_a_validated_override -v`.

Expected: it passes, proving the exact JSON file emitted by this job is
consumable by deploy before the workflow YAML is added.

- [ ] **Step 2: Add the `push: main` trigger and Buildx job**

Use the existing SHA-pinning convention. Add `push: { branches: [main] }` to
the workflow and add this job after `ci-ok`:

```yaml
  build-images:
    name: Publish production images
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    needs: ci-ok
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    outputs:
      bot_image: ${{ steps.digests.outputs.bot_image }}
      frontend_image: ${{ steps.digests.outputs.frontend_image }}
    steps:
      - uses: actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09
      - uses: docker/setup-buildx-action@8d2750c68a42422c14e847fe6c8ac0403b4cbd6f
      - uses: docker/login-action@c94ce9fb468520275223c153574b00df6fe4bcc9
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
```

Build each image with `docker/build-push-action@10e90e3645eae34f1e60eeb005ba3a3d33f178e8`,
`push: true`, `cache-from: type=gha`, `cache-to: type=gha,mode=max`, SBOM and
provenance enabled. Tag both as `sha-${{ github.sha }}` and `main`; capture the
action's `digest` output and write the two fully-qualified references to
`digests.json`. Upload that file with the already-pinned upload-artifact action
using the name `production-image-digests` and retention of 30 days.

- [ ] **Step 3: Confirm the new workflow linting fails then passes**

Run the repository's `Hermeticity` job before and after completing the full
job. Expected before completion: actionlint rejects an incomplete expression;
expected after completion: actionlint passes with all actions SHA-pinned.

- [ ] **Step 4: Verify on a real main merge**

Inspect the `CI` run for the merge. Expected: `CI OK` passes first, then
`Publish production images` pushes two packages and uploads
`production-image-digests`; record both digests from the artifact.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yaml
git commit -m "feat: publish immutable production images to ghcr"
```

### Task 4: Replace in-place deploy with digest-driven deploy and rollback

**Files:**
- Modify: `.github/workflows/deploy.yaml`
- Modify: `docker-compose.yml`

**Interfaces:**
- Automatic deployment receives `digests.json` from
  `github.event.workflow_run.id`.
- Manual deployment requires `bot_image` and `frontend_image`, both validated
  by `python scripts/ci/deploy_images.py` before Docker is invoked.
- `previous-images.env` contains the actual image IDs of the running API and
  frontend and is used only for rollback.

- [ ] **Step 1: Add a failing workflow test for the old dangerous commands**

Add this command to the `Hermeticity` job:

```bash
if rg -n "docker compose down|docker compose build|sleep 10" .github/workflows/deploy.yaml; then
  echo "::error::deploy must pull immutable artifacts and poll health instead of stopping/building/sleeping"
  exit 1
fi
```

Run it before replacing the deploy workflow. Expected: failure listing all
three legacy commands.

- [ ] **Step 2: Implement the deployment-only trigger and permissions**

Replace the old `push` trigger and delete the `quality` job. Use:

```yaml
on:
  workflow_run:
    workflows: [CI]
    types: [completed]
    branches: [main]
  workflow_dispatch:
    inputs:
      bot_image:
        description: Full GHCR bot image reference pinned by @sha256
        required: true
        type: string
      frontend_image:
        description: Full GHCR frontend image reference pinned by @sha256
        required: true
        type: string

permissions:
  contents: read
  packages: read

concurrency:
  group: production
  cancel-in-progress: false
```

Gate the only job with:

```yaml
if: >-
  github.event_name == 'workflow_dispatch' ||
  (github.event.workflow_run.conclusion == 'success' &&
   github.event.workflow_run.head_branch == 'main')
```

- [ ] **Step 3: Download and validate the release inputs**

For `workflow_run`, download `production-image-digests` using the pinned
`actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093` with
`run-id: ${{ github.event.workflow_run.id }}` and `github-token:
${{ secrets.GITHUB_TOKEN }}`. For manual runs, write the two inputs to the
same JSON shape. Call `write_override_from_json()` through a small CLI wrapper
in `deploy_images.py` to validate both fields and write
`docker-compose.deploy.yaml`.

- [ ] **Step 4: Implement safe deployment and rollback**

Use one Bash step with `set -euo pipefail`. Write the existing deployment
secrets into `.env` exactly as follows; `umask` applies before file creation:

```bash
umask 077
cat > .env <<'EOF'
DISCORD_TOKEN=${{ secrets.DISCORD_TOKEN }}
DISCORD_GUILD_ID=${{ secrets.DISCORD_GUILD_ID }}
DATABASE_URL=${{ secrets.DATABASE_URL }}
API_HOST=0.0.0.0
API_PORT=8000
API_SECRET_KEY=${{ secrets.API_SECRET_KEY }}
SCHEDULER_CHECK_INTERVAL=30
DEFAULT_TIMEZONE=Europe/Moscow
POSTGRES_USER=${{ secrets.POSTGRES_USER }}
POSTGRES_PASSWORD=${{ secrets.POSTGRES_PASSWORD }}
POSTGRES_DB=${{ secrets.POSTGRES_DB }}
DISCORD_CLIENT_ID=${{ secrets.DISCORD_CLIENT_ID }}
DISCORD_CLIENT_SECRET=${{ secrets.DISCORD_CLIENT_SECRET }}
DISCORD_REDIRECT_URI=${{ secrets.DISCORD_REDIRECT_URI }}
JWT_SECRET=${{ secrets.JWT_SECRET }}
JWT_EXPIRE_HOURS=720
ALLOWED_DISCORD_IDS=${{ secrets.ALLOWED_DISCORD_IDS }}
ALERT_WEBHOOK_URL=${{ secrets.ALERT_WEBHOOK_URL }}
EOF
chmod 600 .env
set -a
. ./.env
set +a
docker login ghcr.io --username "$GITHUB_ACTOR" --password-stdin <<< "$GITHUB_TOKEN"
bot_previous=$(docker inspect --format '{{.Config.Image}}' discord-bot-api)
frontend_previous=$(docker inspect --format '{{.Config.Image}}' discord-bot-frontend)
printf 'BOT_IMAGE=%q\nFRONTEND_IMAGE=%q\n' "$bot_previous" "$frontend_previous" > previous-images.env
compose=(docker compose --env-file .env -f docker-compose.yml -f docker-compose.deploy.yaml)
"${compose[@]}" pull bot-api frontend
"${compose[@]}" up -d --no-build
docker image prune -f
```

Define this exact readiness function above the call to `up` and call
`wait_for_healthy` immediately after it:

```bash
wait_for_healthy() {
  local deadline=$((SECONDS + 120))
  local postgres bot frontend
  while (( SECONDS < deadline )); do
    postgres=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' discord-bot-postgres)
    bot=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' discord-bot-api)
    frontend=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' discord-bot-frontend)
    printf 'health: postgres=%s bot-api=%s frontend=%s\n' "$postgres" "$bot" "$frontend"
    if [[ "$postgres" == healthy && "$bot" == healthy && "$frontend" == healthy ]]; then
      docker compose --env-file .env -f docker-compose.yml -f docker-compose.deploy.yaml exec -T postgres pg_isready -U "$POSTGRES_USER"
      return 0
    fi
    sleep 5
  done
  return 1
}
```

Replace the final `docker image prune -f` in the first block with this exact
rollback guard, then prune only after a healthy new release:

```bash
if ! wait_for_healthy; then
  set -a
  . ./previous-images.env
  set +a
  cat > docker-compose.rollback.yaml <<EOF
services:
  bot-api:
    image: $BOT_IMAGE
  frontend:
    image: $FRONTEND_IMAGE
EOF
  docker compose --env-file .env -f docker-compose.yml -f docker-compose.rollback.yaml up -d --no-build
  if ! wait_for_healthy; then
    echo '::error::rollback containers did not become healthy' >&2
  fi
  exit 1
fi
docker image prune -f
```

The `if: always()` diagnostics must show `docker compose ps` and the last 50
API/frontend logs; they must not print `.env`, `previous-images.env`, or
image-pull credentials.

- [ ] **Step 5: Re-run the Hermeticity workflow test**

Expected: no legacy `down`, host `build`, or fixed sleep command remains;
actionlint passes the new event expressions and self-hosted labels.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/deploy.yaml docker-compose.yml scripts/ci/deploy_images.py
git commit -m "feat: deploy ghcr artifacts with health rollback"
```

### Task 5: Prove production delivery and rollback behavior

**Files:**
- Modify: `docs/superpowers/plans/2026-09-09-artifact-deploy.md` (record observed run URLs and digests)

**Interfaces:**
- A green `CI` main run produces deployable image digests.
- A green `Build & Deploy` run proves production is serving those digests.

- [ ] **Step 1: Open a PR and wait for the full CI gate**

Run: `gh pr checks <number> --watch`.

Expected: every required job, including image/Compose validation, is green.

- [ ] **Step 2: Merge and inspect the publishing job**

Run: `gh run list --workflow CI --branch main --limit 1` and inspect the
`Publish production images` logs. Save the exact two digest references from
`production-image-digests` in the PR report, not in source control.

- [ ] **Step 3: Verify automatic production deploy**

Run: `gh run watch <deploy-run-id> --exit-status`.

Expected: the self-hosted job pulls both digest references, all three Compose
services become healthy within 120 seconds, and no `docker compose build` is
executed on the host.

- [ ] **Step 4: Verify rejection before production changes**

Manually dispatch `Build & Deploy` with `bot_image=ghcr.io/example/x:main` and
any valid-looking frontend digest. Expected: validation fails before `docker
compose pull` or `up`; current services remain running.

- [ ] **Step 5: Verify automatic rollback without a database downgrade**

Temporarily dispatch with a real pullable bot digest whose health endpoint is
known to fail, paired with the current frontend digest. Expected: deploy marks
red, writes the rollback override, returns the previous containers to healthy,
and does not execute `alembic downgrade`.

- [ ] **Step 6: Commit the verification record**

```bash
git add docs/superpowers/plans/2026-09-09-artifact-deploy.md
git commit -m "docs: record artifact deploy verification"
```
