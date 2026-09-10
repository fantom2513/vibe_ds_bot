from pathlib import Path


WORKFLOW = (
    Path(__file__).resolve().parents[2] / ".github" / "workflows" / "deploy.yaml"
)
BOOTSTRAP_START = 'if [[ -z "$bot_previous" && -z "$frontend_previous" ]]; then'
PARTIAL_START = 'elif [[ -z "$bot_previous" || -z "$frontend_previous" ]]; then'
NORMAL_CAPTURE_START = 'if [[ "$bootstrap" == false ]]; then'
HEALTH_FAILURE_START = 'if ! wait_for_healthy; then'
UP_FAILURE_START = 'elif [[ "$up_status" -ne 0 ]]; then'
ROLLBACK_WRITE = 'cat > docker-compose.rollback.yaml <<EOF'
ROLLBACK_UP = '"${rollback_compose[@]}" up -d --no-build'


def _between(source: str, start: str, end: str) -> str:
    """Return the shell branch bounded by two unique workflow markers."""
    start_index = source.index(start)
    end_index = source.index(end, start_index)
    return source[start_index:end_index]


def test_bootstrap_branch_never_persists_a_rollback_target():
    """Catch a bootstrap branch that accidentally writes normal rollback state."""
    workflow = WORKFLOW.read_text(encoding="utf-8")
    bootstrap_branch = _between(workflow, BOOTSTRAP_START, PARTIAL_START)

    assert "previous-images.env" not in bootstrap_branch
    assert "docker-compose.rollback.yaml" not in bootstrap_branch


def test_bootstrap_health_failure_exits_without_entering_rollback_handling():
    """Catch bootstrap failure falling through into a fake rollback path."""
    workflow = WORKFLOW.read_text(encoding="utf-8")
    health_failure = _between(workflow, HEALTH_FAILURE_START, UP_FAILURE_START)
    bootstrap_failure = _between(
        health_failure,
        'if [[ "$bootstrap" == true ]]; then',
        "            set -a",
    )

    assert "exit 1" in bootstrap_failure
    assert ROLLBACK_WRITE not in bootstrap_failure
    assert ROLLBACK_UP not in bootstrap_failure


def test_partial_state_exits_before_deploy_commands_run():
    """Catch a partial rollback target continuing into a deployment."""
    workflow = WORKFLOW.read_text(encoding="utf-8")
    partial_branch = _between(
        workflow,
        PARTIAL_START,
        f'          fi\n          {NORMAL_CAPTURE_START}',
    )

    assert "exit 1" in partial_branch
    assert "pull bot-api frontend" not in partial_branch
    assert "up -d --no-build" not in partial_branch


def test_rollback_file_and_up_are_confined_to_normal_rollout_failure_handling():
    """Catch rollback commands leaking into bootstrap or partial-state branches."""
    workflow = WORKFLOW.read_text(encoding="utf-8")
    normal_failure = _between(workflow, "            set -a", UP_FAILURE_START)

    for marker in (ROLLBACK_WRITE, ROLLBACK_UP):
        assert workflow.count(marker) == 1
        assert marker in normal_failure
