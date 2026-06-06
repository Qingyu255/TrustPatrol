from backend.custom.tool_specialist_agent import ToolUsingSpecialistAgent
from backend.tools import evaluate_review_profile


review_integrity_agent = ToolUsingSpecialistAgent(
    name="ReviewIntegrityAgent",
    description="Evaluates review and rating metadata for integrity-risk signals without claiming fake reviews.",
    domain_instruction=(
        "Focus only on review and rating metadata. "
        "Explain whether generic review ratio or review bursts warrant review. "
        "Do not claim reviews are fake based on metadata alone."
    ),
    tools_to_run=[
        ("evaluate_review_profile", lambda case: evaluate_review_profile(case.get("review_profile", {}))),
    ],
)
