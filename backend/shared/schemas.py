from pydantic import BaseModel, Field


class ListingVersion(BaseModel):
    listing_id: str
    version: int
    status: str
    title: str
    description: str
    brand: str | None = None
    price: float
    image_id: str
    seller_id: str


class ListingTimeline(BaseModel):
    listing_id: str
    versions: list[ListingVersion]


class InvestigationSignals(BaseModel):
    brand_injection: bool = False
    brand_added: str | None = None
    price_drop_pct: float = 0
    price_anomaly: bool = False
    counterfeit_keywords: list[str] = Field(default_factory=list)
    image_swapped: bool = False
    text_fields_unchanged: bool = False
    post_approval_edit: bool = False


class InvestigationResult(BaseModel):
    agent: str = "InvestigationAgent"
    status: str
    signals: InvestigationSignals
    evidence: list[str] = Field(default_factory=list)


class AssessmentResult(BaseModel):
    agent: str = "AssessmentAgent"
    status: str
    risk_score: int
    risk_level: str
    confidence: float
    recommended_action: str
    reasoning: list[str] = Field(default_factory=list)
    human_review_required: bool


class RouterPlan(BaseModel):
    agent: str = "InvestigationRouterAgent"
    agents_to_invoke: list[str] = Field(default_factory=list)
    agents_skipped: list[dict] = Field(default_factory=list)
    routing_reason: str
    minimum_evidence_required: int
    case_priority: str
    selection_reasons: dict = Field(default_factory=dict)
    llm_router_analysis: dict | None = None


class SpecialistFinding(BaseModel):
    agent: str
    status: str
    risk_level: str
    risk_contribution: int
    confidence: float
    finding: str
    evidence: list[str] = Field(default_factory=list)
    uncertainty: str
    recommended_next_step: str
    llm_analysis: dict | None = None


class LeadDecision(BaseModel):
    agent: str = "LeadAdjudicatorAgent"
    status: str
    final_risk_score: int
    risk_level: str
    confidence: float
    recommended_action: str
    policy_buckets: list[str] = Field(default_factory=list)
    top_evidence: list[str] = Field(default_factory=list)
    agent_consensus: dict = Field(default_factory=dict)
    decision_reasoning: list[str] = Field(default_factory=list)
    human_review_required: bool


class EnforcementActionLog(BaseModel):
    agent: str = "EnforcementActionAgent"
    status: str
    actions: list[dict] = Field(default_factory=list)
    review_queue: str
    seller_message_summary: str
    audit_log_summary: str


class Phase2CaseFile(BaseModel):
    listing_id: str
    timeline_diff: dict
    router_plan: RouterPlan
    specialist_findings: list[SpecialistFinding] = Field(default_factory=list)
    lead_decision: LeadDecision
    enforcement_action_log: EnforcementActionLog
    human_reviewer_decision: dict | None = None
