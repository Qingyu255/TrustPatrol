from typing import Any

from backend.shared.investigation_engine import enforcement_action_log


def build_enforcement_action_log(lead_decision: dict[str, Any]) -> dict:
    """Builds a simulated operational action log from a lead decision."""
    return enforcement_action_log(lead_decision)
