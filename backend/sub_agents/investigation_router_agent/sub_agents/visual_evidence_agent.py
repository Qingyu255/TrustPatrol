from backend.custom.tool_specialist_agent import ToolUsingSpecialistAgent, listing_timeline_arg
from backend.tools import detect_image_swap, detect_visual_risk


visual_evidence_agent = ToolUsingSpecialistAgent(
    name="VisualEvidenceAgent",
    description="Assesses deterministic image metadata for conservative visual-risk triage.",
    domain_instruction=(
        "Focus only on visual evidence and image metadata. "
        "Explain visual drift conservatively; visual evidence alone is not proof of authenticity issues."
    ),
    tools_to_run=[
        ("detect_image_swap", lambda case: detect_image_swap(listing_timeline_arg(case))),
        ("detect_visual_risk", detect_visual_risk),
    ],
)
