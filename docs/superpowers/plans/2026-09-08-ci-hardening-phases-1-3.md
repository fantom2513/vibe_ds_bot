# CI Hardening Phases 1–3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a pull-request gate that lints and tests the backend on the Python version production actually ships, locks every dependency, and runs the frontend's existing Playwright suite — which currently never runs at all.

**Architecture:** A new `.github/workflows/ci.yaml` running entirely on GitHub-hosted runners, fanning out from a `changes` path-filter job into per-concern jobs, converging on a single `ci-ok` aggregator that becomes the required status check. Two composite actions hold the shared setup so no job repeats it. `deploy.yaml` is **not touched** in these phases.

**Tech Stack:** GitHub Actions, `uv` (dependency locking), pytest, ruff, Playwright, ESLint, Prettier, Vite.

---

## Scope and Boundaries

This plan covers **phases 1–3** of `docs/superpowers/specs/2026-09-08-ci-hardening-design.md`:

- **Phase 1 — Foundation:** `ci.yaml`, path filters, `ci-ok`, SHA pinning, `permissions`, `concurrency`, backend test matrix. Closes D1, D9, D10, D11.
- **Phase 2 — Hermeticity:** lock files, Python version alignment, dead `Dockerfile` removal. Closes D5, D6, D7.
- **Phase 3 — Frontend in CI:** Playwright as a real dependency, config, sharding, ESLint, bundle budget. Closes D3, D4.

Phases 4–9 (ratchet strictness, integration stack, security scanning, GHCR, deploy rewrite, repo settings) are a **separate plan**. Defects D2, D8, D12, D13, D14, D15 remain open at the end of this plan by design.

### Deliberate omissions, with reasons

Record these as comments where relevant; do not "fix" them.

**`ci.yaml` triggers on `pull_request` and `merge_group` only — not `push: main`.**
`deploy.yaml` still contains its own `quality` job, which gates `main` today. Adding `push: main` here now would run the same tests twice on every merge. The `push: main` trigger arrives in phase 7, when `build-images` needs it, at which point `deploy.yaml`'s `quality` job is deleted in the same change.

**No `pytest-xdist`.** The suite is 77 tests in under 4 seconds. Process-pool startup would cost more than it saves, and `src/engine/tracker.py` holds module-level `_sessions` state (see the `clear_tracker_sessions` fixture in `tests/conftest.py`) that makes distribution a correctness risk for no gain. Sharding is applied only to the Playwright suite, where browser launch genuinely dominates. Parallelism is justified by measurement, not by default.

**No Codecov or third-party test reporters.** Coverage and test results are rendered into `$GITHUB_STEP_SUMMARY` by a small script in this repo. Every additional `uses:` is supply-chain surface; a 30-line script we own is cheaper and fully hermetic.

**Playwright specs keep their per-spec Vite servers.** Each spec starts its own server on a distinct port (5173, 5174, 5175) — a deliberate existing workaround for parallel spec execution, documented in a comment in `tracking.spec.js`. Consolidating onto a single `webServer` in `playwright.config.js` is a refactor of working tests with no CI benefit. Only the module-resolution hack is fixed.

---

## File Structure

**Created:**

| Path | Responsibility |
|---|---|
| `.github/workflows/ci.yaml` | The entire pre-submit pipeline |
| `.github/actions/setup-backend/action.yml` | Composite: install uv, pin Python, install from lock |
| `.github/actions/setup-frontend/action.yml` | Composite: pin Node, `npm ci` |
| `requirements.in` | Application dependencies, human-edited |
| `requirements-dev.in` | Test and lint tooling, human-edited |
| `requirements.lock` | Generated, hashed, committed |
| `requirements-dev.lock` | Generated, hashed, committed |
| `scripts/ci/junit_summary.py` | JUnit XML → markdown job summary |
| `scripts/ci/check_bundle_size.mjs` | Enforce the frontend size budget |
| `scripts/ci/bundle-budget.json` | The budget thresholds |
| `tests/test_scripts/test_junit_summary.py` | Tests for the summary script |
| `frontend/playwright.config.js` | Playwright projects, retries, reporters |
| `frontend/eslint.config.js` | ESLint flat config |
| `frontend/.prettierrc.json` | Prettier config |
| `scripts/ci/check_bundle_size.test.mjs` | Tests for the budget script |

**Modified:** `Dockerfile.bot`, `frontend/package.json`, the three files in `frontend/tests/*.spec.js`.

**Deleted:** `Dockerfile` (root, dead), `requirements.txt` (replaced by `.in` + `.lock`).

### Pinned action SHAs

Every SHA below was verified to resolve to a real commit. Use these exact values.

```
actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09      # v5
actions/setup-python@ece7cb06caefa5fff74198d8649806c4678c61a1  # v6
actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020    # v4
dorny/paths-filter@0e4a8c6effa4802afeda77dc8d303f8176d7dfad    # v3
actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4
astral-sh/setup-uv@d4b2f3b6ecc6e67c4457f6d3e41ec42d3d0fcb86    # v5
```

A mutable tag can be repointed by anyone who controls the action repository, and this repository schedules jobs on a self-hosted runner. Pin by SHA, keep the version in a trailing comment so Dependabot can still bump it.

---

# Phase 1 — Foundation

## Task 1: JUnit summary script

This runs first because it is the only piece of these phases with real logic, so it is the only piece that can be genuinely test-driven.

> **Amended after code review (commit `dcaa5a5`).** The implementation below is
> incomplete as originally written: `ET.parse` has no error handling, so a
> missing, empty, or truncated JUnit file raises before `print()` ever runs and
> **nothing is appended to the step summary at all**. That is exactly backwards
> from the intent — Task 5 puts `if: always()` on this step precisely so it
> survives a catastrophic pytest failure, and a catastrophic failure is what
> produces a broken XML file in the first place.
>
> `summarize()` therefore catches `FileNotFoundError` and `ET.ParseError` and
> returns a readable markdown block instead of raising, and the process exits 0:
> the pytest step has already failed and turned the job red, so a second red
> step adds noise without adding information. The catch is narrow on purpose —
> a bug in our own formatting logic must still surface as a traceback.
>
> Four tests were added alongside it: one for a suite containing real skips
> (`skipped` participates in the `passed = total - failed - skipped` arithmetic
> and had no coverage), and one each for a missing file, an empty file, and
> truncated XML. Final count: 8 tests in this file, 85 in the suite.

**Files:**
- Create: `scripts/ci/junit_summary.py`
- Create: `tests/test_scripts/__init__.py` (empty)
- Test: `tests/test_scripts/test_junit_summary.py`

- [ ] **Step 1: Create the test package marker**

Create `tests/test_scripts/__init__.py` as an empty file. Every other directory under `tests/` has one; match the pattern.

- [ ] **Step 2: Write the failing tests**

Create `tests/test_scripts/test_junit_summary.py`:

