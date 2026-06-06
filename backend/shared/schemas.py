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
