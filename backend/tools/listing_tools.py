import json
import re
from typing import Any


COUNTERFEIT_KEYWORDS = [
    "OEM",
    "1:1",
    "1-1",
    "AAA",
    "mirror",
    "mirror quality",
    "factory batch",
    "same production line",
    "replica",
    "authentic grade",
    "original quality",
    "factory direct",
    "no receipt",
]


def _json_objects_from_text(text: str) -> list[dict[str, Any]]:
    decoder = json.JSONDecoder()
    objects = []
    index = 0
    while index < len(text):
        brace_index = text.find("{", index)
        if brace_index == -1:
            break
        try:
            value, end = decoder.raw_decode(text[brace_index:])
        except json.JSONDecodeError:
            index = brace_index + 1
            continue
        if isinstance(value, dict):
            objects.append(value)
        index = brace_index + end
    return objects


def _repair_json_object(candidate: str) -> dict[str, Any] | None:
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        pass

    stripped = candidate.strip()
    if stripped.endswith("}") and stripped.count('"') % 2 == 1:
        repaired = stripped[:-1] + '"}'
        try:
            value = json.loads(repaired)
        except json.JSONDecodeError:
            return None
        return value if isinstance(value, dict) else None
    return None


def _jsonish_objects_from_text(text: str) -> list[dict[str, Any]]:
    objects = []
    start = None
    depth = 0
    in_string = False
    escaped = False
    for index, char in enumerate(text):
        if escaped:
            escaped = False
            continue
        if char == "\\" and in_string:
            escaped = True
            continue
        if char == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if char == "{":
            if depth == 0:
                start = index
            depth += 1
        elif char == "}" and depth:
            depth -= 1
            if depth == 0 and start is not None:
                value = _repair_json_object(text[start : index + 1])
                if value is not None:
                    objects.append(value)
                start = None
    return objects


def _split_concatenated_json_objects(text: str) -> list[dict[str, Any]]:
    objects = []
    parts = re.split(r"}\s*{", text.strip())
    if len(parts) < 2:
        return objects
    for index, part in enumerate(parts):
        candidate = part
        if index > 0:
            candidate = "{" + candidate
        if index < len(parts) - 1:
            candidate = candidate + "}"
        value = _repair_json_object(candidate)
        if value is not None:
            objects.append(value)
    return objects


def _coerce_timeline(listing_timeline: str | dict[str, Any] | list[dict[str, Any]]) -> list[dict[str, Any]]:
    if isinstance(listing_timeline, list):
        versions = listing_timeline
    elif isinstance(listing_timeline, dict):
        versions = listing_timeline.get("versions", [listing_timeline])
    else:
        text = listing_timeline.strip()
        try:
            parsed = json.loads(text)
            versions = parsed.get("versions", [parsed]) if isinstance(parsed, dict) else parsed
        except json.JSONDecodeError:
            versions = _json_objects_from_text(text)
            if len(versions) < 2:
                repaired_versions = _jsonish_objects_from_text(text)
                if len(repaired_versions) > len(versions):
                    versions = repaired_versions
            if len(versions) < 2:
                split_versions = _split_concatenated_json_objects(text)
                if len(split_versions) > len(versions):
                    versions = split_versions

    if not isinstance(versions, list):
        versions = [versions]

    cleaned = [item for item in versions if isinstance(item, dict)]
    return sorted(cleaned, key=lambda item: item.get("version", 0))


def _previous_current(listing_timeline: str | dict[str, Any] | list[dict[str, Any]]) -> tuple[dict[str, Any], dict[str, Any]]:
    versions = _coerce_timeline(listing_timeline)
    if len(versions) < 2:
        raise ValueError("At least two listing versions are required.")
    return versions[-2], versions[-1]


def _current_version(listing_timeline: str | dict[str, Any] | list[dict[str, Any]]) -> dict[str, Any] | None:
    versions = _coerce_timeline(listing_timeline)
    return versions[-1] if versions else None


def _insufficient_versions(message: str = "At least two listing versions are required.") -> dict:
    return {
        "error": "insufficient_versions",
        "message": message,
    }


def _norm(value: Any) -> str:
    return str(value or "").strip()


def detect_brand_injection(listing_timeline: str) -> dict:
    """Detects whether a brand was added or changed after an approved version."""
    try:
        previous, current = _previous_current(listing_timeline)
    except ValueError:
        current = _current_version(listing_timeline) or {}
        current_brand = _norm(current.get("brand"))
        return {
            "baseline_review": True,
            "brand_injection": False,
            "baseline_brand_claim": bool(current_brand),
            "brand_added": None,
            "previous_brand": None,
            "current_brand": current_brand or None,
            "message": (
                f"Baseline listing claims brand {current_brand}."
                if current_brand
                else "Baseline listing has no brand claim."
            ),
        }
    previous_brand = _norm(previous.get("brand"))
    current_brand = _norm(current.get("brand"))
    brand_injection = bool(current_brand and previous_brand.lower() != current_brand.lower())
    message = (
        f"Brand {current_brand} was added after approval."
        if brand_injection and not previous_brand
        else f"Brand changed from {previous_brand} to {current_brand} after approval."
        if brand_injection
        else "No brand injection detected."
    )
    return {
        "baseline_review": False,
        "brand_injection": brand_injection,
        "baseline_brand_claim": False,
        "brand_added": current_brand if brand_injection else None,
        "previous_brand": previous_brand or None,
        "current_brand": current_brand or None,
        "message": message,
    }