```python
"""Тесты для scripts/ci/junit_summary.py — рендер JUnit XML в markdown."""
import textwrap

from scripts.ci.junit_summary import summarize


def _write(tmp_path, xml: str):
    path = tmp_path / "results.xml"
    path.write_text(textwrap.dedent(xml).strip(), encoding="utf-8")
    return path


def test_all_passing_reports_zero_failures(tmp_path):
    path = _write(tmp_path, """
        <testsuites>
          <testsuite name="pytest" tests="2" failures="0" errors="0" skipped="0" time="1.5">
            <testcase classname="tests.test_a" name="test_one" time="1.0"/>
            <testcase classname="tests.test_a" name="test_two" time="0.5"/>
          </testsuite>
        </testsuites>
    """)

    summary = summarize(path, label="py3.12")

    assert "py3.12" in summary
    assert "2 passed" in summary
    assert "0 failed" in summary


def test_failure_names_are_listed(tmp_path):
    path = _write(tmp_path, """
        <testsuites>
          <testsuite name="pytest" tests="2" failures="1" errors="0" skipped="0" time="1.5">
            <testcase classname="tests.test_a" name="test_ok" time="1.0"/>
            <testcase classname="tests.test_a" name="test_bad" time="0.5">
              <failure message="assert 1 == 2">detail</failure>
            </testcase>
          </testsuite>
        </testsuites>
    """)

    summary = summarize(path, label="py3.11")

    assert "1 failed" in summary
    assert "tests.test_a::test_bad" in summary
    assert "assert 1 == 2" in summary


def test_errors_count_toward_failures(tmp_path):
    path = _write(tmp_path, """
        <testsuites>
          <testsuite name="pytest" tests="1" failures="0" errors="1" skipped="0" time="0.2">
            <testcase classname="tests.test_a" name="test_boom" time="0.2">
              <error message="ImportError: no module named x">trace</error>
            </testcase>
          </testsuite>
        </testsuites>
    """)

    summary = summarize(path, label="py3.12")

    assert "1 failed" in summary
    assert "tests.test_a::test_boom" in summary


def test_passing_summary_lists_no_failure_table(tmp_path):
    path = _write(tmp_path, """
        <testsuites>
          <testsuite name="pytest" tests="1" failures="0" errors="0" skipped="0" time="0.1">
            <testcase classname="tests.test_a" name="test_one" time="0.1"/>
          </testsuite>
        </testsuites>
    """)

    summary = summarize(path, label="py3.12")

    assert "Failing tests" not in summary
```

- [ ] **Step 3: Run the tests to verify they fail**

```
.\.venv\Scripts\python.exe -m pytest tests/test_scripts/test_junit_summary.py -v
```

Expected: collection error, `ModuleNotFoundError: No module named 'scripts'`.

- [ ] **Step 4: Create the package markers for the script**

Create empty `scripts/__init__.py` and `scripts/ci/__init__.py`. `pytest.ini` already sets `pythonpath = .`, so `from scripts.ci.junit_summary import summarize` resolves once these exist.

- [ ] **Step 5: Write the implementation**

Create `scripts/ci/junit_summary.py`:

```python
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
    """Собрать markdown-сводку по JUnit-отчёту `path` с заголовком `label`."""
    root = ET.parse(path).getroot()
    suites = root.iter("testsuite")

    total = passed = failed = skipped = 0
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
```

- [ ] **Step 6: Run the tests to verify they pass**

```
.\.venv\Scripts\python.exe -m pytest tests/test_scripts/test_junit_summary.py -v
```

Expected: 4 passed (8 after the review amendment above).

- [ ] **Step 7: Verify the whole suite still passes**

```
.\.venv\Scripts\python.exe -m pytest -q
```

Expected: `81 passed` (77 existing + 4 new); `85 passed` after the review amendment.

- [ ] **Step 8: Commit**

```bash
git add scripts/__init__.py scripts/ci/__init__.py scripts/ci/junit_summary.py tests/test_scripts/
git commit -m "feat: add JUnit XML to markdown summary script for CI"
```

---

## Task 2: Split requirements into source and lock files

> Belongs to phase 2, executed here: every job added in phase 1 installs its
> dependencies from these lock files, so they must exist first.

**Files:**
- Create: `requirements.in`, `requirements-dev.in`
- Create: `requirements.lock`, `requirements-dev.lock` (generated)
- Modify: `.github/workflows/deploy.yaml` (one line — see Step 6)
- Delete: `requirements.txt`

- [ ] **Step 1: Write `requirements.in`**

Application dependencies only. `pytest` and `pytest-asyncio` were previously in
`requirements.txt`, which meant the production image shipped a test framework;
they move to the dev file.

```
discord.py>=2.3.0
fastapi>=0.104.0
uvicorn[standard]>=0.24.0
asyncpg>=0.29.0
sqlalchemy[asyncio]>=2.0.0
alembic>=1.12.0
pydantic>=2.0.0
pydantic-settings>=2.0.0
pyyaml>=6.0
apscheduler>=3.10.0
structlog>=23.0.0
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
httpx>=0.27.0
sse-starlette>=1.6.1
matplotlib>=3.8.0
```

- [ ] **Step 2: Write `requirements-dev.in`**

Versions of pytest, pytest-asyncio, pytest-cov and ruff are pinned to exactly
what is installed in `.venv` today, so this change alters CI plumbing without
also silently changing tool behaviour. `pytest-timeout` is new.

```
-r requirements.in

pytest==8.3.5
pytest-asyncio==0.24.0
pytest-cov==6.0.0
pytest-timeout>=2.3.0
ruff==0.9.10
```

- [ ] **Step 3: Generate the lock files**

`--python-platform` and `--python-version` are both required. Without them the
lock would encode this Windows machine's resolution, and CI on Linux would
either fail the hash check or install different wheels. `3.11` is the lowest
version in the test matrix, so the lock must satisfy it.

```
uv pip compile requirements.in -o requirements.lock --generate-hashes --python-version 3.11 --python-platform x86_64-unknown-linux-gnu
uv pip compile requirements-dev.in -o requirements-dev.lock --generate-hashes --python-version 3.11 --python-platform x86_64-unknown-linux-gnu
```

- [ ] **Step 4: Confirm the locks are hashed and complete**

```
Select-String -Path requirements.lock -Pattern '--hash=sha256:' | Measure-Object | Select-Object -ExpandProperty Count
Select-String -Path requirements.lock -Pattern '^\s*(discord-py|fastapi|matplotlib|structlog)'
```

Expected: a hash count well above 50 (every wheel and sdist contributes at least one), and all four named packages present.

- [ ] **Step 5: Delete the old file**

```
git rm requirements.txt
```

- [ ] **Step 6: Verify nothing else referenced `requirements.txt`**

```
Select-String -Path Dockerfile.bot,Dockerfile,docker-compose.yml,README.md,.github/workflows/deploy.yaml -Pattern 'requirements.txt'
```

Expected hits: `Dockerfile.bot`, the root `Dockerfile`, and `deploy.yaml`.

- Tasks 7 and 8 handle the two Dockerfiles.
- **`deploy.yaml` must be patched now** or `main` breaks on the next merge. Change its `Install test tools` step from `python -m pip install -r requirements.txt ruff` to `python -m pip install -r requirements-dev.lock`. This is the single deliberate touch to `deploy.yaml` in this plan; the full rewrite stays in phase 8.

- [ ] **Step 7: Verify a clean install from the lock works**

```
.\.venv\Scripts\python.exe -m pip install --dry-run --require-hashes -r requirements-dev.lock
```

Expected: pip resolves without a hash mismatch. A `--require-hashes` error here means the lock was generated for a different platform — re-run Step 3.

- [ ] **Step 8: Verify the existing suite still passes against the locked set**

