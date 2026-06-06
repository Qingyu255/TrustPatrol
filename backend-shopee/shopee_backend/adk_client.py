from __future__ import annotations

import json
from collections.abc import AsyncIterator

import httpx


class AdkClient:
    def __init__(self, base_url: str, timeout_seconds: float = 60.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = httpx.Timeout(timeout_seconds, connect=10.0)

    async def create_session(self, user_id: str, session_id: str) -> None:
        url = f"{self.base_url}/apps/backend/users/{user_id}/sessions"
        payload = {"session_id": session_id}
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(url, json=payload)
            if response.status_code in {200, 201, 409}:
                return
            response.raise_for_status()

    async def stream_run(
        self,
        *,
        user_id: str,
        session_id: str,
        message_text: str,
    ) -> AsyncIterator[str]:
        payload = {
            "app_name": "backend",
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


def format_investigation_prompt(timeline: dict, review_type: str) -> str:
    versions = "\n".join(json.dumps(version) for version in timeline["versions"])
    return (
        "Investigate this listing timeline and return structured JSON.\n\n"
        f"Review type: {review_type}\n\n"
        "Timeline:\n"
        f"{versions}"
    )

