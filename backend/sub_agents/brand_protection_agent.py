from backend.sub_agents.tool_specialist_agent import ToolUsingSpecialistAgent, listing_timeline_arg
from backend.tools import build_evidence, detect_brand_injection, detect_counterfeit_keywords


brand_protection_agent = ToolUsingSpecialistAgent(
    name="BrandProtectionAgent",
    description="Inspects listing changes for brand, IP, and counterfeit-language risk signals.",
    domain_instruction=(
        "Focus only on brand/IP and counterfeit-language evidence. "
        "Explain the evidence without asserting authenticity or guilt."
    ),
    tools_to_run=[
        ("detect_brand_injection", lambda case: detect_brand_injection(listing_timeline_arg(case))),
        ("detect_counterfeit_keywords", lambda case: detect_counterfeit_keywords(listing_timeline_arg(case))),
        ("build_evidence", lambda case: build_evidence(listing_timeline_arg(case))),
    ],
)