```
.\.venv\Scripts\python.exe -m pip install --require-hashes -r requirements-dev.lock
.\.venv\Scripts\python.exe -m pytest -q
```

Expected: `81 passed`. A failure here means locking pinned a dependency to a
version the code does not work with — report it rather than loosening the lock.

- [ ] **Step 9: Commit**

```bash
git add requirements.in requirements-dev.in requirements.lock requirements-dev.lock .github/workflows/deploy.yaml
git commit -m "feat: replace floating requirements.txt with hashed uv lock files"
```

---

## Task 3: Backend setup composite action

**Files:**
- Create: `.github/actions/setup-backend/action.yml`

- [ ] **Step 1: Write the composite action**

Create `.github/actions/setup-backend/action.yml`:

```yaml
name: Setup backend
description: >
  Устанавливает Python нужной версии и зависимости через uv.
  Вынесено в composite action, чтобы lint- и test-джобы не расходились
  в способе установки — расхождение здесь означает, что линтер и тесты
  видят разные зависимости.

inputs:
  python-version:
    description: Версия Python
    required: true
  groups:
    description: >
      Что ставить: `app` (только requirements.lock),
      `dev` (только requirements-dev.lock) или `all` (оба).
    required: false
    default: all

runs:
  using: composite
  steps:
    - name: Install uv
      uses: astral-sh/setup-uv@d4b2f3b6ecc6e67c4457f6d3e41ec42d3d0fcb86 # v5
      with:
        enable-cache: true
        # Ключ кэша завязан на лок-файлы: меняется лок — греется заново,
        # не меняется — переиспользуется между джобами и запусками.
        cache-dependency-glob: "requirements*.lock"

    - name: Set up Python ${{ inputs.python-version }}
      uses: actions/setup-python@ece7cb06caefa5fff74198d8649806c4678c61a1 # v6
      with:
        python-version: ${{ inputs.python-version }}

    - name: Install application dependencies
      if: inputs.groups == 'app' || inputs.groups == 'all'
      shell: bash
      # --require-hashes: отказаться ставить пакет, чей хэш не совпал
      # с зафиксированным. Без этого флага лок-файл — просто список версий,
      # а не гарантия того, что приехал тот же самый код.
      run: uv pip install --system --require-hashes -r requirements.lock

    - name: Install development dependencies
      if: inputs.groups == 'dev' || inputs.groups == 'all'
      shell: bash
      run: uv pip install --system --require-hashes -r requirements-dev.lock
```

- [ ] **Step 2: Commit**

The lock files this action installs from already exist (Task 2). No workflow calls the action until Task 5, so committing it alone keeps the diff reviewable.

```bash
git add .github/actions/setup-backend/action.yml
git commit -m "feat: add backend setup composite action"
```

---

## Task 4: `ci.yaml` skeleton — `changes` and `ci-ok`

**Files:**
- Create: `.github/workflows/ci.yaml`

- [ ] **Step 1: Write the workflow skeleton**

Create `.github/workflows/ci.yaml`:

```yaml
name: CI

# Триггеров `push: main` здесь намеренно нет. Пока deploy.yaml содержит
# собственную джобу quality, добавление push:main гоняло бы одни и те же
# тесты дважды на каждый мерж. push:main появится в фазе 7, когда
# build-images начнёт пушить образы в GHCR — тогда же quality уедет
# из deploy.yaml.
on:
  pull_request:
  merge_group:

# Дефолтные права GITHUB_TOKEN шире, чем нужно любой из этих джоб.
# Задаём на уровне workflow — джоба, которой нужно больше, поднимает
# себе права явно и это видно в ревью.
permissions:
  contents: read

# Новый пуш в ту же ветку отменяет предыдущий прогон: держать в очереди
# проверку заведомо устаревшего коммита незачем.
concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  changes:
    name: Detect changed areas
    runs-on: ubuntu-latest
    outputs:
      backend: ${{ steps.filter.outputs.backend }}
      frontend: ${{ steps.filter.outputs.frontend }}
      docker: ${{ steps.filter.outputs.docker }}
    steps:
      - uses: actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5

      - uses: dorny/paths-filter@0e4a8c6effa4802afeda77dc8d303f8176d7dfad # v3
        id: filter
        with:
          filters: |
            backend:
              - 'src/**'
              - 'tests/**'
              - 'scripts/**'
              - 'alembic/**'
              - 'requirements*.in'
              - 'requirements*.lock'
              - 'pytest.ini'
              - 'ruff.toml'
              - '.github/**'
            frontend:
              - 'frontend/**'
              - '.github/**'
            # Ни одна джоба фаз 1-3 не читает этот выход — его потребитель
            # (build-images) появляется в фазе 7. Фильтр объявлен здесь,
            # чтобы пути жили в одном месте, а не расползались по фазам.
            docker:
              - 'Dockerfile*'
              - 'frontend/Dockerfile*'
              - 'docker-compose.yml'
              - '.github/**'

  ci-ok:
    name: CI OK
    # Единственный required check в branch protection.
    #
    # Джоба обязательна, а не декоративна: при условных джобах (`if:` от
    # path-фильтров) пропущенная джоба отдаёт branch protection статус
    # success. Если требовать джобы поимённо, отфильтрованная поломка
    # проедет как зелёная. Поэтому агрегатор смотрит на результаты сам и
    # трактует skipped как «ок», а failure/cancelled — как «нет».
    #
    # `changes` тоже в needs: если упадёт она, все остальные будут
    # skipped, и без этой строчки прогон стал бы зелёным.
    if: always()
    needs: [changes]
    runs-on: ubuntu-latest
    steps:
      - name: Verify no dependency failed
        if: contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled')
        run: |
          echo "One or more required jobs did not succeed." >&2
          exit 1

      - name: Report success
        run: echo "All required jobs succeeded."
```

- [ ] **Step 2: Validate the workflow syntax locally**

Install `actionlint` and run it. On Windows with Go available:

```
go install github.com/rhysd/actionlint/cmd/actionlint@latest
& "$env:USERPROFILE\go\bin\actionlint.exe" .github/workflows/ci.yaml
```

If Go is unavailable, download the release binary for windows-amd64 from
`https://github.com/rhysd/actionlint/releases` and run it against the file.

