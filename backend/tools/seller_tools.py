from typing import Any


def evaluate_seller_profile(seller_profile: dict[str, Any]) -> dict:
    """Evaluates deterministic seller trust-risk metadata."""
    age = int(seller_profile.get("seller_age_days") or 0)
    flags = int(seller_profile.get("prior_flags") or 0)
    velocity = int(seller_profile.get("similar_listing_count_24h") or 0)
    signals = []
    if age < 30:
        signals.append(f"Seller account is {age} days old.")
    if flags:
        signals.append(f"Seller has {flags} prior flags.")
    if velocity >= 5:
        signals.append(f"Seller posted {velocity} similar listings in the past 24 hours.")
    level = "MEDIUM" if signals else "LOW"
    return {
        "seller_risk_level": level,
        "seller_risk_signals": signals,
    }
