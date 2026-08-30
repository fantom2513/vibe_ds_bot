"""
Рендер PNG-графиков для Discord-сообщений.
matplotlib с headless Agg-бэкендом — процесс не имеет дисплея.
"""
from __future__ import annotations

import io

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt  # noqa: E402 (backend должен быть выбран до этого импорта)

# Тот же порядок и hex, что и в дашборде (frontend/src/components/DailyWorkHoursChart.jsx) —
# см. skill dataviz/references/palette.md, dark-колонка категориальной палитры.
SERIES_COLORS = [
    "#3987e5", "#d95926", "#199e70", "#c98500",
    "#d55181", "#008300", "#9085e9", "#e66767",
]

_SURFACE = "#1a1a19"
_GRID = "#2c2c2a"
_AXIS = "#383835"
_INK_SECONDARY = "#c3c2b7"
_INK_PRIMARY = "#ffffff"


def render_daily_work_hours_chart(
    day_labels: list[str],
    member_names: dict[int, str],
    daily: list[dict[int, int]],
) -> bytes:
    """
    Столбчатая диаграмма рабочих часов по дням, сгруппированная по участникам.

    day_labels — подписи по X, по одной на каждый элемент daily.
    member_names — {discord_id: имя}; порядок ключей задаёт порядок серий и цветов.
    daily — по одному {discord_id: seconds} на день (из calculate_daily_work_seconds);
            участник, отсутствующий в конкретном дне, считается за 0.

    Возвращает готовый PNG как bytes.
    """
    member_ids = list(member_names)
    n_members = len(member_ids) or 1
    bar_width = 0.8 / n_members
    positions = range(len(day_labels))

    fig, ax = plt.subplots(figsize=(8, 4), dpi=150)
    fig.patch.set_facecolor(_SURFACE)
    ax.set_facecolor(_SURFACE)

    for index, member_id in enumerate(member_ids):
        values = [day.get(member_id, 0) / 3600 for day in daily]
        offsets = [pos + index * bar_width for pos in positions]
        ax.bar(
            offsets, values, width=bar_width,
            color=SERIES_COLORS[index % len(SERIES_COLORS)],
            label=member_names[member_id],
        )

    tick_positions = [pos + bar_width * (n_members - 1) / 2 for pos in positions]
    ax.set_xticks(tick_positions)
    ax.set_xticklabels(day_labels, color=_INK_SECONDARY, fontsize=8, rotation=45, ha="right")
    ax.set_ylabel("Часы", color=_INK_SECONDARY)
    ax.tick_params(colors=_INK_SECONDARY)
    for spine in ax.spines.values():
        spine.set_color(_AXIS)
    ax.grid(axis="y", color=_GRID, linestyle="--", linewidth=0.5)
    if member_ids:
        ax.legend(facecolor=_SURFACE, edgecolor=_AXIS, labelcolor=_INK_PRIMARY, fontsize=8)
    fig.tight_layout()

    buffer = io.BytesIO()
    fig.savefig(buffer, format="png", facecolor=fig.get_facecolor())
    plt.close(fig)
    buffer.seek(0)
    return buffer.getvalue()
