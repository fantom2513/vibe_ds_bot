# Artifact-based deployment design

## Goal

Replace the in-place production build with a build-once, deploy-by-digest
pipeline. A merge to `main` must deploy the exact container images validated by
CI, never compile application code on the production host, and restore the
previous working containers automatically if the new release does not become
healthy.

## Constraints

- The production runner has one CPU core and 2 GB RAM. It is a deployment
  target, not a build or test worker.
- The repository is public. Pull requests must never execute on the
  self-hosted runner.
- The Docker Hub registry returns `403` for the production runner. Production
  application images therefore live in public GHCR packages.
- Database migrations are forward-only. A failed application rollout restores
  containers, but does not run an Alembic downgrade.
- A deployment may take up to two minutes to become ready; health is checked
  every five seconds.

## Release flow

```text
pull request ──> CI checks ──> merge to main
                                  │
                                  ▼
                         CI builds both images
                                  │
                         publishes to GHCR
                                  │
                         records immutable digests
                                  │
                                  ▼
                          Deploy on production host
                                  │
              ┌───────────────────┴───────────────────┐
              ▼                                       ▼
       both services healthy                    timeout / failure
              │                                       │
              ▼                                       ▼
          retain release                  restore prior digests
```

## CI workflow

`ci.yaml` keeps its pull-request and merge-queue triggers and gains `push` on
`main`. Its existing `ci-ok` remains the gate for every change.

After `ci-ok`, a `build-images` job runs only for `push` events on `main`.
It runs on GitHub-hosted infrastructure and:

1. Builds `bot-api` from `Dockerfile.bot` and `frontend` from
   `frontend/Dockerfile.frontend` using Buildx and GitHub Actions layer cache.
2. Publishes public GHCR images under names owned by this repository, with an
   immutable `sha-<commit>` tag and a convenience `main` tag.
3. Captures each resulting `sha256` digest in `digests.json` and uploads it as
   an artifact for the triggering workflow run.
4. Produces an SBOM and build provenance for each image where the supported
   GitHub Actions interfaces allow it.

The job has only the `packages: write` and `contents: read` permissions it
needs. Pull-request jobs do not publish images.

## Deploy workflow

`deploy.yaml` becomes a deployment-only workflow. It has no quality job and
does not build images.

It triggers from a successful `CI` `workflow_run` for `main`, plus a manual
`workflow_dispatch` path. The automatic path downloads `digests.json` from the
successful CI run. The manual path accepts two complete image references,
`bot_image` and `frontend_image`, each pinned with `@sha256:`; this is the
explicit rollback control.

Deployments use the `production` concurrency group with
`cancel-in-progress: false`. A newer release waits for the current one rather
than interrupting it halfway through. The self-hosted runner receives only
`contents: read` and `packages: read` permissions and is used only in this
deploy workflow.

Before changing the stack, the workflow:

1. Writes `.env` under `umask 077` and verifies mode `600`.
2. Records the currently running `bot-api` and `frontend` image IDs in a
   private `previous-images.env` file.
3. Writes a generated compose override containing the new digest-pinned image
   references.
4. Pulls the new images and runs `docker compose up -d` without `down`.

The workflow passes the configured PostgreSQL user directly to `pg_isready`.
It no longer uses a fallback user that differs from the database configuration.

## Readiness and rollback

`docker-compose.yml` defines healthchecks for `bot-api` and `frontend` in
addition to PostgreSQL. The API healthcheck calls its local health endpoint;
the frontend healthcheck calls nginx locally. Both use lightweight tools
available in their respective images.

After `up -d`, the workflow polls Compose health states every five seconds for
at most two minutes. Success requires all three services (`postgres`,
`bot-api`, `frontend`) to be healthy.

On timeout or any failed healthcheck, the workflow:

1. Rewrites the compose override with the saved previous image references.
2. Runs `docker compose up -d` to restore the prior containers.
3. Waits for the restored stack to become healthy.
4. Preserves diagnostic container status and logs, then fails the deployment
   job so the attempted release remains visible as red.

Only container images are rolled back. Alembic migrations remain applied, so
all migrations introduced by a release must remain compatible with the prior
application image.

## Local development and maintenance

The base compose file keeps `build` definitions so local `docker compose up
--build` remains ergonomic. The generated production override supplies
digest-pinned `image` values and production never invokes `docker compose
build`.

After a successful deploy, the workflow prunes dangling image layers. It does
not remove images referenced by the current or saved previous release, keeping
the immediate rollback path available.

## Verification

- CI verifies both Dockerfiles build on GitHub-hosted runners.
- A test merge verifies that `build-images` publishes two GHCR images and a
  `digests.json` artifact.
- The production deploy verifies that it pulls those exact digests, completes
  health checks within the timeout, and leaves `.env` unreadable to other
  users.
- A controlled bad image reference verifies that deployment fails before
  switching services; a controlled unhealthy image verifies the automatic
  rollback path without changing database schema.

## Out of scope

- Kubernetes, multiple production nodes, canary traffic splitting, and a
  staging environment.
- Automated database downgrade. The compatible-migration rule is the safety
  boundary for this single-node deployment.
