import type {
  AdkEvent,
  AdkSession,
  AgentEvent,
  BackendCase,
  ChangedField,
  Phase2CaseFile,
  ReviewQueueRow,
} from "../types";

const ADK_BASE_URL = String(import.meta.env.VITE_ADK_BASE_URL ?? "/adk");
const ADK_APP_NAME = String(import.meta.env.VITE_ADK_APP_NAME ?? "backend");
const ADK_USER_IDS = String(import.meta.env.VITE_ADK_USER_IDS ?? "copee-demo")
  .split(",")
  .map((userId: string) => userId.trim())
  .filter(Boolean);

export async function fetchReviewQueue(): Promise<ReviewQueueRow[]> {
  const sessions = (
    await Promise.all(
      ADK_USER_IDS.map((userId) =>
        fetchJson<AdkSession[]>(sessionsUrl(userId)).catch(() => []),
      ),
    )
  ).flat();
  const details = await Promise.all(
    sessions.map((session) =>
      fetchSessionDetail(session.id, sessionUserId(session)).catch((error: unknown) =>
        buildQueueRow(session, null, error instanceof Error ? error.message : "Could not load session."),
      ),
    ),
  );
  return details.sort((a, b) => b.last_update_time - a.last_update_time);
}

export async function fetchSessionDetail(sessionId: string, userId = ADK_USER_IDS[0]): Promise<ReviewQueueRow> {
  const session = await fetchJson<AdkSession>(
    `${sessionsUrl(userId)}/${sessionId}`,
  );
  return buildQueueRow(session);
}

function sessionsUrl(userId: string) {
  return `${ADK_BASE_URL}/apps/${ADK_APP_NAME}/users/${userId}/sessions`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

function buildQueueRow(session: AdkSession, providedCaseFile: Phase2CaseFile | null = null, loadError?: string): ReviewQueueRow {
  const events = session.events ?? [];
  const caseFile = providedCaseFile ?? extractCaseFile(events);
  const sourceCase = extractSourceCase(events);
  const listingId =
    caseFile?.listing_id ??
    sourceCase?.listing_id ??
    listingIdFromSessionState(session.state) ??
    listingIdFromSessionId(session.id) ??
    "UNKNOWN";
  const changedFields = caseFile?.timeline_diff?.changed_fields ?? [];
  const status = loadError ? "error" : caseFile ? "completed" : events.length ? "running" : "empty";

  return {
    session,
    sessionId: session.id,
    userId: sessionUserId(session),
    listing_id: listingId,
    last_update_time: session.lastUpdateTime ?? session.last_update_time ?? 0,
    status,
    caseFile,
    sourceCase,
    events: normalizeEvents(events, loadError),
    risk_level: caseFile?.lead_decision?.risk_level ?? "PENDING",
    final_risk_score: caseFile?.lead_decision?.final_risk_score ?? null,
    recommended_action: caseFile?.lead_decision?.recommended_action ?? "PENDING_AGENT_ASSESSMENT",
    changed_fields: changedFields,
    signal_tags: signalTags(caseFile),
  };
}

function extractCaseFile(events: AdkEvent[]): Phase2CaseFile | null {
  for (const event of [...events].reverse()) {
    if (event.author !== "TrustPatrolRootAgent" || event.partial) continue;
    const output = event.output;
    if (isCaseFile(output)) return output;
    const text = event.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    const parsed = parseJsonObject(text);
    if (isCaseFile(parsed)) return parsed;
  }
  return null;
}

function extractSourceCase(events: AdkEvent[]): BackendCase | null {
  for (const event of events) {
    if (event.author !== "user") continue;
    const text = event.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    const timeline = parseTimelineObjects(text);
    if (timeline.length > 0) {
      const latest = timeline[timeline.length - 1];
      return {
        listing_id: String(latest.listing_id ?? "UNKNOWN"),
        timeline,
      };
    }

    const parsed = parseJsonObject(text);
    if (isBackendCase(parsed)) return normalizeBackendCase(parsed);
  }
  return null;
}

function parseJsonObject(text: string): unknown {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    if (start < 0) return null;
    for (let end = text.length; end > start; end -= 1) {
      try {
        return JSON.parse(text.slice(start, end));
      } catch {
        continue;
      }
    }
  }
  return null;
}

