"""Helpers for converting CI image digests into a production Compose override."""

from __future__ import annotations

import re
import json
import sys
from pathlib import Path

# Owner/repo pinned, not a wildcard host path: a workflow_run from a fork PR
# can reach this validation with a forged digests.json naming any
# ghcr.io/<anyone>/<anything>@sha256:<digest> it likes. Only this project's
# own published images (Task 3: ghcr.io/fantom2513/vibe_ds_bot-bot-api and
# ghcr.io/fantom2513/vibe_ds_bot-frontend) may reach docker compose pull/up
# on the production host.
_IMAGE_REF = re.compile(r"^ghcr\.io/fantom2513/vibe_ds_bot-(bot-api|frontend)@sha256:[0-9a-f]{64}$")


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


def _main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(
            "usage: deploy_images.py <digests.json> <docker-compose.deploy.yaml>",
            file=sys.stderr,
        )
        return 2

    source, destination = Path(argv[0]), Path(argv[1])
    try:
        write_override_from_json(source, destination)
    except FileNotFoundError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    except (json.JSONDecodeError, KeyError, ValueError) as exc:
        print(f"error: invalid digests JSON in {source}: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(_main(sys.argv[1:]))
