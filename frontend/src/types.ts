export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "PENDING";

export type ReviewDecision =
  | "Approve AI Action"
  | "Override To Allow"
  | "Request Verification"
  | "Escalate To Investigator"
  | "Mark False Positive";

export type ListingVersion = {
  listing_id: string;
  seller_id: string;
  version: number;
  status: string;
  title: string;
  description: string;
  brand: string | null;
  price: number;
  image_id: string;
  created_at?: string;
  updated_at?: string;
};

export type MarketplaceCategory = "Electronics" | "Bags & Luxury" | "Fashion" | "Footwear";

export type ChangedField = "brand" | "price" | "image" | "text" | "keywords";

export type DemoScenario = {
  id: string;
  listing_id: string;
  name: string;
  category: MarketplaceCategory;
  expected_risk: RiskLevel;
  expected_action: string;
  versions: ListingVersion[];
};

export type AgentName =
  | "TrustPatrolRootAgent"
  | "InvestigationAgent"
  | "AssessmentAgent";

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

export type InvestigationSignals = {
  brand_injection: boolean;
  brand_added: string | null;
  price_drop_pct: number;
  price_anomaly: boolean;
  counterfeit_keywords: string[];
  image_swapped: boolean;
  text_fields_unchanged: boolean;
  post_approval_edit: boolean;
};

export type InvestigationReport = {
  status: "pending" | "running" | "completed";
  signals: InvestigationSignals;
  evidence: string[];
  tools_called: string[];
  uncertainty: string;
};

export type AssessmentReport = {
  status: "pending" | "running" | "completed";
  risk_score: number;
  risk_level: RiskLevel;
  confidence: number;
  recommended_action: string;
  reasoning: string[];
  human_review_required: boolean;
};