function parseTimelineObjects(text: string): NonNullable<BackendCase["timeline"]> {
  const objects: NonNullable<BackendCase["timeline"]> = [];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== "{") continue;
    for (let end = index + 1; end <= text.length; end += 1) {
      if (text[end - 1] !== "}") continue;
      try {
        const value = JSON.parse(text.slice(index, end));
        if (isListingVersion(value)) {
          objects.push(value);
          index = end - 1;
        }
        break;
      } catch {
        continue;
      }
    }
  }
  return objects.sort((a, b) => a.version - b.version);
}

function normalizeBackendCase(value: BackendCase): BackendCase {
  return {
    ...value,
    timeline: value.timeline ?? value.versions ?? [],
  };
}

function isCaseFile(value: unknown): value is Phase2CaseFile {
  return (
    isRecord(value) &&
    typeof value.listing_id === "string" &&
    isRecord(value.timeline_diff) &&
    isRecord(value.lead_decision) &&
    Array.isArray(value.specialist_findings) &&
    isRecord(value.enforcement_action_log)
  );
}

function isBackendCase(value: unknown): value is BackendCase {
  return isRecord(value) && (Array.isArray(value.timeline) || Array.isArray(value.versions) || typeof value.listing_id === "string");
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isListingVersion(value: unknown): value is NonNullable<BackendCase["timeline"]>[number] {
  return isRecord(value) && typeof value.version === "number";
}

function listingIdFromSessionState(state: AdkSession["state"]): string | null {
  if (!state) return null;
  for (const key of ["listing_id", "listingId", "session:listing_id", "litmus_case"]) {
    const value = state[key];
    if (typeof value === "string" && value.startsWith("L-")) return value;
  }
  return null;
}

function listingIdFromSessionId(sessionId: string): string | null {
  const invMatch = sessionId.match(/^inv-(.+)-v\d+$/);
  if (invMatch?.[1]) return invMatch[1];
  const listingMatch = sessionId.match(/(L-[A-Z0-9-]+)/);
  return listingMatch?.[1] ?? null;
}

function sessionUserId(session: AdkSession): string {
  return session.userId ?? session.user_id ?? ADK_USER_IDS[0] ?? "copee-demo";
}

function normalizeEvents(events: AdkEvent[], loadError?: string): AgentEvent[] {
  const normalized: AgentEvent[] = events.map((event, index) => {
    const author = event.author ?? "TrustPatrolRootAgent";
    const text = event.content?.parts?.map((part) => part.text ?? "").join(" ").trim();
    const isFinal = author === "TrustPatrolRootAgent" && !event.partial && isCaseFile(extractEventPayload(event));

    return {
      id: event.id ?? `adk-${index}`,
      timestamp: formatTimestamp(event.timestamp),
      type: isFinal ? "final_recommendation" : event.partial ? "agent_started" : "agent_completed",
      agent: author as AgentEvent["agent"],
      title: event.partial ? author : `${author} event`,
      message: text || summarizePayload(extractEventPayload(event)),
      payload: event,
    } satisfies AgentEvent;
  });

  if (loadError) {
    normalized.push({
      id: "session-load-error",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      type: "agent_completed",
      title: "Session load failed",
      message: loadError,
    });
  }
  return normalized;
}

function extractEventPayload(event: AdkEvent): unknown {
  if (event.output) return event.output;
  const text = event.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  return parseJsonObject(text);
}

function summarizePayload(payload: unknown): string {
  if (!payload) return "";
  return JSON.stringify(payload).slice(0, 220);
}

function formatTimestamp(value?: number): string {
  if (!value) return "";
  const milliseconds = value > 10_000_000_000 ? value : value * 1000;
  return new Date(milliseconds).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function signalTags(caseFile: Phase2CaseFile | null): string[] {
  const signals = caseFile?.timeline_diff?.signals;
  if (!signals) return [];
  const tags: string[] = [];
  if (signals.brand_added) tags.push("brand");
  if ((signals.price_drop_pct ?? 0) > 0) tags.push("price");
  if (signals.image_swapped) tags.push("image");
  if ((signals.counterfeit_keywords ?? []).length > 0) tags.push("keywords");
  if (signals.post_approval_edit) tags.push("post approval");
  if ((signals.seller_prior_flags ?? 0) > 0 || (signals.seller_age_days ?? 9999) < 30) tags.push("seller");
  if (signals.review_burst_detected || (signals.generic_review_ratio ?? 0) >= 0.5) tags.push("review");
  return tags;
}
