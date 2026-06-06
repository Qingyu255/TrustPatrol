from __future__ import annotations

import asyncio
import base64
import binascii
import json
import os
from collections.abc import AsyncIterator
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

from .adk_client import AdkClient, format_investigation_prompt
from .models import (
    InvestigationStatus,
    Listing,
    ListingCreate,
    ListingImageUpload,
    ListingImageUploadResponse,
    ListingMutationResponse,
    ListingPatch,
    SellerProfile,
    SellerProfilePatch,
    investigation_case_payload,
)
from .store import InMemoryStore, InvestigationRecord

DEMO_USER_ID = "copee-demo"


def create_app(
    *,
    store: InMemoryStore | None = None,
    adk_client: AdkClient | None = None,
    upload_dir: Path | None = None,
) -> FastAPI:
    app = FastAPI(title="Copee Demo Marketplace Backend")
    app.state.store = store or InMemoryStore()
    app.state.adk_client = adk_client or AdkClient(
        os.getenv("ADK_BASE_URL", "http://127.0.0.1:8001"),
        os.getenv("ADK_APP_NAME", "backend"),
    )
    app.state.upload_dir = upload_dir or Path(__file__).resolve().parents[1] / "uploaded-images"
    app.state.upload_dir.mkdir(parents=True, exist_ok=True)

    cors_origins = {
        origin.strip()
        for origin in ",".join(
            [
                os.getenv("ALLOW_CORS_ORIGINS", ""),
                os.getenv("COPEE_CORS_ORIGINS", ""),
                os.getenv("SHOPEE_CORS_ORIGINS", ""),
            ]
        ).split(",")
        if origin.strip()
    }
    cors_origins.update(
        {
            "http://127.0.0.1:5173",
            "http://localhost:5173",
            "http://127.0.0.1:5174",
            "http://localhost:5174",
        }
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=sorted(cors_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "service": "backend-copee"}

    @app.get("/listings", response_model=list[Listing])
    async def list_listings() -> list[Listing]:
        return await app.state.store.list_listings()

    @app.get("/seller/profile", response_model=SellerProfile)
    async def get_profile() -> SellerProfile:
        return await app.state.store.get_profile()

    @app.patch("/seller/profile", response_model=SellerProfile)
    async def patch_profile(payload: SellerProfilePatch) -> SellerProfile:
        return await app.state.store.patch_profile(payload)

    @app.post("/listing-images", response_model=ListingImageUploadResponse)
    async def upload_listing_image(payload: ListingImageUpload) -> ListingImageUploadResponse:
        if not payload.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="Only image uploads are supported")
        try:
            _, encoded = payload.data_url.split(",", 1)
            image_bytes = base64.b64decode(encoded, validate=True)
        except (ValueError, binascii.Error) as error:
            raise HTTPException(status_code=400, detail="Invalid image data") from error
        if not image_bytes:
            raise HTTPException(status_code=400, detail="Image data is empty")
        suffix = _upload_suffix(payload.file_name, payload.content_type)
        image_id = f"uploaded_{uuid4().hex}{suffix}"
        target = app.state.upload_dir / image_id
        target.write_bytes(image_bytes)
        return ListingImageUploadResponse(
            image_id=image_id,
            image_url=f"/listing-images/{image_id}",
        )

    @app.get("/listing-images/{image_id}")
    async def get_listing_image(image_id: str) -> FileResponse:
        if "/" in image_id or "\\" in image_id:
            raise HTTPException(status_code=400, detail="Invalid image id")
        target = app.state.upload_dir / image_id
        if not target.exists():
            raise HTTPException(status_code=404, detail="Image not found")
        return FileResponse(target)

    @app.get("/listings/{listing_id}", response_model=Listing)
    async def get_listing(listing_id: str) -> Listing:
        listing = await app.state.store.get_listing(listing_id)
        if not listing:
            raise HTTPException(status_code=404, detail="Listing not found")
        return listing

    @app.post("/listings", response_model=ListingMutationResponse)
    async def create_listing(payload: ListingCreate) -> ListingMutationResponse:
        listing = await app.state.store.create_listing(payload)
        if not listing:
            raise HTTPException(status_code=409, detail="Listing already exists")
        return await _trigger_investigation(app, listing)

    @app.patch("/listings/{listing_id}", response_model=ListingMutationResponse)
    async def patch_listing(listing_id: str, payload: ListingPatch) -> ListingMutationResponse:
        listing = await app.state.store.patch_listing(listing_id, payload)
        if not listing:
            raise HTTPException(status_code=404, detail="Listing not found")
        return await _trigger_investigation(app, listing)

    @app.get("/investigations/{investigation_id}/stream")
    async def stream_investigation(investigation_id: str) -> StreamingResponse:
        record = await app.state.store.get_investigation(investigation_id)
        if not record:
            raise HTTPException(status_code=404, detail="Investigation not found")
        return StreamingResponse(
            _investigation_event_stream(record),
            media_type="text/event-stream",
        )

    return app


def _upload_suffix(file_name: str, content_type: str) -> str:
    original_suffix = Path(file_name).suffix.lower()
    if original_suffix in {".jpg", ".jpeg", ".png", ".gif", ".webp"}:
        return original_suffix
    return {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/gif": ".gif",
        "image/webp": ".webp",
    }.get(content_type, ".img")


async def _trigger_investigation(app: FastAPI, listing: Listing) -> ListingMutationResponse:
    current = listing.current
    review_type = "baseline_review" if len(listing.versions) == 1 else "post_approval_edit"
    investigation_id = f"inv-{listing.listing_id}-v{current.version}"
    seller_profile = await app.state.store.get_profile()
    case = investigation_case_payload(listing, seller_profile)
    message_text = format_investigation_prompt(case, review_type)
    record = InvestigationRecord(
        investigation_id=investigation_id,
        listing_id=listing.listing_id,
        version=current.version,
        review_type=review_type,
        message_text=message_text,
    )
    await app.state.store.add_investigation(record)
    asyncio.create_task(_run_adk_investigation(app, record))
    return ListingMutationResponse(
        listing=listing,
        current_version=current,
        investigation_triggered=True,
        investigation_id=investigation_id,
        review_type=review_type,
    )


async def _run_adk_investigation(app: FastAPI, record: InvestigationRecord) -> None:
    try:
        adk_session_id = await app.state.adk_client.create_session(DEMO_USER_ID, record.investigation_id)
        async for event in app.state.adk_client.stream_run(
            user_id=DEMO_USER_ID,
            session_id=adk_session_id or record.investigation_id,
            message_text=record.message_text,
        ):
            await app.state.store.append_event(record.investigation_id, event)
        await app.state.store.mark_investigation_done(record.investigation_id)
    except Exception as error:
        error_event = f"data: {json.dumps({'error': str(error)})}\n\n"
        await app.state.store.append_event(record.investigation_id, error_event)
        await app.state.store.mark_investigation_done(
            record.investigation_id,
            InvestigationStatus.failed,
        )


async def _investigation_event_stream(record: InvestigationRecord) -> AsyncIterator[str]:
    index = 0
    while True:
        while index < len(record.events):
            yield record.events[index]
            index += 1
        if record.status != InvestigationStatus.running:
            break
        await record.changed.wait()


app = create_app()