Expected: no output (actionlint prints nothing when clean).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yaml
git commit -m "feat: add CI workflow skeleton with path filters and ci-ok gate"
```

---

## Task 5: `lint-backend` and `test-backend` jobs

**Files:**
- Modify: `.github/workflows/ci.yaml`

- [ ] **Step 1: Add the two jobs**

In `.github/workflows/ci.yaml`, insert these jobs between `changes` and `ci-ok`:

```yaml
  lint-backend:
    name: Lint backend
    needs: changes
    if: needs.changes.outputs.backend == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5

      - uses: ./.github/actions/setup-backend
        with:
          python-version: '3.12'
          groups: dev

      # Набор правил пока прежний (E,F из ruff.toml). Ужесточение с
      # ratchet-базлайном — фаза 4; смешивать его с переездом на новый
      # workflow значит не понять, что именно сломалось.
      - name: ruff check
        run: ruff check src tests scripts

  test-backend:
    name: Test backend (py${{ matrix.python-version }})
    needs: changes
    if: needs.changes.outputs.backend == 'true'
    runs-on: ubuntu-latest
    strategy:
      # Падение на одной версии не должно прятать результат по другой:
      # знать, что баг именно version-specific, важнее, чем сэкономить
      # минуту раннера.
      fail-fast: false
      matrix:
        python-version: ['3.11', '3.12']
    steps:
      - uses: actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5

      - uses: ./.github/actions/setup-backend
        with:
          python-version: ${{ matrix.python-version }}

      # --timeout: зависший тест иначе съедает шестичасовой лимит джобы.
      # 60 с с запасом: весь текущий прогон занимает около 4 секунд.
      - name: pytest
        run: >
          pytest
          --timeout=60
          --junitxml=junit-${{ matrix.python-version }}.xml
          --cov=src
          --cov-report=term-missing
          --cov-report=xml:coverage-${{ matrix.python-version }}.xml

      - name: Render test summary
        # if: always() — сводка нужна именно тогда, когда тесты упали.
        if: always()
        run: |
          python scripts/ci/junit_summary.py \
            junit-${{ matrix.python-version }}.xml \
            "py${{ matrix.python-version }}" >> "$GITHUB_STEP_SUMMARY"

      - name: Upload test artifacts
        if: always()
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4
        with:
          name: backend-test-results-py${{ matrix.python-version }}
          path: |
            junit-${{ matrix.python-version }}.xml
            coverage-${{ matrix.python-version }}.xml
          retention-days: 7
```

- [ ] **Step 2: Add both jobs to the `ci-ok` needs list**

Change the `needs` line of `ci-ok` from `needs: [changes]` to:

```yaml
    needs: [changes, lint-backend, test-backend]
```

- [ ] **Step 3: Verify the exact commands run locally**

The value of a CI command is that a developer can run it verbatim. Confirm both:

```
.\.venv\Scripts\python.exe -m ruff check src tests scripts
.\.venv\Scripts\python.exe -m pytest --timeout=60 --junitxml=junit-local.xml --cov=src --cov-report=term-missing
```

Expected: ruff reports `All checks passed!`; pytest reports `81 passed`.

If `--timeout` is rejected with `unrecognized arguments`, the `.venv` was not
refreshed from the lock in Task 2 Step 8 — re-run that step.

- [ ] **Step 4: Verify the summary script against real output**

```
.\.venv\Scripts\python.exe scripts/ci/junit_summary.py junit-local.xml py3.12
```

Expected: markdown reading `**81 passed**, **0 failed**, 0 skipped`.

- [ ] **Step 5: Clean up local artifacts**

```
Remove-Item junit-local.xml, .coverage -ErrorAction SilentlyContinue
```

- [ ] **Step 6: Validate and commit**

```
& "$env:USERPROFILE\go\bin\actionlint.exe" .github/workflows/ci.yaml
```

```bash
git add .github/workflows/ci.yaml
git commit -m "feat: add backend lint and test jobs on a 3.11/3.12 matrix"
```

---

# Phase 2 — Hermeticity

> Task 2 (the requirements split) belongs to this phase but executes in phase 1,
> because every phase-1 job installs from the lock files it produces. The
> remaining phase-2 work follows.

## Task 6: `hermeticity` job — lock drift and workflow linting

**Files:**
- Modify: `.github/workflows/ci.yaml`

- [ ] **Step 1: Add the job**

Insert before `ci-ok`:

```yaml
  hermeticity:
    name: Hermeticity
    needs: changes
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5

      - uses: astral-sh/setup-uv@d4b2f3b6ecc6e67c4457f6d3e41ec42d3d0fcb86 # v5

      # Ловит «поправил requirements.in, забыл перегенерировать лок».
      # Без этой проверки лок-файл тихо расходится с источником и
      # перестаёт что-либо гарантировать.
      - name: Verify lock files are in sync with their sources
        run: |
          set -euo pipefail
          for name in requirements requirements-dev; do
            uv pip compile "$name.in" -o "/tmp/$name.check" \
              --generate-hashes \
              --python-version 3.11 \
              --python-platform x86_64-unknown-linux-gnu \
              --quiet
            if ! diff -u "$name.lock" "/tmp/$name.check"; then
              echo "::error file=$name.lock::$name.lock is stale. Re-run: uv pip compile $name.in -o $name.lock --generate-hashes --python-version 3.11 --python-platform x86_64-unknown-linux-gnu"
              exit 1
            fi
          done

      - name: Verify frontend lock is in sync
        working-directory: frontend
        # `npm ci` отказывается работать, если package-lock.json разошёлся
        # с package.json — то есть сама команда и есть проверка.
        run: npm ci --ignore-scripts

      - name: Lint workflow files
        run: |
          bash <(curl -fsSL https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.bash)
          ./actionlint -color
```

- [ ] **Step 2: Add to the `ci-ok` needs list**

```yaml
    needs: [changes, lint-backend, test-backend, hermeticity]
```

Note `hermeticity` has no `if:` guard — it runs on every pull request. A lock file can drift from a change to `package.json` alone, which no single path filter captures cleanly, and the job takes under a minute.

- [ ] **Step 3: Verify the drift check locally**

Confirm it passes on the current tree:

```
uv pip compile requirements.in -o "$env:TEMP\req.check" --generate-hashes --python-version 3.11 --python-platform x86_64-unknown-linux-gnu --quiet
```

Then compare — note `-w` to ignore the CRLF/LF difference Git introduces on Windows checkout, which does not exist on the Linux runner:

```
git diff --no-index -w requirements.lock "$env:TEMP\req.check"
```

Expected: no differences.

- [ ] **Step 4: Prove the check actually catches drift**

A check that has never failed is not known to work.

```
Add-Content requirements.in "`nrequests>=2.31.0"
uv pip compile requirements.in -o "$env:TEMP\req.drift" --generate-hashes --python-version 3.11 --python-platform x86_64-unknown-linux-gnu --quiet
git diff --no-index -w requirements.lock "$env:TEMP\req.drift"
```

Expected: a diff showing `requests` added — this is the failure the job would report. Now revert:

```
git checkout requirements.in
Remove-Item "$env:TEMP\req.check", "$env:TEMP\req.drift" -ErrorAction SilentlyContinue
```

- [ ] **Step 5: Validate and commit**

```
& "$env:USERPROFILE\go\bin\actionlint.exe" .github/workflows/ci.yaml
```

```bash
git add .github/workflows/ci.yaml
git commit -m "feat: add hermeticity job checking lock drift and workflow syntax"
```

---

## Task 7: Rebuild `Dockerfile.bot` on Python 3.12

**Files:**
- Modify: `Dockerfile.bot`

- [ ] **Step 1: Record the current image size for comparison**

```
docker build -f Dockerfile.bot -t vibe-bot:before .
docker image inspect vibe-bot:before --format '{{.Size}}'
```

Note the number.

- [ ] **Step 2: Rewrite the file**

Replace the entire contents of `Dockerfile.bot`:

```dockerfile
# Версия синхронизирована с матрицей CI. Раньше здесь стоял 3.11, а тесты
# гонялись на 3.12 — то есть в прод уезжал интерпретатор, на котором ничего
# не проверялось.
FROM python:3.12-slim AS builder

