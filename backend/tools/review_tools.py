from typing import Any


def evaluate_review_profile(review_profile: dict[str, Any]) -> dict:
    """Evaluates deterministic review integrity-risk metadata."""
    generic_ratio = float(review_profile.get("generic_review_ratio") or 0)
    burst = bool(review_profile.get("review_burst_detected"))
    signals = []
    if generic_ratio >= 0.5:
        signals.append(f"Generic review ratio is {generic_ratio:.0%}.")
    if burst:
        signals.append("Review burst detected.")
    level = "MEDIUM" if signals else "LOW"
    return {
        "review_risk_level": level,
        "review_risk_signals": signals,
    }
