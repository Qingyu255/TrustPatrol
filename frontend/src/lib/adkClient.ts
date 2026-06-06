import { formatListingPrompt } from "./mockListings";
import type { AgentEvent, DemoScenario } from "../types";

const ADK_BASE_URL = "http://127.0.0.1:8001";

type RunOptions = {
  userId?: string;
  sessionId?: string;
  onEvent: (event: AgentEvent) => void;
};

function normalizeAdkEvent(raw: unknown, index: number): AgentEvent {
  const value = raw as Record<string, unknown>;
  const author = String(value.author || value.agent || "TrustPatrolRootAgent");
  const isAssessment = author.includes("Assessment");
  const isInvestigation = author.includes("Investigation");
  const agent = isAssessment
    ? "AssessmentAgent"
    : isInvestigation
      ? "InvestigationAgent"
      : "TrustPatrolRootAgent";

  return {
    id: `adk-${index}`,
    timestamp: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    type: "agent_completed",
    agent,
    title: `${agent} event`,
    message: JSON.stringify(raw).slice(0, 220),
    payload: raw,
  };
}

export async function runTrustPatrolLive(scenario: DemoScenario, options: RunOptions) {
  const userId = options.userId ?? "frontend-demo";
  const sessionId = options.sessionId ?? `trustpatrol-${scenario.id}-${Date.now()}`;

  await fetch(`${ADK_BASE_URL}/apps/backend/users/${userId}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  });

  const response = await fetch(`${ADK_BASE_URL}/run_sse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_name: "backend",
      user_id: userId,
      session_id: sessionId,
      streaming: true,
      new_message: {
        role: "user",
        parts: [{ text: formatListingPrompt(scenario) }],
      },
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`ADK SSE request failed with status ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let index = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const dataLine = chunk
        .split("\n")
        .find((line) => line.startsWith("data:"));
      if (!dataLine) continue;

      const data = dataLine.replace(/^data:\s*/, "");
      if (!data || data === "[DONE]") continue;

      try {
        options.onEvent(normalizeAdkEvent(JSON.parse(data), index));
        index += 1;
      } catch {
        options.onEvent({
          id: `adk-text-${index}`,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
          type: "agent_completed",
          agent: "TrustPatrolRootAgent",
          title: "ADK stream event",
          message: data.slice(0, 220),
        });
        index += 1;
      }
    }
  }
}