# uv ставит зависимости на порядок быстрее pip, что заметно и на раннере,
# и при пересборке образа. Копируем бинарь из официального образа, чтобы
# не тащить в сборку установочный скрипт из сети.
COPY --from=ghcr.io/astral-sh/uv:0.5.11 /uv /bin/uv

WORKDIR /app

COPY requirements.lock .
# --require-hashes: не ставить ничего, чей хэш разошёлся с локом.
# Ставим в /install, чтобы во второй стейдж уехали только пакеты,
# без uv и без кэша сборки.
RUN uv pip install --python /usr/local/bin/python \
        --target /install \
        --require-hashes \
        -r requirements.lock


FROM python:3.12-slim

# ffmpeg нужен discord.py для передачи звука в голосовой канал.
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Процесс не нуждается в root: в контейнере он только читает свой код и
# ходит в сеть. Непривилегированный пользователь ограничивает, что может
# сделать эксплойт в зависимости.
RUN useradd --create-home --uid 10001 app

WORKDIR /app

COPY --from=builder /install /usr/local/lib/python3.12/site-packages

COPY --chown=app:app src/ ./src/
COPY --chown=app:app alembic/ ./alembic/
COPY --chown=app:app config.yaml alembic.ini ./

USER app

# Байткод пишется в образ на этапе сборки, а не в рантайме, где у app
# нет прав на запись в site-packages.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

CMD ["python", "-m", "src.main"]
```

- [ ] **Step 3: Build and compare**

```
docker build -f Dockerfile.bot -t vibe-bot:after .
docker image inspect vibe-bot:after --format '{{.Size}}'
```

Expected: builds cleanly; the multi-stage split should not be larger than `before`.

- [ ] **Step 4: Verify the interpreter and that the app imports**

```
docker run --rm vibe-bot:after python --version
docker run --rm vibe-bot:after python -c "import src.main; print('import ok')"
docker run --rm vibe-bot:after whoami
```

Expected: `Python 3.12.x`; `import ok`; `app`.

If the import fails on a missing settings environment variable, that is
expected — `src/config/settings.py` validates on import. In that case verify a
leaf module instead:

```
docker run --rm vibe-bot:after python -c "import discord, fastapi, structlog, matplotlib; print('deps ok')"
```

- [ ] **Step 5: Commit**

```bash
git add Dockerfile.bot
git commit -m "feat: rebuild bot image on python 3.12 with hashed lock and non-root user"
```

---

## Task 8: Delete the dead root `Dockerfile`

**Files:**
- Delete: `Dockerfile`

- [ ] **Step 1: Confirm nothing references it**

```
Select-String -Path docker-compose.yml,.github/workflows/*.yaml,README.md,scripts/* -Pattern 'dockerfile' -CaseSensitive:$false
```

Expected: only `Dockerfile.bot` and `frontend/Dockerfile.frontend` appear. No
reference to a bare root `Dockerfile`.

- [ ] **Step 2: Delete and commit**

```bash
git rm Dockerfile
git commit -m "chore: remove dead root Dockerfile"
```

---

# Phase 3 — Frontend in CI

## Task 9: Make Playwright a real dependency

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/playwright.config.js`
- Modify: `frontend/tests/tracking.spec.js`, `frontend/tests/admin-dashboard-redesign.spec.js`, `frontend/tests/admin-pages-redesign.spec.js`

- [ ] **Step 1: Install Playwright as a dev dependency**

```
cd frontend
npm install --save-dev --save-exact @playwright/test@1.49.1
npx playwright install --with-deps chromium
cd ..
```

Pinned exactly: a Playwright minor bump can change selector and
auto-waiting behaviour, which is precisely the kind of silent change that
produces "flaky" tests.

- [ ] **Step 2: Add scripts to `frontend/package.json`**

Replace the `scripts` block:

```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test:e2e": "playwright test",
    "lint": "eslint .",
    "format:check": "prettier --check ."
  },
```

`lint` and `format:check` reference tooling added in Task 11; they are declared
here so `package.json` is edited once.

- [ ] **Step 3: Fix the module-resolution hack in all three spec files**

Each spec currently opens with:

```javascript
import { createRequire } from 'node:module'
...
const requireFromRunner = createRequire(process.argv[1])
const { test, expect } = requireFromRunner('playwright/test')
```

This resolves `playwright/test` relative to the *runner binary* — it exists only
because Playwright was never a declared dependency and was invoked through
`npx`. Now that it is in `package.json`, replace those lines in **each** of the
three files with a normal import:

```javascript
import { test, expect } from '@playwright/test'
```

Delete the now-unused `createRequire` import line from each file. Keep the
`import { createServer } from 'vite'` line and everything below it unchanged.

- [ ] **Step 4: Write the Playwright config**

Create `frontend/playwright.config.js`:

```javascript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',

  // Каждый spec-файл поднимает собственный vite-сервер на своём порту
  // (5173/5174/5175) в beforeAll — это уже существующий обход того, что
  // Playwright гоняет файлы параллельно. Поэтому webServer здесь не
  // задан: он поднял бы четвёртый сервер, которым никто не пользуется.
  fullyParallel: true,

  // Запретить test.only, случайно уехавший в коммит: локально он выглядит
  // как зелёный прогон, а в CI молча пропускает весь остальной файл.
  forbidOnly: !!process.env.CI,

  // Ретраи только в CI. Локально повтор прячет флейк от того, кто его
  // сейчас может починить; в CI он отделяет флейк от настоящей поломки —
  // прошедший со второго раза тест виден в отчёте как flaky, а не как pass.
  retries: process.env.CI ? 2 : 0,

  // Один воркер на шард: у раннера 4 ядра, но каждый spec-файл поднимает
  // свой vite, и параллельные сборки конкурируют за CPU сильнее, чем
  // выигрывают на параллелизме.
  workers: 1,

  reporter: process.env.CI
    // blob-репортеры со всех шардов сливаются в один HTML-отчёт
    // отдельной джобой — иначе на каждый шард свой кусок и общей
    // картины нет.
    ? [['blob'], ['github']]
    : [['html', { open: 'never' }]],

  use: {
    // Артефакты только для упавших: трейс каждого теста — это десятки
    // мегабайт на прогон.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
```

- [ ] **Step 5: Run the suite locally to establish a baseline**

```
cd frontend
npx playwright test
cd ..
```

Expected: all specs pass. If any fail, **stop and report** — do not adjust the
tests. These specs were passing when last run manually; a failure here is
information about either the config or a real regression, and silently editing
a test to go green destroys that information.

- [ ] **Step 6: Verify the sharding split works**

```
cd frontend
npx playwright test --shard=1/3
npx playwright test --shard=2/3
npx playwright test --shard=3/3
cd ..
```

Expected: each command runs a subset, and every test appears in exactly one
shard. Confirm the three counts sum to the total from Step 5.

- [ ] **Step 7: Add Playwright's output directories to `.gitignore`**

Check `frontend/.gitignore` for `test-results`, `playwright-report`, and
`blob-report`. Add any that are missing. (`frontend/test-results/` already
exists on disk and must not be committed.)

- [ ] **Step 8: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/playwright.config.js frontend/tests/ frontend/.gitignore
git commit -m "feat: declare playwright as a dependency and add sharded config"
```

---

## Task 10: `e2e` job with sharding and report merge

**Files:**
- Create: `.github/actions/setup-frontend/action.yml`
- Modify: `.github/workflows/ci.yaml`

- [ ] **Step 1: Write the frontend setup composite action**

Create `.github/actions/setup-frontend/action.yml`:

```yaml
name: Setup frontend
description: Пинит Node и ставит зависимости строго из package-lock.json.

runs:
  using: composite
  steps:
    - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
      with:
        node-version: '20'
        cache: npm
        cache-dependency-path: frontend/package-lock.json

    # npm ci, не npm install: ci ставит ровно то, что в локе, и падает при
    # расхождении с package.json. npm install молча правит лок.
    - name: Install dependencies
      shell: bash
      working-directory: frontend
      run: npm ci
```

Node 20 matches `frontend/Dockerfile.frontend` (`node:20-alpine`) — the version
that builds the shipped bundle.

- [ ] **Step 2: Add the e2e jobs to `ci.yaml`**

Insert before `ci-ok`:

```yaml
  e2e:
    name: E2E (shard ${{ matrix.shard }}/3)
    needs: changes
    if: needs.changes.outputs.frontend == 'true'
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3]
    steps:
      - uses: actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5

      - uses: ./.github/actions/setup-frontend

      # Только chromium: три браузера утроили бы время ради покрытия,
      # которого этому дашборду не требуется — он ходит в один Discord-
      # аккаунт с одной машины. Расширять есть куда, если появится повод.
      - name: Install Chromium
        working-directory: frontend
        run: npx playwright install --with-deps chromium

      - name: Run Playwright shard
        working-directory: frontend
        run: npx playwright test --shard=${{ matrix.shard }}/3

      - name: Upload blob report
        if: always()
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4
        with:
          name: blob-report-${{ matrix.shard }}
          path: frontend/blob-report
          retention-days: 7

      - name: Upload failure artifacts
        if: failure()
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4
        with:
          name: e2e-traces-${{ matrix.shard }}
          path: frontend/test-results
          retention-days: 7

  e2e-report:
    name: Merge E2E reports
    # if: always() — сводный отчёт нужен прежде всего когда шарды упали.
    # Условие на result отсекает случай, когда e2e была отфильтрована.
    if: always() && needs.e2e.result != 'skipped'
    needs: e2e
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5

      - uses: ./.github/actions/setup-frontend

      - name: Download all blob reports
        uses: actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093 # v4
        with:
          path: frontend/all-blob-reports
          pattern: blob-report-*
          merge-multiple: true

      - name: Merge into a single HTML report
        working-directory: frontend
        run: npx playwright merge-reports --reporter html ./all-blob-reports

      - name: Upload merged report
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4
        with:
          name: playwright-report
          path: frontend/playwright-report
          retention-days: 14
```

- [ ] **Step 3: Add to the `ci-ok` needs list**

```yaml
    needs: [changes, lint-backend, test-backend, hermeticity, e2e, e2e-report]
```

`e2e-report` is included so that a merge failure is visible rather than silent.

- [ ] **Step 4: Validate and commit**

```
& "$env:USERPROFILE\go\bin\actionlint.exe" .github/workflows/ci.yaml
```

```bash
git add .github/actions/setup-frontend/action.yml .github/workflows/ci.yaml
git commit -m "feat: run playwright suite in CI across three shards"
```

---

## Task 11: ESLint, Prettier, and the `lint-frontend` job

**Files:**
- Create: `frontend/eslint.config.js`, `frontend/.prettierrc.json`
- Modify: `frontend/package.json`, `.github/workflows/ci.yaml`

- [ ] **Step 1: Install the tooling**

```
cd frontend
npm install --save-dev --save-exact eslint@9.17.0 @eslint/js@9.17.0 eslint-plugin-react@7.37.3 eslint-plugin-react-hooks@5.1.0 globals@15.14.0 prettier@3.4.2
cd ..
```

- [ ] **Step 2: Write the ESLint flat config**

Create `frontend/eslint.config.js`:

```javascript
import js from '@eslint/js'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default [
  { ignores: ['dist/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', 'blob-report/**'] },

  js.configs.recommended,

  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      // Проект на React 18 с новым JSX-трансформом: импорт React в
      // области видимости не нужен, и требовать его — ложные срабатывания.
      'react/react-in-jsx-scope': 'off',

      // PropTypes в проекте не используются; включать правило значит
      // получить замечание на каждый компонент разом.
      'react/prop-types': 'off',
    },
  },

  {
    // Тесты и конфиги исполняются в Node, а не в браузере.
    files: ['tests/**/*.js', '*.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
]
```

- [ ] **Step 3: Write the Prettier config**

Create `frontend/.prettierrc.json`. Values match the style already present in
`frontend/src` — no semicolons, single quotes:

```json
{
  "semi": false,
  "singleQuote": true,
  "printWidth": 100,
  "trailingComma": "es5"
}
```

Create `frontend/.prettierignore`:

```
dist
node_modules
playwright-report
test-results
blob-report
package-lock.json
```

- [ ] **Step 4: Measure the existing violation count**

```
cd frontend
npx eslint . 2>&1 | Select-Object -Last 5
npx prettier --check . 2>&1 | Select-Object -Last 5
cd ..
```

Record both numbers. **Do not fix violations in this task.**

- [ ] **Step 5: Decide how the job reports, based on that count**

- **Zero or a handful of errors:** wire the job as blocking (`npm run lint`).
- **Many errors:** the ratchet baseline is phase 4, and inventing a second
  mechanism here would be waste. Wire the job to report into the step summary
  without failing, and leave this comment above the step:

```yaml
      # Не блокирует: на существующем коде ESLint выдаёт замечания, а
      # ratchet-базлайн (запрет только НОВЫХ нарушений) — фаза 4. До неё
      # джоба показывает картину, не останавливая работу. Снять
      # continue-on-error вместе с вводом базлайна.
      continue-on-error: true
