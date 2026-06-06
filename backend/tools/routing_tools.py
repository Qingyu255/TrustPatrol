from typing import Any

from backend.shared.investigation_engine import build_investigation_plan, build_timeline_signals


def compute_timeline_signals(case: dict[str, Any]) -> dict:
    """Computes structured Phase 2 listing, seller, review, and image signals."""
    return build_timeline_signals(case)


def build_router_plan(case: dict[str, Any]) -> dict:
    """Builds the deterministic Phase 2 investigation plan."""
    signals = build_timeline_signals(case)
    return build_investigation_plan(case, signals)
