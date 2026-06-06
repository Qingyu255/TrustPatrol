import type {
  AgentEvent,
  AssessmentReport,
  DemoScenario,
  InvestigationReport,
  RiskLevel,
} from "../types";

const defaultSignals = {
  brand_injection: false,
  brand_added: null,
  price_drop_pct: 0,
  price_anomaly: false,
  counterfeit_keywords: [],
  image_swapped: false,
  text_fields_unchanged: false,
  post_approval_edit: true,
};

export function buildInvestigationReport(scenario: DemoScenario): InvestigationReport {
  if (scenario.id === "brand_injection") {
    return {
      status: "completed",
      signals: {
        brand_injection: true,
        brand_added: "Apple",
        price_drop_pct: 60,
        price_anomaly: true,
        counterfeit_keywords: ["OEM", "1:1", "factory batch", "same production line", "mirror quality"],
        image_swapped: true,
        text_fields_unchanged: false,
        post_approval_edit: true,
      },
      evidence: [
        "Brand Apple was added after approval.",
        "Price dropped by 60%.",
        "Counterfeit-associated keywords appeared: OEM, 1:1, factory batch, same production line, mirror quality.",
        "Listing image changed after approval.",
        "Listing was edited after approval.",
      ],
      tools_called: [
        "detect_brand_injection",
        "detect_price_anomaly",
        "detect_counterfeit_keywords",
        "detect_image_swap",
        "detect_post_approval_edit",
        "build_evidence",
      ],
      uncertainty:
        "Image IDs are mocked and do not prove authenticity. Evidence is sufficient to require human review.",
    };
  }

  if (scenario.id === "replica_reveal") {
    return {
      status: "completed",
      signals: {
        brand_injection: true,
        brand_added: "Luxury Designer",
        price_drop_pct: 78.3,
        price_anomaly: true,
        counterfeit_keywords: ["1:1", "AAA", "mirror quality", "original quality", "factory direct", "no receipt"],
        image_swapped: true,
        text_fields_unchanged: false,
        post_approval_edit: true,
      },
      evidence: [
        "Brand Luxury Designer was added after approval.",
        "Price dropped by 78.3%.",
        "Counterfeit-associated keywords appeared: 1:1, AAA, mirror quality, original quality, factory direct, no receipt.",
        "Listing image changed after approval.",
        "Listing was edited after approval.",
      ],
      tools_called: [
        "detect_brand_injection",
        "detect_price_anomaly",
        "detect_counterfeit_keywords",
        "detect_image_swap",
        "detect_post_approval_edit",
        "build_evidence",
      ],
      uncertainty: "Brand naming is generic in mock data; action remains review-oriented.",
    };
  }

  if (scenario.id === "image_only_suspicious") {
    return {
      status: "completed",
      signals: {
        ...defaultSignals,
        image_swapped: true,
        text_fields_unchanged: true,
      },
      evidence: [
        "Listing image changed after approval while text and price stayed mostly unchanged.",
        "Listing was edited after approval.",
      ],
      tools_called: ["detect_image_swap", "detect_post_approval_edit", "build_evidence"],
      uncertainty: "No text or price signal was detected, so monitoring is more proportionate than enforcement.",
    };
  }

  return {
    status: "completed",
    signals: defaultSignals,
    evidence: ["Listing was edited after approval."],
    tools_called: ["detect_post_approval_edit", "build_evidence"],
    uncertainty: "No high-risk mutation pattern was detected in the mock scenario.",
  };
}

