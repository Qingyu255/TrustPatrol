from __future__ import annotations

import json
from collections.abc import AsyncIterator

import httpx


class AdkClient:
    def __init__(self, base_url: str, app_name: str = "backend", timeout_seconds: float = 60.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.app_name = app_name
        self.timeout = httpx.Timeout(timeout_seconds, connect=10.0)

    async def create_session(self, user_id: str, session_id: str) -> str:
        url = f"{self.base_url}/apps/{self.app_name}/users/{user_id}/sessions"
        payload = {"state": {"investigation_id": session_id}}
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(url, json=payload)
            if response.status_code == 409:
                return session_id
            response.raise_for_status()
            data = response.json()
            if isinstance(data, dict) and data.get("id"):
                return data["id"]
            return session_id

    async def stream_run(
        self,
        *,
        user_id: str,
        session_id: str,
        message_text: str,
    ) -> AsyncIterator[str]:
        payload = {
            "app_name": self.app_name,
            "user_id": user_id,
            "session_id": session_id,
            "streaming": True,
            "new_message": {
                "role": "user",
                "parts": [{"text": message_text}],
            },
        }
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream("POST", f"{self.base_url}/run_sse", json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    if line.startswith("data:"):
                        yield f"{line}\n\n"


def format_investigation_prompt(case: dict, review_type: str) -> str:
    return (
        "Run TrustPatrol Phase 2 investigation.\n\n"
        "You are given a marketplace listing case with:\n"
        "- listing timeline\n"
        "- seller profile\n"
        "- review profile\n"
        "- image metadata\n\n"
        "Tasks:\n"
        "1. Compute structured signals.\n"
        "2. Route to the appropriate specialist agents.\n"
        "3. Explain which agents are invoked and skipped.\n"
        "4. Run selected specialist agents.\n"
        "5. Produce a LeadAdjudicator decision.\n"
        "6. Produce an EnforcementActionAgent action log.\n"
        "7. Return structured JSON only.\n\n"
        f"Review type: {review_type}\n\n"
        "Case:\n"
        f"{json.dumps(case)}"
    )
