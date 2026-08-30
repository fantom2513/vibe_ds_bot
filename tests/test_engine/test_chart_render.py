"""Тесты рендера PNG-графика рабочих часов для Discord-отчёта."""
from src.engine.chart_render import render_daily_work_hours_chart

PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


def test_render_returns_valid_png_bytes() -> None:
    png = render_daily_work_hours_chart(
        day_labels=["28.08", "29.08", "30.08"],
        member_names={1: "Ada", 2: "Bob"},
        daily=[{1: 3600, 2: 0}, {1: 0, 2: 7200}, {1: 1800, 2: 1800}],
    )

    assert isinstance(png, bytes)
    assert png.startswith(PNG_MAGIC)
    assert len(png) > 0


def test_render_handles_no_tracked_members_without_raising() -> None:
    png = render_daily_work_hours_chart(
        day_labels=["28.08", "29.08"],
        member_names={},
        daily=[{}, {}],
    )

    assert png.startswith(PNG_MAGIC)


def test_render_handles_member_missing_from_some_days() -> None:
    """Участник появился не во всех словарях daily — считается 0, не падает."""
    png = render_daily_work_hours_chart(
        day_labels=["28.08", "29.08"],
        member_names={1: "Ada", 2: "Bob"},
        daily=[{1: 3600}, {1: 1800, 2: 900}],
    )

    assert png.startswith(PNG_MAGIC)
