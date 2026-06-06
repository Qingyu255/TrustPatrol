from __future__ import annotations

from datetime import date
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class ListingStatus(StrEnum):
    draft = "draft"
    approved = "approved"
    suppressed = "suppressed"


class ListingVersion(BaseModel):
    listing_id: str
    version: int
    status: ListingStatus = ListingStatus.approved
    title: str
    description: str
    brand: str | None = None
    price: float = Field(ge=0)
    image_id: str
    seller_id: str


class ListingCreate(BaseModel):
    listing_id: str | None = None
    status: ListingStatus = ListingStatus.approved
    title: str
    description: str
    brand: str | None = None
    price: float = Field(ge=0)
    image_id: str
    seller_id: str = "S-DEMO-SELLER"


class ListingPatch(BaseModel):
    status: ListingStatus | None = None
    title: str | None = None
    description: str | None = None
    brand: str | None = None
    price: float | None = Field(default=None, ge=0)
    image_id: str | None = None
    seller_id: str | None = None


class SellerProfile(BaseModel):
    seller_id: str = "S-DEMO-SELLER"
    shop_name: str
    username: str
    avatar_url: str
    cover_url: str
    description: str
    pickup_address: str
    phone: str
    email: str
    joined: str
    rating: float = Field(ge=0, le=5)
    response_rate: int = Field(ge=0, le=100)
    followers: int = Field(ge=0)


class SellerProfilePatch(BaseModel):
    shop_name: str | None = None
    username: str | None = None
    avatar_url: str | None = None
    cover_url: str | None = None
    description: str | None = None
    pickup_address: str | None = None
    phone: str | None = None
    email: str | None = None


class Listing(BaseModel):
    listing_id: str
    versions: list[ListingVersion]

    @property
    def current(self) -> ListingVersion:
        return self.versions[-1]


class InvestigationStatus(StrEnum):
    running = "running"
    completed = "completed"
    failed = "failed"


class InvestigationSummary(BaseModel):
    investigation_id: str
    listing_id: str
    version: int
    review_type: str
    status: InvestigationStatus
    stream_url: str


class ListingMutationResponse(BaseModel):
    listing: Listing
    current_version: ListingVersion
    investigation_triggered: bool
    investigation_id: str
    review_type: str


class AdkSessionRequest(BaseModel):
    session_id: str


class ListingImageUpload(BaseModel):
    file_name: str
    content_type: str
    data_url: str


class ListingImageUploadResponse(BaseModel):
    image_id: str
    image_url: str


def listing_timeline_payload(listing: Listing) -> dict[str, Any]:
    review_versions = listing.versions[-2:]
    return {
        "listing_id": listing.listing_id,
        "versions": [version.model_dump(mode="json") for version in review_versions],
    }


def investigation_case_payload(listing: Listing, seller_profile: SellerProfile) -> dict[str, Any]:
    review_versions = listing.versions[-2:]
    previous = review_versions[0] if len(review_versions) > 1 else None
    current = review_versions[-1]
    current_image_id = current.image_id.lower()
    seller_age_days = _seller_age_days(seller_profile.joined)
    suspicious_text = f"{current.title} {current.description}".lower()
    counterfeit_terms = ("1:1", "aaa", "mirror", "factory", "oem", "replica")
    has_counterfeit_terms = any(term in suspicious_text for term in counterfeit_terms)

    return {
        "listing_id": listing.listing_id,
        "name": f"Copee listing investigation {listing.listing_id}",
        "timeline": [version.model_dump(mode="json") for version in review_versions],
        "seller_profile": {
            "seller_id": current.seller_id,
            "seller_age_days": seller_age_days,
            "prior_flags": 1 if has_counterfeit_terms else 0,
            "similar_listing_count_24h": 6 if has_counterfeit_terms else 1,
        },
        "review_profile": {
            "avg_rating": seller_profile.rating,
            "review_count": max(seller_profile.followers // 250, 1),
            "generic_review_ratio": 0.62 if has_counterfeit_terms else 0.16,
            "review_burst_detected": has_counterfeit_terms,
        },
        "image_metadata": {
            "previous_image_id": previous.image_id if previous else None,
            "current_image_id": current.image_id,
            "image_changed": bool(previous and previous.image_id != current.image_id),
            "contains_brand_logo": _image_contains_brand_logo(current.image_id, current.brand),
            "contains_packaging": _image_contains_packaging(current.image_id),
            "image_category": _image_category(current.image_id),
        },
    }


def _seller_age_days(joined: str) -> int:
    try:
        joined_date = date.fromisoformat(joined)
    except ValueError:
        return 0
    return max((date.today() - joined_date).days, 0)


def _image_contains_brand_logo(image_id: str, brand: str | None) -> bool:
    text = image_id.lower()
    if brand and brand.lower() in text:
        return True
    return any(token in text for token in ("brand", "branded", "logo", "apple", "luxury", "designer"))


def _image_contains_packaging(image_id: str) -> bool:
    return any(token in image_id.lower() for token in ("box", "packaging", "package", "sealed"))


def _image_category(image_id: str) -> str:
    return image_id.lower().replace("-", "_")
