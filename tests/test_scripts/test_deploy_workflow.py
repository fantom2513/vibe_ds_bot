import re
from pathlib import Path

import pytest

WORKFLOW = (
    Path(__file__).resolve().parents[2] / ".github" / "workflows" / "deploy.yaml"
)
CI_WORKFLOW = (
    Path(__file__).resolve().parents[2] / ".github" / "workflows" / "ci.yaml"
)
BOOTSTRAP_AND_PARTIAL_FLOW = re.compile(
    r'''(?ms)
^          if \[\[ -z "\$bot_previous" && -z "\$frontend_previous" \]\]; then$
^            bootstrap=true$
^            echo "::notice::no previous containers found; performing bootstrap deploy"$
^          elif \[\[ -z "\$bot_previous" \|\| -z "\$frontend_previous" \]\]; then$
^            echo '::error::partial previous-container state; rollback unavailable — refusing to deploy' >&2$
^            exit 1$
^          fi$
^          if \[\[ "\$bootstrap" == false \]\]; then$
^            printf 'BOT_IMAGE=%q\\nFRONTEND_IMAGE=%q\\n' "\$bot_previous" "\$frontend_previous" > previous-images\.env$
^          fi$
^          compose=\(docker compose --env-file \.env -f docker-compose\.yml -f docker-compose\.deploy\.yaml\)$
.*?^          "\$\{compose\[@\]\}" pull bot-api frontend$
.*?^          "\$\{compose\[@\]\}" up -d --no-build \|\| up_status=\$\?$
.*?^          if ! wait_for_healthy; then$
^            if \[\[ "\$bootstrap" == true \]\]; then$
^              echo '::error::bootstrap containers did not become healthy; no rollback target exists' >&2$
^              exit 1$
^            fi$
^            set -a$
'''
)
NORMAL_ROLLBACK_FLOW = re.compile(
    r'''(?ms)
^            set -a$
^            \. \.\/previous-images\.env$
^            set \+a$
^            cat > docker-compose\.rollback\.yaml <<EOF$
.*?^            "\$\{rollback_compose\[@\]\}" up -d --no-build \|\| echo 'rollback compose up reported failure; falling through to health check'$
'''
)


def _assert_deploy_control_flow(source: str) -> None:
    """Validate branch order for bootstrap, partial-state, and rollback paths."""
    assert BOOTSTRAP_AND_PARTIAL_FLOW.search(source), "bootstrap/partial flow changed"
    assert NORMAL_ROLLBACK_FLOW.search(source), "normal rollback flow changed"
    assert len(re.findall(r"(?m)^            cat > docker-compose\.rollback\.yaml <<EOF$", source)) == 1
    assert len(re.findall(r'(?m)^            "\$\{rollback_compose\[@\]\}" up -d --no-build', source)) == 1


def test_workflow_enforces_ordered_bootstrap_partial_and_rollback_control_flow():
    """Protect the approved bootstrap and normal rollback control-flow contract."""
    _assert_deploy_control_flow(WORKFLOW.read_text(encoding="utf-8"))


def test_control_flow_contract_rejects_bootstrap_fallthrough():
    """A missing bootstrap exit must not fall through into normal rollback."""
    workflow = WORKFLOW.read_text(encoding="utf-8")
    malformed = workflow.replace(
        """              echo '::error::bootstrap containers did not become healthy; no rollback target exists' >&2
              exit 1
            fi
            set -a""",
        """              echo '::error::bootstrap containers did not become healthy; no rollback target exists' >&2
            fi
            set -a""",
        1,
    )

    with pytest.raises(AssertionError, match="bootstrap/partial flow changed"):
        _assert_deploy_control_flow(malformed)


def test_control_flow_contract_rejects_partial_state_continuing_to_deploy():
    """A partial rollback target must exit before normal capture and deploy."""
    workflow = WORKFLOW.read_text(encoding="utf-8")
    malformed = workflow.replace(
        """            echo '::error::partial previous-container state; rollback unavailable — refusing to deploy' >&2
            exit 1
          fi
          if [[ "$bootstrap" == false ]]; then""",
        """            echo '::error::partial previous-container state; rollback unavailable — refusing to deploy' >&2
          fi
          if [[ "$bootstrap" == false ]]; then""",
        1,
    )

    with pytest.raises(AssertionError, match="bootstrap/partial flow changed"):
        _assert_deploy_control_flow(malformed)


def test_image_publishing_runs_after_ci_ok_when_other_ci_jobs_are_skipped():
    """A skipped path-filtered job must not suppress the main-image publisher.

    A bare `success()` (the implicit default when `if:` is omitted) skips
    this job whenever *any* job in the run's dependency graph was skipped,
    even one this job doesn't directly need — that's what happened before
    this contract existed: a backend-only push skips lint-frontend/e2e/
    docker-build, and the publisher was skipped right along with them
    despite `ci-ok` itself reporting success. A bare `always()` overcorrects
    the other way: it also runs when `ci-ok` fails outright, publishing
    broken images (see the negative assertion below — reproduced for real
    on 2026-09-11, images pushed to GHCR after a failed Lint frontend job).
    Reading `needs.ci-ok.result` directly sidesteps both: it's an explicit
    expression, not the implicit success() that cascades through skips.
    """
    workflow = CI_WORKFLOW.read_text(encoding="utf-8")

    assert (
        "if: needs.ci-ok.result == 'success' && github.event_name == 'push' && github.ref == 'refs/heads/main'"
        in workflow
    )
    assert "if: always() && github.event_name == 'push'" not in workflow
