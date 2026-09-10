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
