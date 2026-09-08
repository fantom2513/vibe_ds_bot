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
