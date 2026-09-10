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
