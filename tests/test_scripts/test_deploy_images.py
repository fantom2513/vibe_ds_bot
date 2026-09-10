from pathlib import Path

import pytest

from scripts.ci.deploy_images import _main, render_override, validate_image_ref, write_override_from_json


BOT = "ghcr.io/fantom2513/vibe_ds_bot-bot-api@sha256:" + "a" * 64
FRONTEND = "ghcr.io/fantom2513/vibe_ds_bot-frontend@sha256:" + "b" * 64


def test_accepts_a_complete_ghcr_digest_reference():
    assert validate_image_ref(BOT) == BOT


@pytest.mark.parametrize("value", [
    "ghcr.io/fantom2513/vibe_ds_bot-bot-api:main",
    "docker.io/library/python@sha256:" + "a" * 64,
    "ghcr.io/fantom2513/vibe_ds_bot-bot-api@sha256:" + "a" * 63,
    # Well-formed sha256 GHCR ref, but a different owner/image — must not
    # pass just because the host and digest shape are right (a forged
    # artifact could otherwise name any ghcr.io/<anyone>/<anything> image).
    "ghcr.io/someone-else/vibe_ds_bot-bot-api@sha256:" + "a" * 64,
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


def test_cli_writes_the_override_for_valid_input(tmp_path: Path):
    source = tmp_path / "digests.json"
    destination = tmp_path / "docker-compose.deploy.yaml"
    source.write_text('{"bot_image": "' + BOT + '", "frontend_image": "' + FRONTEND + '"}')

    exit_code = _main([str(source), str(destination)])

    assert exit_code == 0
    assert f"image: {BOT}" in destination.read_text()
    assert f"image: {FRONTEND}" in destination.read_text()


def test_cli_rejects_an_invalid_image_ref_without_writing_the_override(tmp_path: Path):
    source = tmp_path / "digests.json"
    destination = tmp_path / "docker-compose.deploy.yaml"
    source.write_text('{"bot_image": "ghcr.io/fantom2513/vibe_ds_bot-bot-api:main", "frontend_image": "' + FRONTEND + '"}')

    exit_code = _main([str(source), str(destination)])

    assert exit_code != 0
    assert not destination.exists()


def test_cli_rejects_malformed_json_without_writing_the_override(tmp_path: Path):
    source = tmp_path / "digests.json"
    destination = tmp_path / "docker-compose.deploy.yaml"
    source.write_text("not valid json")

    exit_code = _main([str(source), str(destination)])

    assert exit_code != 0
    assert not destination.exists()


def test_cli_reports_usage_error_for_wrong_argument_count():
    assert _main([]) == 2
    assert _main(["only-one-arg"]) == 2
