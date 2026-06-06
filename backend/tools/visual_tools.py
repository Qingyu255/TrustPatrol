from typing import Any

from backend.shared.investigation_engine import build_timeline_signals


def detect_visual_risk(case: dict[str, Any]) -> dict:
    """Evaluates deterministic visual-risk metadata for a Phase 2 case."""
    signals = build_timeline_signals(case)
    baseline_review = signals.get("baseline_review", False)
    image_changed = signals["image_swapped"]
    contains_brand_logo = signals["image_contains_brand_logo"]
    contains_packaging = signals["image_contains_packaging"]
    visual_signal = contains_brand_logo or contains_packaging
    level = "MEDIUM" if visual_signal and (baseline_review or image_changed) else "LOW"
    if level == "MEDIUM" and baseline_review:
        message = "Baseline image metadata contains branded packaging/logo signals."
    elif level == "MEDIUM":
        message = "Image changed after approval and now contains branded packaging/logo metadata."
    else:
        message = "No material visual-risk metadata was detected."
    return {
        "baseline_review": baseline_review,
        "image_changed": image_changed,
        "contains_brand_logo": contains_brand_logo,
        "contains_packaging": contains_packaging,
        "visual_risk_level": level,
        "message": message,
    }
