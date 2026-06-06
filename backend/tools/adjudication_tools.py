from typing import Any

from backend.shared.phase2_engine import lead_decision


def build_lead_decision(case: dict[str, Any], router_plan: dict[str, Any], specialist_findings: list[dict[str, Any]]) -> dict:
    """Builds the Phase 2 lead adjudication decision."""
    return lead_decision(case, router_plan, specialist_findings)