```

- [ ] **Step 6: Add the job to `ci.yaml`**

Insert before `ci-ok`:

```yaml
  lint-frontend:
    name: Lint frontend
    needs: changes
    if: needs.changes.outputs.frontend == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5

      - uses: ./.github/actions/setup-frontend

      - name: ESLint
        working-directory: frontend
        run: npm run lint

      - name: Prettier
        working-directory: frontend
        run: npm run format:check
```

Apply the `continue-on-error` decision from Step 5 to whichever steps need it.

- [ ] **Step 7: Add to the `ci-ok` needs list**

```yaml
    needs: [changes, lint-backend, test-backend, hermeticity, e2e, e2e-report, lint-frontend]
```

- [ ] **Step 8: Validate and commit**

```
& "$env:USERPROFILE\go\bin\actionlint.exe" .github/workflows/ci.yaml
```

```bash
git add frontend/eslint.config.js frontend/.prettierrc.json frontend/.prettierignore frontend/package.json frontend/package-lock.json .github/workflows/ci.yaml
git commit -m "feat: add eslint and prettier with a frontend lint job"
```

---

## Task 12: Bundle size budget script

**Files:**
- Create: `scripts/ci/check_bundle_size.mjs`
- Create: `scripts/ci/bundle-budget.json`
- Test: `scripts/ci/check_bundle_size.test.mjs`

- [ ] **Step 1: Write the failing test**

Node 20 ships `node:test`, so this needs no new dependency.

Create `scripts/ci/check_bundle_size.test.mjs`:

```javascript
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

