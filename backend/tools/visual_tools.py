from typing import Any

from backend.shared.phase2_engine import build_timeline_signals


def detect_visual_risk(case: dict[str, Any]) -> dict:
    """Evaluates deterministic visual-risk metadata for a Phase 2 case."""
    signals = build_timeline_signals(case)
    image_changed = signals["image_swapped"]
    contains_brand_logo = signals["image_contains_brand_logo"]
    contains_packaging = signals["image_contains_packaging"]
    level = "MEDIUM" if image_changed and (contains_brand_logo or contains_packaging) else "LOW"
    return {
        "image_changed": image_changed,
        "contains_brand_logo": contains_brand_logo,
        "contains_packaging": contains_packaging,
        "visual_risk_level": level,
        "message": (
            "Image changed after approval and now contains branded packaging/logo metadata."
            if level == "MEDIUM"
            else "No material visual-risk metadata was detected."
        ),
    }
