from __future__ import annotations

import asyncio
import copy
from dataclasses import dataclass, field
from uuid import uuid4

from .demo_data import SEED_LISTINGS, SELLER_PROFILE
from .models import (
    InvestigationStatus,
    Listing,
    ListingCreate,
    ListingPatch,
    ListingVersion,
    SellerProfile,
    SellerProfilePatch,
)


@dataclass
class InvestigationRecord:
    investigation_id: str
    listing_id: str
    version: int
    review_type: str
    message_text: str
    status: InvestigationStatus = InvestigationStatus.running
    events: list[str] = field(default_factory=list)
    changed: asyncio.Event = field(default_factory=asyncio.Event)


class InMemoryStore:
    def __init__(self) -> None:
        self._listings: dict[str, Listing] = copy.deepcopy(SEED_LISTINGS)
        self._seller_profile: SellerProfile = copy.deepcopy(SELLER_PROFILE)
        self._investigations: dict[str, InvestigationRecord] = {}
        self._lock = asyncio.Lock()

    async def list_listings(self) -> list[Listing]:
        async with self._lock:
            return copy.deepcopy(list(self._listings.values()))

    async def get_listing(self, listing_id: str) -> Listing | None:
        async with self._lock:
            listing = self._listings.get(listing_id)
            return copy.deepcopy(listing) if listing else None

    async def get_profile(self) -> SellerProfile:
        async with self._lock:
            return copy.deepcopy(self._seller_profile)

    async def patch_profile(self, payload: SellerProfilePatch) -> SellerProfile:
        async with self._lock:
            data = self._seller_profile.model_dump()
            data.update(payload.model_dump(exclude_unset=True))
            self._seller_profile = SellerProfile(**data)
            return copy.deepcopy(self._seller_profile)

    async def create_listing(self, payload: ListingCreate) -> Listing | None:
        async with self._lock:
            listing_id = payload.listing_id or f"L-DEMO-{uuid4().hex[:8].upper()}"
            if listing_id in self._listings:
                return None
            version = ListingVersion(
                listing_id=listing_id,
                version=1,
                status=payload.status,
                title=payload.title,
                description=payload.description,
                brand=payload.brand,
                price=payload.price,
                image_id=payload.image_id,
                seller_id=payload.seller_id,
            )
            listing = Listing(listing_id=listing_id, versions=[version])
            self._listings[listing_id] = listing
            return copy.deepcopy(listing)

    async def patch_listing(self, listing_id: str, payload: ListingPatch) -> Listing | None:
        async with self._lock:
            existing = self._listings.get(listing_id)
            if not existing:
                return None
            current = existing.current
            data = current.model_dump()
            patch = payload.model_dump(exclude_unset=True)
            data.update(patch)
            data["version"] = current.version + 1
            next_version = ListingVersion(**data)
            existing.versions.append(next_version)
            return copy.deepcopy(existing)

    async def add_investigation(self, record: InvestigationRecord) -> None:
        async with self._lock:
            self._investigations[record.investigation_id] = record

    async def get_investigation(self, investigation_id: str) -> InvestigationRecord | None:
        async with self._lock:
            return self._investigations.get(investigation_id)

    async def append_event(self, investigation_id: str, event: str) -> None:
        record = await self.get_investigation(investigation_id)
        if not record:
            return
        record.events.append(event)
        record.changed.set()
        record.changed = asyncio.Event()

    async def mark_investigation_done(
        self,
        investigation_id: str,
        status: InvestigationStatus = InvestigationStatus.completed,
    ) -> None:
        record = await self.get_investigation(investigation_id)
        if not record:
            return
        record.status = status
        record.changed.set()
