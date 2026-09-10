from pathlib import Path


WORKFLOW = (
    Path(__file__).resolve().parents[2] / ".github" / "workflows" / "deploy.yaml"
)


def test_bootstrap_deploy_is_allowed_only_when_both_rollback_containers_are_absent():
    """Keep an empty production host deployable without making partial state safe."""
    workflow = WORKFLOW.read_text(encoding="utf-8")

    assert 'if [[ -z "$bot_previous" && -z "$frontend_previous" ]]; then' in workflow
    assert 'echo "::notice::no previous containers found; performing bootstrap deploy"' in workflow
    assert 'elif [[ -z "$bot_previous" || -z "$frontend_previous" ]]; then' in workflow
    assert "partial previous-container state; rollback unavailable — refusing to deploy" in workflow