import { measureBundle, checkBudget } from './check_bundle_size.mjs'

async function makeDist(files) {
  const dir = await mkdtemp(join(tmpdir(), 'bundle-'))
  const assets = join(dir, 'assets')
  await mkdir(assets)
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(assets, name), content)
  }
  return dir
}

test('measureBundle sums gzipped sizes per file type', async () => {
  const js = 'x'.repeat(5000)
  const css = 'y'.repeat(3000)
  const dir = await makeDist({ 'app.js': js, 'app.css': css })

  const result = await measureBundle(dir)

  assert.equal(result.js, gzipSync(Buffer.from(js)).length)
  assert.equal(result.css, gzipSync(Buffer.from(css)).length)
})

test('measureBundle ignores non-asset files such as source maps', async () => {
  const dir = await makeDist({ 'app.js': 'a'.repeat(100), 'app.js.map': 'b'.repeat(90000) })

  const result = await measureBundle(dir)

  assert.equal(result.js, gzipSync(Buffer.from('a'.repeat(100))).length)
})

test('checkBudget passes when every measurement is under budget', () => {
  const outcome = checkBudget({ js: 100, css: 50 }, { js: 200, css: 100 })

  assert.equal(outcome.ok, true)
  assert.equal(outcome.violations.length, 0)
})

test('checkBudget reports every category that is over budget', () => {
  const outcome = checkBudget({ js: 300, css: 150 }, { js: 200, css: 100 })

  assert.equal(outcome.ok, false)
  assert.equal(outcome.violations.length, 2)
  assert.match(outcome.violations[0], /js/)
})

test('checkBudget treats a measurement exactly at budget as passing', () => {
  const outcome = checkBudget({ js: 200 }, { js: 200 })

  assert.equal(outcome.ok, true)
})
```

- [ ] **Step 2: Run the test to verify it fails**

```
node --test scripts/ci/check_bundle_size.test.mjs
```

Expected: fails — `Cannot find module .../check_bundle_size.mjs`.

- [ ] **Step 3: Write the implementation**

Create `scripts/ci/check_bundle_size.mjs`:

```javascript
#!/usr/bin/env node
/**
 * Бюджет размера фронтового бандла.
 *
 * Меряем gzip, а не сырой размер: пользователь получает бандл сжатым,
 * и именно эта цифра определяет время загрузки. Разница между сырым и
 * gzip для JS — обычно в три-четыре раза, так что бюджет по сырому
 * размеру измерял бы не то.
 */
import { readdir, readFile } from 'node:fs/promises'
import { join, extname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

// .map намеренно не считаем: source maps не доезжают до пользователя.
const COUNTED = new Set(['.js', '.css'])

export async function measureBundle(distDir) {
  const assetsDir = join(distDir, 'assets')
  const entries = await readdir(assetsDir)
  const totals = { js: 0, css: 0 }

  for (const name of entries) {
    const ext = extname(name)
    if (!COUNTED.has(ext)) continue
    const content = await readFile(join(assetsDir, name))
    totals[ext.slice(1)] += gzipSync(content).length
  }

  return totals
}

export function checkBudget(measured, budget) {
  const violations = []

  for (const [category, limit] of Object.entries(budget)) {
    const actual = measured[category] ?? 0
    if (actual > limit) {
      violations.push(
        `${category}: ${(actual / 1024).toFixed(1)} KB gzipped exceeds budget of ${(limit / 1024).toFixed(1)} KB`
      )
    }
  }

  return { ok: violations.length === 0, violations }
}

async function main() {
  const [distDir, budgetPath] = process.argv.slice(2)
  if (!distDir || !budgetPath) {
    console.error('usage: check_bundle_size.mjs <dist-dir> <budget.json>')
    process.exit(2)
  }

  const budget = JSON.parse(await readFile(budgetPath, 'utf8'))
  const measured = await measureBundle(distDir)
  const { ok, violations } = checkBudget(measured, budget)

  for (const [category, bytes] of Object.entries(measured)) {
    const limit = budget[category]
    console.log(
      `${category}: ${(bytes / 1024).toFixed(1)} KB gzipped` +
        (limit ? ` (budget ${(limit / 1024).toFixed(1)} KB)` : '')
    )
  }

  if (!ok) {
    for (const violation of violations) console.error(`::error::${violation}`)
    process.exit(1)
  }
}

// Запускаем main только при прямом вызове, чтобы импорт из теста не дёргал
// process.exit. pathToFileURL, а не сравнение строк путей: на Windows
// import.meta.url — это file:///D:/..., а process.argv[1] — D:\..., и
// наивное сравнение здесь всегда ложно.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main()
}
```

- [ ] **Step 4: Run the test to verify it passes**

```
node --test scripts/ci/check_bundle_size.test.mjs
```

Expected: `# pass 5`.

- [ ] **Step 5: Build the real bundle and read the actual numbers**

```
cd frontend
npm run build
cd ..
node scripts/ci/check_bundle_size.mjs frontend/dist scripts/ci/bundle-budget.json
```

The last command fails — the budget file does not exist yet. That is what the
next step needs the numbers for, so read them from the `npm run build` output,
or run this to get the measurement directly:

```
node -e "import('./scripts/ci/check_bundle_size.mjs').then(async m => console.log(await m.measureBundle('frontend/dist')))"
```

- [ ] **Step 6: Write the budget file using the measured values**

Create `scripts/ci/bundle-budget.json`, setting each limit roughly **15% above**
the number just measured. Rationale for the headroom, and a warning against
raising it casually, go in the file next to the values.

Example shape — substitute the real measurements:

```json
{
  "_comment": "Байты, gzip. Порог примерно на 15% выше фактического размера: бюджет должен ловить скачок от случайно затащенной библиотеки, а не срабатывать на каждую новую кнопку. Поднимать значение можно, но только осознанно и отдельным коммитом — молча подвинутый бюджет не ловит ничего.",
  "js": 0,
  "css": 0
}
```

- [ ] **Step 7: Verify the check passes on the real bundle**

```
node scripts/ci/check_bundle_size.mjs frontend/dist scripts/ci/bundle-budget.json
```

Expected: prints the sizes with budgets, exits 0.

- [ ] **Step 8: Prove the check catches a regression**

Temporarily halve the `js` value in `bundle-budget.json` and re-run:

```
node scripts/ci/check_bundle_size.mjs frontend/dist scripts/ci/bundle-budget.json
```

Expected: `::error::js: ... exceeds budget of ...`, exit code 1. Restore the
correct value afterwards and confirm it passes again.

- [ ] **Step 9: Commit**

```bash
git add scripts/ci/check_bundle_size.mjs scripts/ci/check_bundle_size.test.mjs scripts/ci/bundle-budget.json
git commit -m "feat: add gzipped bundle size budget check"
```

---

## Task 13: `build-frontend` job

**Files:**
- Modify: `.github/workflows/ci.yaml`

- [ ] **Step 1: Add the job**

Insert before `ci-ok`:

```yaml
  build-frontend:
    name: Build frontend
    needs: changes
    if: needs.changes.outputs.frontend == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5

      - uses: ./.github/actions/setup-frontend

      - name: Build
        working-directory: frontend
        run: npm run build

      - name: Check bundle size budget
        run: node scripts/ci/check_bundle_size.mjs frontend/dist scripts/ci/bundle-budget.json | tee -a "$GITHUB_STEP_SUMMARY"

      - name: Run bundle script unit tests
        run: node --test scripts/ci/check_bundle_size.test.mjs
```