def detect_price_anomaly(listing_timeline: str) -> dict:
    """Detects whether the listing price dropped by at least 50 percent."""
    try:
        previous, current = _previous_current(listing_timeline)
    except ValueError as error:
        return {
            **_insufficient_versions(str(error)),
            "price_drop_pct": 0,
            "price_anomaly": False,
        }
    previous_price = float(previous.get("price") or 0)
    current_price = float(current.get("price") or 0)
    if previous_price <= 0:
        price_drop_pct = 0
    else:
        price_drop_pct = round(max((previous_price - current_price) / previous_price * 100, 0), 1)
    price_anomaly = price_drop_pct >= 50
    return {
        "price_drop_pct": price_drop_pct,
        "price_anomaly": price_anomaly,
        "previous_price": previous_price,
        "current_price": current_price,
        "message": (
            f"Price dropped by {price_drop_pct:g}%."
            if price_drop_pct > 0
            else "No price drop detected."
        ),
    }


def detect_counterfeit_keywords(listing_timeline: str) -> dict:
    """Detects counterfeit-associated keywords introduced in title or description."""
    try:
        previous, current = _previous_current(listing_timeline)
        previous_text = f"{previous.get('title', '')} {previous.get('description', '')}".lower()
        message_prefix = "Counterfeit-associated keywords appeared: "
        empty_message = "No newly introduced counterfeit-associated keywords detected."
        baseline_review = False
    except ValueError:
        current = _current_version(listing_timeline) or {}
        previous_text = ""
        message_prefix = "Baseline listing contains counterfeit-associated keywords: "
        empty_message = "No counterfeit-associated keywords detected in baseline listing."
        baseline_review = True
    current_text = f"{current.get('title', '')} {current.get('description', '')}".lower()
    introduced = []
    for keyword in COUNTERFEIT_KEYWORDS:
        pattern = re.escape(keyword.lower())
        if re.search(pattern, current_text) and (
            baseline_review or not re.search(pattern, previous_text)
        ):
            introduced.append(keyword)
    return {
        "baseline_review": baseline_review,
        "counterfeit_keywords": introduced,
        "message": (
            message_prefix + ", ".join(introduced) + "."
            if introduced
            else empty_message
        ),
    }


def detect_image_swap(listing_timeline: str) -> dict:
    """Detects whether the listing image changed after approval."""
    try:
        previous, current = _previous_current(listing_timeline)
    except ValueError:
        current = _current_version(listing_timeline) or {}
        current_image_id = _norm(current.get("image_id"))
        return {
            "baseline_review": True,
            "image_swapped": False,
            "text_fields_unchanged": False,
            "previous_image_id": None,
            "current_image_id": current_image_id or None,
            "message": (
                f"Baseline listing image is {current_image_id}."
                if current_image_id
                else "Baseline listing has no image ID."
            ),
        }
    previous_image_id = _norm(previous.get("image_id"))
    current_image_id = _norm(current.get("image_id"))
    image_swapped = bool(previous_image_id and current_image_id and previous_image_id != current_image_id)
    text_fields_unchanged = (
        _norm(previous.get("title")).lower() == _norm(current.get("title")).lower()
        and _norm(previous.get("description")).lower() == _norm(current.get("description")).lower()
        and _norm(previous.get("brand")).lower() == _norm(current.get("brand")).lower()
        and float(previous.get("price") or 0) == float(current.get("price") or 0)
    )
    if image_swapped and text_fields_unchanged:
        message = "Listing image changed after approval while text and price stayed mostly unchanged."
    elif image_swapped:
        message = "Listing image changed after approval."
    else:
        message = "Listing image did not change."
    return {
        "baseline_review": False,
        "image_swapped": image_swapped,
        "text_fields_unchanged": text_fields_unchanged,
        "previous_image_id": previous_image_id,
        "current_image_id": current_image_id,
        "message": message,
    }


def detect_post_approval_edit(listing_timeline: str) -> dict:
    """Detects whether an approved listing was edited into a later version."""
    try:
        previous, current = _previous_current(listing_timeline)
    except ValueError:
        return {
            "baseline_review": True,
            "post_approval_edit": False,
            "previous_status": None,
            "current_status": (_current_version(listing_timeline) or {}).get("status"),
            "message": "Baseline listing creation; no post-approval edit exists yet.",
        }
    post_approval_edit = previous.get("status") == "approved" and current.get("version") != previous.get("version")
    return {
        "baseline_review": False,
        "post_approval_edit": post_approval_edit,
        "previous_status": previous.get("status"),
        "current_status": current.get("status"),
        "message": (
            "Listing was edited after approval."
            if post_approval_edit
            else "No post-approval edit detected."
        ),
    }


def build_evidence(listing_timeline: str) -> dict:
    """Combines listing change detector outputs into structured evidence."""
    brand = detect_brand_injection(listing_timeline)
    price = detect_price_anomaly(listing_timeline)
    keywords = detect_counterfeit_keywords(listing_timeline)
    image = detect_image_swap(listing_timeline)
    post_approval = detect_post_approval_edit(listing_timeline)

    evidence = []
    for result in (brand, price, keywords, image, post_approval):
        if (
            result.get("brand_injection")
            or result.get("baseline_brand_claim")
            or result.get("price_anomaly")
            or result.get("counterfeit_keywords")
            or result.get("image_swapped")
            or result.get("post_approval_edit")
        ):
            evidence.append(result["message"])

    return {
        "signals": {
            "brand_injection": brand["brand_injection"],
            "baseline_brand_claim": brand.get("baseline_brand_claim", False),
            "brand_added": brand["brand_added"],
            "price_drop_pct": price["price_drop_pct"],
            "price_anomaly": price["price_anomaly"],
            "counterfeit_keywords": keywords["counterfeit_keywords"],
            "image_swapped": image["image_swapped"],
            "text_fields_unchanged": image.get("text_fields_unchanged", False),
            "post_approval_edit": post_approval["post_approval_edit"],
        },
        "evidence": evidence,
    }
