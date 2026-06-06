from __future__ import annotations

import asyncio
import json
import sys
import unittest
from collections.abc import AsyncIterator
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.append(str(Path(__file__).resolve().parents[1]))

from shopee_backend.main import create_app  # noqa: E402
from shopee_backend.store import InMemoryStore  # noqa: E402


class FakeAdkClient:
    def __init__(self) -> None:
        self.sessions: list[tuple[str, str]] = []
        self.runs: list[tuple[str, str, str]] = []

    async def create_session(self, user_id: str, session_id: str) -> None:
        self.sessions.append((user_id, session_id))

    async def stream_run(
        self,
        *,
        user_id: str,
        session_id: str,
        message_text: str,
    ) -> AsyncIterator[str]:
        self.runs.append((user_id, session_id, message_text))
        yield 'data: {"content":{"parts":[{"functionCall":{"name":"detect_brand_injection","args":{}}}]}}\n\n'
        yield 'data: {"content":{"parts":[{"functionResponse":{"name":"detect_brand_injection","response":{}}}]}}\n\n'


class CopeeApiTest(unittest.TestCase):
    def setUp(self) -> None:
        self.adk = FakeAdkClient()
        self.app = create_app(store=InMemoryStore(), adk_client=self.adk)
        self.client = TestClient(self.app)

    def test_create_listing_triggers_investigation(self) -> None:
        response = self.client.post(
            "/listings",
            json={
                "listing_id": "L-NEW-001",
                "title": "Canvas Tote Bag",
                "description": "New tote.",
                "price": 10,
                "image_id": "tote_01",
                "seller_id": "S-DEMO",
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["current_version"]["version"], 1)
        self.assertTrue(body["investigation_triggered"])
        self.assertEqual(body["review_type"], "baseline_review")
        self.assertEqual(body["investigation_id"], "inv-L-NEW-001-v1")
        self.assertEqual(len(self._timeline_versions_from_last_run()), 1)

    def test_patch_listing_appends_version_and_triggers_investigation(self) -> None:
        response = self.client.patch(
            "/listings/L-BRAND-001",
            json={
                "title": "Apple AirPods Pro OEM 1:1 Authentic",
                "description": "Factory batch, same production line, mirror quality.",
                "brand": "Apple",
                "price": 12,
                "image_id": "airpods_branded_box_01",
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["current_version"]["version"], 2)
        self.assertEqual(body["review_type"], "post_approval_edit")
        self.assertEqual(body["investigation_id"], "inv-L-BRAND-001-v2")
        versions = self._timeline_versions_from_last_run()
        self.assertEqual([version["version"] for version in versions], [1, 2])

    def test_patch_missing_listing_returns_404(self) -> None:
        response = self.client.patch("/listings/MISSING", json={"price": 99})
        self.assertEqual(response.status_code, 404)

    def test_stream_replays_adk_events(self) -> None:
        create_response = self.client.post(
            "/listings",
            json={
                "listing_id": "L-STREAM-001",
                "title": "Demo Item",
                "description": "Demo.",
                "price": 15,
                "image_id": "demo_01",
            },
        )
        investigation_id = create_response.json()["investigation_id"]
        asyncio.run(asyncio.sleep(0.05))

        with self.client.stream("GET", f"/investigations/{investigation_id}/stream") as response:
            payload = "".join(response.iter_text())

        self.assertEqual(response.status_code, 200)
        self.assertIn("functionCall", payload)
        self.assertIn("functionResponse", payload)

    def test_profile_can_be_edited(self) -> None:
        response = self.client.patch(
            "/seller/profile",
            json={
                "shop_name": "Copee Demo Outlet",
                "description": "Updated seller profile for demo.",
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["shop_name"], "Copee Demo Outlet")
        self.assertEqual(body["description"], "Updated seller profile for demo.")

    def test_investigation_payload_only_includes_previous_and_latest_versions(self) -> None:
        self.client.patch("/listings/L-SAFE-001", json={"title": "Uniqlo Shirt Updated Once"})
        self.client.patch("/listings/L-SAFE-001", json={"title": "Uniqlo Shirt Updated Twice"})

        versions = self._timeline_versions_from_last_run()

        self.assertEqual(len(versions), 2)
        self.assertEqual([version["version"] for version in versions], [2, 3])
        self.assertEqual(versions[-1]["title"], "Uniqlo Shirt Updated Twice")

    def _timeline_versions_from_last_run(self) -> list[dict]:
        self.assertTrue(self.adk.runs)
        message_text = self.adk.runs[-1][2]
        timeline_text = message_text.split("Timeline:\n", 1)[1]
        return [json.loads(line) for line in timeline_text.splitlines() if line.strip()]


if __name__ == "__main__":
    unittest.main()