- [ ] **Step 2: Add to the `ci-ok` needs list**

The final list:

```yaml
    needs:
      - changes
      - lint-backend
      - test-backend
      - hermeticity
      - lint-frontend
      - build-frontend
      - e2e
      - e2e-report
```

- [ ] **Step 3: Validate and commit**

```
& "$env:USERPROFILE\go\bin\actionlint.exe" .github/workflows/ci.yaml
```

```bash
git add .github/workflows/ci.yaml
git commit -m "feat: add frontend build job with bundle budget enforcement"
```

---

## Task 14: Verify the pipeline end to end on a real pull request

A workflow that has never run is not known to work. `actionlint` checks syntax,
not behaviour.

**Files:** none — this task is verification.

- [ ] **Step 1: Push the branch and open a draft pull request**

```bash
git push -u origin feat/ci-hardening
gh pr create --draft --title "CI hardening: phases 1-3" --body "Implements phases 1-3 of docs/superpowers/specs/2026-09-08-ci-hardening-design.md"
```

- [ ] **Step 2: Watch the run**

```bash
gh pr checks --watch
```

- [ ] **Step 3: Confirm each of these, and report the actual result**

- `changes` sets `backend` and `frontend` to `true` (this branch touches both)
- `test-backend` runs twice, once per Python version, and both pass
- The job summary shows the rendered test table from `junit_summary.py`
- `e2e` runs as three shards and `e2e-report` produces a `playwright-report` artifact
- `hermeticity` passes the lock-drift check
- `ci-ok` is green

- [ ] **Step 4: Verify `ci-ok` actually fails when something breaks**

This is the single most important check in the plan: `ci-ok` is what branch
protection will rely on, and a gate that cannot fail is worse than no gate,
because it looks like protection.

Break one test deliberately, push, and confirm `ci-ok` goes red:

```bash
# Add a deliberately failing assertion to a backend test
git commit -am "test: TEMPORARY - verify ci-ok fails on a red test"
git push
gh pr checks --watch
```

Expected: `test-backend` red, `ci-ok` **red**.

Then revert:

```bash
git revert --no-edit HEAD
git push
```

Confirm `ci-ok` returns to green.

- [ ] **Step 5: Verify `ci-ok` fails when a path-filtered job is skipped and another fails**

The specific trap `ci-ok` exists to close. Change only a frontend file in a way
that breaks the build, so `lint-backend` and `test-backend` are **skipped**
while `build-frontend` fails.

Expected: `ci-ok` **red**, not green. If it is green, the `contains(needs.*.result, ...)`
condition is wrong and must be fixed before this plan is complete.

Revert afterwards.

- [ ] **Step 6: Record the total wall-clock time**

```bash
gh run list --branch feat/ci-hardening --limit 1
```

Note the duration. If the pipeline exceeds roughly 10 minutes, say so in the
report — pre-submit feedback that is slow gets bypassed, and the fix belongs in
this plan rather than a later one.

- [ ] **Step 7: Mark the pull request ready and report**

```bash
gh pr ready
```

Report: the wall-clock time, the outcome of the two deliberate-failure checks in
Steps 4 and 5, and the ESLint and Prettier violation counts recorded in Task 11
Step 4, since those determine how phase 4 begins.

---

## Outcome

Executed on branch `feat/ci-hardening`, PR #8. Full pipeline green in
**3 min 48 s** across 13 jobs.

**The three things that could not be verified locally, and how they turned out:**

| Unknown | Result |
|---|---|
| `Dockerfile.bot` rewritten blind — no Docker on the dev machine | **Builds and runs.** `uv pip install --target` did not break the compiled extensions; `pydantic_core`, `asyncpg` and `matplotlib` all import, and the container is non-root |
| `playwright.config.js` never executed — Playwright hangs on the dev machine | **Works.** All three shards pass and the blob reports merge |
| Suite never run against the locked versions (fastapi 0.141, discord.py 2.7, structlog 26) | **85 tests pass on both 3.11 and 3.12** |

**Defects found by running the tooling rather than reasoning about it:**

1. `ruff` scope widened to `scripts/` surfaced a real unused import in
   `check_agent3.py` — `lint-backend` would have been red on arrival.
2. `actionlint` rejected `deploy.yaml` over the self-hosted label
   `lastelle`; since `hermeticity` lints every workflow, it would have been
   red on arrival. Fixed by declaring the label in `.github/actionlint.yaml`
   rather than suppressing the rule, which catches genuine `runs-on` typos.
3. **The lock drift check could never have passed.** `uv` records its own
   invocation — including the `-o` path — in the lock header, and the check
   compiled to `/tmp/*.check` and diffed that against the committed file. It
   now compiles in a temp directory using identical relative filenames. The
   resolution itself matched byte-for-byte between the Windows checkout and
   the Linux runner, which is what actually mattered.
4. Both `uv` and `actionlint` were unpinned, so a new upstream release would
   have turned CI red with no change to this repository — the same defect,
   twice, inside the job whose entire purpose is hermeticity. Both pinned.
5. `shellcheck` (run by `actionlint` only when installed, and absent on the
   Windows dev machine) flagged SC2086 on `deploy.yaml:76`. Quoting fixed;
   the deeper defect on that line is D8 and stays for phase 8, now recorded
   in a comment above it so it is not mistaken for a working check.

**`ci-ok` was verified to actually fail, not assumed:**

- Red when `hermeticity` failed while every other job passed.
- Red when `lint-frontend` failed while `lint-backend`, `test-backend` and
  `docker-build` were **skipped** by path filters (throwaway PR #9, since a
  PR's filters evaluate against the base branch, so the whole-diff of PR #8
  matches every filter). This is the case the job exists for: GitHub reports
  a skipped job to branch protection as success.

**Deviation from the plan:** a `docker-build` job was added, giving the
`docker` path filter the consumer it previously lacked. Without it the
rewritten image would have shipped unbuilt.

**Left open by design:** D2, D8, D12, D13, D14, D15 — the phase 4–9 plan.
Branch protection and the merge queue are not yet configured, so `ci-ok` is
not yet required.

## Definition of Done

- [ ] `ci.yaml` runs on every pull request and gates on a single `ci-ok` check
- [ ] `ci-ok` demonstrably fails both on a failing test and on a failing job whose siblings were path-filtered away (verified in Task 14, not assumed)
- [ ] Backend tests run on Python 3.11 and 3.12; the bot image runs 3.12
- [ ] Every dependency resolves from a hashed lock file, and drift from the source manifests fails CI
- [ ] The Playwright suite runs in CI, sharded, with traces retained on failure
- [ ] Every `uses:` is pinned to a commit SHA
- [ ] `permissions:` and `concurrency:` are set on `ci.yaml`
- [ ] The root `Dockerfile` is gone
- [ ] Defects D1, D3, D4, D5, D6, D7, D9, D10, D11 are closed

**Left open by design, for the phase 4–9 plan:** D2 (down-before-build), D8 (vacuous `pg_isready`), D12 (`sleep 10`), D13 (no rollback), D14 (`.env` permissions), D15 (self-hosted runner isolation is conventional, not enforced).
