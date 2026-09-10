from pathlib import Path


def test_final_bot_image_copies_alembic_cli_from_builder() -> None:
    dockerfile = Path("Dockerfile.bot").read_text(encoding="utf-8")

    assert "COPY --from=builder /install/bin /usr/local/bin" in dockerfile


def test_frontend_healthcheck_uses_ipv4_loopback() -> None:
    """Avoid Alpine resolving localhost to an IPv6 socket nginx does not bind."""
    compose = Path("docker-compose.yml").read_text(encoding="utf-8")

    assert "http://127.0.0.1/" in compose
