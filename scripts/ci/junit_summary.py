"""
Рендер JUnit XML в markdown для $GITHUB_STEP_SUMMARY.

Отдельный скрипт вместо стороннего reporter-action: каждый лишний `uses:`
в workflow — это поверхность для supply-chain атаки, а тут логики на
тридцать строк, и она полностью наша.
"""
from __future__ import annotations

import sys
import xml.etree.ElementTree as ET
from pathlib import Path

# Сколько упавших тестов показываем в таблице. Остальные видно в логах
# джобы — тащить сюда сотню строк смысла нет, сводка перестаёт читаться.
MAX_LISTED_FAILURES = 20


def summarize(path: Path, label: str) -> str:
    """Собрать markdown-сводку по JUnit-отчёту `path` с заголовком `label`.

    Если файл отсутствует или не парсится как XML — это не баг скрипта,
    а обычный симптом того, что pytest упал до записи отчёта (крэш, OOM,
    таймаут). В таком случае возвращаем читаемую сводку вместо traceback:
    шаг с рендером сводки помечен `if: always()` именно для того, чтобы
    отработать и в этой ситуации, а джоба уже красная из-за упавшего шага
    с тестами.
    """
    try:
        root = ET.parse(path).getroot()
    except (FileNotFoundError, ET.ParseError) as exc:
        return (
            f"### Backend tests — {label}\n\n"
            f"**Не удалось прочитать JUnit-отчёт** ({exc}). "
            f"Скорее всего pytest упал до того, как записал файл — "
            f"смотри лог шага с тестами."
        )
    suites = root.iter("testsuite")

    total = skipped = 0
    duration = 0.0
    failures: list[tuple[str, str]] = []

    for suite in suites:
        total += int(suite.get("tests", 0))
        skipped += int(suite.get("skipped", 0))
        duration += float(suite.get("time", 0.0))

        for case in suite.iter("testcase"):
            # errors и failures считаем одинаково: для читающего сводку
            # разницы между «упал по ассерту» и «упал на импорте» нет,
            # оба означают, что коммит не готов.
            problem = case.find("failure")
            if problem is None:
                problem = case.find("error")
            if problem is None:
                continue
            name = f"{case.get('classname', '')}::{case.get('name', '')}"
            failures.append((name, problem.get("message", "").strip()))

    failed = len(failures)
    passed = total - failed - skipped

    lines = [
        f"### Backend tests — {label}",
        "",
        f"**{passed} passed**, **{failed} failed**, {skipped} skipped "
        f"in {duration:.2f}s",
    ]

    if failures:
        lines += [
            "",
            "#### Failing tests",
            "",
            "| Test | Message |",
            "| --- | --- |",
        ]
        for name, message in failures[:MAX_LISTED_FAILURES]:
            # Пайпы внутри сообщения ломают markdown-таблицу.
            safe = message.replace("|", "\\|").replace("\n", " ")
            lines.append(f"| `{name}` | {safe} |")
        if len(failures) > MAX_LISTED_FAILURES:
            lines.append("")
            lines.append(
                f"_...и ещё {len(failures) - MAX_LISTED_FAILURES}. "
                f"Полный список — в логах джобы._"
            )

    return "\n".join(lines)


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: junit_summary.py <results.xml> <label>", file=sys.stderr)
        return 2
    print(summarize(Path(sys.argv[1]), sys.argv[2]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
