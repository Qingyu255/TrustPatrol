from __future__ import annotations

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


def listing_timeline_payload(listing: Listing) -> dict[str, Any]:
    review_versions = listing.versions[-2:]
    return {
        "listing_id": listing.listing_id,
        "versions": [version.model_dump(mode="json") for version in review_versions],
    }
