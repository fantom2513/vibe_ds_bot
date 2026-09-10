from pathlib import Path


def test_final_bot_image_copies_alembic_cli_from_builder() -> None:
    dockerfile = Path("Dockerfile.bot").read_text(encoding="utf-8")

    assert "COPY --from=builder /install/bin /usr/local/bin" in dockerfile
