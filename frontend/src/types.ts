export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "PENDING";

export type ReviewDecision =
  | "Approve Suppression"
  | "Request Seller Verification"
  | "Override to Allow"
  | "Escalate"
  | "Mark False Positive";

export type ListingVersion = {
  listing_id?: string;
  seller_id?: string;
  version: number;
  status?: string;
  title?: string;
  description?: string;
  brand?: string | null;
  price?: number;
  image_id?: string;
  created_at?: string;
  updated_at?: string;
};

export type ChangedField = "brand" | "price" | "image" | "text" | "keywords" | "status";

export type AgentName =
  | "TrustPatrolRootAgent"
  | "TimelineDiffAgent"
  | "InvestigationRouterAgent"
  | "BrandProtectionAgent"
  | "PricingAgent"
  | "VisualEvidenceAgent"
  | "SellerTrustAgent"
  | "ReviewIntegrityAgent"
  | "LeadAdjudicatorAgent"
  | "EnforcementActionAgent";

export type AgentEventType =
  | "agent_started"
  | "tool_call_started"
  | "tool_call_completed"
  | "report_generated"
  | "agent_completed"
  | "final_recommendation"
  | "human_review_decision";

export type AgentEvent = {
  id: string;
  timestamp: string;
  type: AgentEventType;
  agent?: AgentName;
  tool_name?: string;
  title: string;
  message?: string;
  payload?: unknown;
};

export type AdkPart = {
  text?: string;
  functionCall?: unknown;
  functionResponse?: unknown;
};

export type AdkEvent = {
  id?: string;
  author?: string;
  partial?: boolean;
  timestamp?: number;
  content?: {
    role?: string;
    parts?: AdkPart[];
  };
  output?: unknown;
  actions?: {
    stateDelta?: Record<string, unknown>;
  };
};

export type AdkSession = {
  id: string;
  appName?: string;
  app_name?: string;
  userId?: string;
  user_id?: string;
  state?: Record<string, unknown>;
  events?: AdkEvent[];
  lastUpdateTime?: number;
  last_update_time?: number;
};

export type TimelineSignals = {
  brand_added?: boolean;
  brand_added_value?: string | null;
  previous_brand?: string | null;
  current_brand?: string | null;
  price_drop_pct?: number;
  previous_price?: number;
  current_price?: number;
  counterfeit_keywords?: string[];
  image_swapped?: boolean;
  text_fields_unchanged?: boolean;
  post_approval_edit?: boolean;
  seller_prior_flags?: number;
  seller_age_days?: number;
  similar_listing_count_24h?: number;
  review_burst_detected?: boolean;
  generic_review_ratio?: number;
  image_contains_brand_logo?: boolean;
  image_contains_packaging?: boolean;
  image_category?: string | null;
};

export type TimelineDiff = {
  agent: "TimelineDiffAgent";
  status: string;
  listing_id?: string;
  changed_fields: ChangedField[];
  signals: TimelineSignals;
  summary: string;
};

export type RouterPlan = {
  agent: "InvestigationRouterAgent";
  agents_to_invoke: AgentName[];
  agents_skipped?: Array<{ agent: AgentName; reason: string }>;
  routing_reason: string;
  minimum_evidence_required: number;
  case_priority: string;
  selection_reasons?: Record<string, string>;
  llm_router_analysis?: unknown;
};

export type SpecialistFinding = {
  agent: AgentName;
  status: string;
  risk_level: RiskLevel;
  risk_contribution: number;
  confidence: number;
  finding: string;
  evidence: string[];
  uncertainty: string;
  recommended_next_step: string;
  llm_analysis?: unknown;
};

export type LeadDecision = {
  agent: "LeadAdjudicatorAgent";
  status: string;
  final_risk_score: number;
  risk_level: RiskLevel;
  confidence: number;
  recommended_action: string;
  policy_buckets: string[];
  top_evidence: string[];
  agent_consensus: {
    strong_support?: AgentName[];
    moderate_support?: AgentName[];
    weak_or_uncertain?: AgentName[];
    disagree?: AgentName[];
  };
  decision_reasoning: string[];
  human_review_required: boolean;
};

export type EnforcementActionLog = {
  agent: "EnforcementActionAgent";
  status: string;
  actions: Array<{ action: string; status: string; reason?: string }>;
  review_queue: string;
  seller_message_summary: string;
  audit_log_summary: string;
};

export type Phase2CaseFile = {
  listing_id: string;
  timeline_diff: TimelineDiff;
  router_plan: RouterPlan;
  specialist_findings: SpecialistFinding[];
  lead_decision: LeadDecision;
  enforcement_action_log: EnforcementActionLog;
  human_reviewer_decision?: unknown;
};

export type BackendCase = {
  listing_id?: string;
  name?: string;
  timeline?: ListingVersion[];
  versions?: ListingVersion[];
  seller_profile?: Record<string, unknown>;
  review_profile?: Record<string, unknown>;
  image_metadata?: Record<string, unknown>;
};

export type ReviewQueueRow = {
  session: AdkSession;
  sessionId: string;
  userId: string;
  listing_id: string;
  last_update_time: number;
  status: "completed" | "running" | "empty" | "error";
  caseFile: Phase2CaseFile | null;
  sourceCase: BackendCase | null;
  events: AgentEvent[];
  risk_level: RiskLevel;
  final_risk_score: number | null;
  recommended_action: string;
  changed_fields: ChangedField[];
  signal_tags: string[];
};
