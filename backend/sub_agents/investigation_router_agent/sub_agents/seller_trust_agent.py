from backend.custom.tool_specialist_agent import ToolUsingSpecialistAgent
from backend.tools import evaluate_seller_profile


seller_trust_agent = ToolUsingSpecialistAgent(
    name="SellerTrustAgent",
    description="Evaluates seller-level trust signals such as age, prior flags, and listing velocity.",
    domain_instruction=(
        "Focus only on seller-level trust metadata. "
        "Explain whether account age, prior flags, or listing velocity warrant review. "
        "Do not infer intent from seller metadata alone."
    ),
    tools_to_run=[
        ("evaluate_seller_profile", lambda case: evaluate_seller_profile(case.get("seller_profile", {}))),
    ],
)