export function buildAssessmentReport(scenario: DemoScenario): AssessmentReport {
  const riskLevel = scenario.expected_risk as RiskLevel;
  if (scenario.id === "brand_injection") {
    return {
      status: "completed",
      risk_score: 95,
      risk_level: "CRITICAL",
      confidence: 0.91,
      recommended_action: "TEMPORARY_SUPPRESSION_AND_HUMAN_REVIEW",
      reasoning: [
        "Multiple high-risk signals appeared after the listing was already approved.",
        "Brand injection, suspicious language, price drop, and image swap reinforce each other.",
        "The recommendation is temporary and requires a human reviewer before final enforcement.",
      ],
      human_review_required: true,
    };
  }

  if (scenario.id === "replica_reveal") {
    return {
      status: "completed",
      risk_score: 95,
      risk_level: "CRITICAL",
      confidence: 0.9,
      recommended_action: "TEMPORARY_SUPPRESSION_AND_HUMAN_REVIEW",
      reasoning: [
        "Brand and replica-associated language were introduced after approval.",
        "The price dropped sharply while the image changed to a more branded-looking asset.",
        "Human review is required before any final enforcement decision.",
      ],
      human_review_required: true,
    };
  }

  if (scenario.id === "image_only_suspicious") {
    return {
      status: "completed",
      risk_score: 30,
      risk_level: "LOW",
      confidence: 0.72,
      recommended_action: "ALLOW",
      reasoning: [
        "Image swap and post-approval edit were detected, but text, brand, and price stayed stable.",
        "The signal is weak on its own and does not justify enforcement.",
      ],
      human_review_required: false,
    };
  }

  return {
    status: "completed",
    risk_score: riskLevel === "LOW" ? 15 : 45,
    risk_level: riskLevel,
    confidence: 0.74,
    recommended_action: scenario.expected_action,
    reasoning: [
      "No strong counterfeit mutation pattern was detected.",
      "The edit is consistent with normal listing maintenance.",
    ],
    human_review_required: false,
  };
}

export function buildMockEvents(scenario: DemoScenario): AgentEvent[] {
  const investigation = buildInvestigationReport(scenario);
  const assessment = buildAssessmentReport(scenario);

  return [
    {
      id: "root-started",
      timestamp: "10:02:01",
      type: "agent_started",
      agent: "TrustPatrolRootAgent",
      title: "TrustPatrolRootAgent started",
      message: `Received ${scenario.listing_id} timeline with ${scenario.versions.length} versions.`,
    },
    {
      id: "investigation-started",
      timestamp: "10:02:02",
      type: "agent_started",
      agent: "InvestigationAgent",
      title: "InvestigationAgent started",
      message: "Gathering evidence from listing changes.",
    },
    ...investigation.tools_called.flatMap((toolName, index) => [
      {
        id: `${toolName}-started`,
        timestamp: `10:02:${String(index * 2 + 3).padStart(2, "0")}`,
        type: "tool_call_started" as const,
        agent: "InvestigationAgent" as const,
        tool_name: toolName,
        title: `${toolName} started`,
        message: "Inspecting listing version history.",
      },
      {
        id: `${toolName}-completed`,
        timestamp: `10:02:${String(index * 2 + 4).padStart(2, "0")}`,
        type: "tool_call_completed" as const,
        agent: "InvestigationAgent" as const,
        tool_name: toolName,
        title: `${toolName} completed`,
        message: toolName === "build_evidence" ? "Evidence bundle generated." : "Signal check completed.",
      },
    ]),
    {
      id: "investigation-report",
      timestamp: "10:02:16",
      type: "report_generated",
      agent: "InvestigationAgent",
      title: "Investigation report generated",
      message: `${investigation.evidence.length} evidence items found.`,
      payload: investigation,
    },
    {
      id: "investigation-completed",
      timestamp: "10:02:17",
      type: "agent_completed",
      agent: "InvestigationAgent",
      title: "InvestigationAgent completed",
      message: "Structured evidence passed to AssessmentAgent.",
    },
    {
      id: "assessment-started",
      timestamp: "10:02:18",
      type: "agent_started",
      agent: "AssessmentAgent",
      title: "AssessmentAgent started",
      message: "Scoring evidence using TrustPatrol risk framework.",
    },
    {
      id: "assessment-report",
      timestamp: "10:02:20",
      type: "report_generated",
      agent: "AssessmentAgent",
      title: "Assessment report generated",
      message: `Risk score ${assessment.risk_score}, level ${assessment.risk_level}.`,
      payload: assessment,
    },
    {
      id: "final-recommendation",
      timestamp: "10:02:21",
      type: "final_recommendation",
      agent: "AssessmentAgent",
      title: "Final recommendation",
      message: assessment.recommended_action,
      payload: assessment,
    },
  ];
}
