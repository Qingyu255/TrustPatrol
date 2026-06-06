import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import TimelineIcon from "@mui/icons-material/Timeline";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Divider,
  FormControlLabel,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Switch,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ListingsPage, getChangedFields } from "./components/ListingsPage";
import { TagChip, fieldTone, riskTone, type TagTone } from "./components/TagChip";
import { runTrustPatrolLive } from "./lib/adkClient";
import { demoScenarios } from "./lib/mockListings";
import {
  buildAssessmentReport,
  buildInvestigationReport,
  buildMockEvents,
} from "./lib/mockPlayback";
import type {
  AgentEvent,
  AssessmentReport,
  DemoScenario,
  InvestigationReport,
  ReviewDecision,
  RiskLevel,
} from "./types";

const playbackDelayMs = 320;

type EvidenceLane = {
  title: string;
  severity: RiskLevel;
  summary: string;
  facts: string[];
  tone: TagTone;
};

type CaseFile = {
  lanes: EvidenceLane[];
  topReasons: string[];
  policyReasoning: string;
  falsePositiveGuardrail: string;
  sellerTrustFacts: string[];
};

function App() {
  const [selectedId, setSelectedId] = useState(demoScenarios[0].id);
  const [activeView, setActiveView] = useState<"overview" | "details">("overview");
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [liveMode, setLiveMode] = useState(false);
  const [reviewDecision, setReviewDecision] = useState<ReviewDecision | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const runTokenRef = useRef(0);

  const selectedScenario = useMemo(
    () => demoScenarios.find((scenario) => scenario.id === selectedId) ?? demoScenarios[0],
    [selectedId],
  );

  const completedInvestigation = useMemo(
    () => buildInvestigationReport(selectedScenario),
    [selectedScenario],
  );
  const completedAssessment = useMemo(
    () => buildAssessmentReport(selectedScenario),
    [selectedScenario],
  );

  const visibleInvestigation = hasEvent(events, "investigation-report")
    ? completedInvestigation
    : pendingInvestigation(events);
  const visibleAssessment = hasEvent(events, "assessment-report")
    ? completedAssessment
    : pendingAssessment(events);

  const runAnalysis = useCallback(
    async (scenario: DemoScenario) => {
      const token = runTokenRef.current + 1;
      runTokenRef.current = token;
      setRunError(null);
      setIsRunning(true);
      setEvents([]);
      setReviewDecision(null);

      async function runMockPlayback() {
        const playbackEvents = buildMockEvents(scenario);
        for (const event of playbackEvents) {
          await wait(playbackDelayMs);
          if (runTokenRef.current !== token) return;
          setEvents((current) => [...current, event]);
        }
      }

      try {
        if (liveMode) {
          await runTrustPatrolLive(scenario, {
            onEvent: (event) => {
              if (runTokenRef.current === token) {
                setEvents((current) => [...current, event]);
              }
            },
          });
        } else {
          await runMockPlayback();
        }
      } catch (error) {
        if (runTokenRef.current !== token) return;
        setRunError(
          error instanceof Error
            ? `${error.message}. Falling back to mock playback.`
            : "Live ADK run failed. Falling back to mock playback.",
        );
        await runMockPlayback();
      } finally {
        if (runTokenRef.current === token) setIsRunning(false);
      }
    },
    [liveMode],
  );

  useEffect(() => {
    if (activeView === "details") {
      void runAnalysis(selectedScenario);
    }
  }, [activeView, runAnalysis, selectedScenario]);

  function openScenario(scenario: DemoScenario) {
    setSelectedId(scenario.id);
    setActiveView("details");
  }

  function onDecision(decision: ReviewDecision) {
    setReviewDecision(decision);
    setEvents((current) => [
      ...current,
      {
        id: `review-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        type: "human_review_decision",
        title: "Human review decision recorded",
        message: decision,
      },
    ]);
  }

  return (
    <Box sx={{ bgcolor: "background.default", minHeight: "100vh" }}>
      <AppBar
        color="inherit"
        elevation={0}
        position="sticky"
        sx={{ borderBottom: 1, borderColor: "divider", backdropFilter: "blur(10px)" }}
      >
        <Toolbar sx={{ gap: 2 }}>
          <Box
            sx={{
              alignItems: "center",
              bgcolor: "primary.main",
              borderRadius: 2,
              color: "white",
              display: "inline-flex",
              height: 36,
              justifyContent: "center",
              width: 36,
            }}
          >
            <AutoAwesomeIcon fontSize="small" />
          </Box>
          <Box sx={{ flexGrow: 1 }}>
            <Typography sx={{ fontWeight: 900 }} variant="h6">
              TrustPatrol
            </Typography>
            <Typography color="text.secondary" variant="caption">
              Marketplace Trust & Safety Operations
            </Typography>
          </Box>
          <Tooltip title="Listings">
            <IconButton aria-label="Listings" color="primary" onClick={() => setActiveView("overview")}>
              <Inventory2Icon />
            </IconButton>
          </Tooltip>
          <FormControlLabel
            control={<Switch checked={liveMode} onChange={(event) => setLiveMode(event.target.checked)} />}
            label="Live ADK"
          />
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 3 }}>
        {activeView === "overview" ? (
          <ListingsPage scenarios={demoScenarios} onOpenScenario={openScenario} />
        ) : (
          <ListingDetailsPage
            assessmentReport={visibleAssessment}
            events={events}
            investigationReport={visibleInvestigation}
            isRunning={isRunning}
            liveMode={liveMode}
            onBack={() => setActiveView("overview")}
            onDecision={onDecision}
            reviewDecision={reviewDecision}
            runError={runError}
            scenario={selectedScenario}
          />
        )}
      </Container>
    </Box>
  );
}

type DetailsProps = {
  scenario: DemoScenario;
  events: AgentEvent[];
  investigationReport: InvestigationReport;
  assessmentReport: AssessmentReport;
  isRunning: boolean;
  liveMode: boolean;
  reviewDecision: ReviewDecision | null;
  runError: string | null;
  onBack: () => void;
  onDecision: (decision: ReviewDecision) => void;
};

function ListingDetailsPage({
  scenario,
  events,
  investigationReport,
  assessmentReport,
  isRunning,
  liveMode,
  reviewDecision,
  runError,
  onBack,
  onDecision,
}: DetailsProps) {
  const [previous, current] = scenario.versions;
  const caseFile = buildCaseFile(scenario, investigationReport, assessmentReport);

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ alignItems: { xs: "stretch", md: "center" } }}
      >
        <Tooltip title="Back to listings">
          <IconButton
            aria-label="Back to listings"
            onClick={onBack}
            sx={{
              bgcolor: "white",
              border: 1,
              borderColor: "divider",
              boxShadow: "0 8px 22px rgba(17, 24, 39, 0.08)",
              height: 44,
              width: 44,
            }}
          >
            <ArrowBackIcon />
          </IconButton>
        </Tooltip>
        <Box sx={{ flexGrow: 1 }}>
          <Typography color="primary" sx={{ fontWeight: 850 }} variant="overline">
            Listing Violation Case / {scenario.category}
          </Typography>
          <Typography sx={{ fontWeight: 900 }} variant="h4">
            {scenario.listing_id}
          </Typography>
        </Box>
        <TagChip
          label={isRunning ? "Analysis running" : liveMode ? "Live analysis complete" : "Mock analysis complete"}
          tone={isRunning ? "blue" : "green"}
        />
      </Stack>

      {isRunning && <LinearProgress />}
      {runError && <Alert severity="warning">{runError}</Alert>}

      <DecisionHeader assessmentReport={assessmentReport} />

      <Box
        sx={{
          alignItems: "start",
          display: "grid",
          gap: 3,
          gridTemplateColumns: { xs: "1fr", lg: "minmax(280px, 0.75fr) minmax(640px, 1.65fr) minmax(260px, 0.7fr)" },
        }}
      >
        <Stack spacing={2}>
          <ChangeSummaryCard current={current} previous={previous} scenario={scenario} />
          <SpecialistEvidenceReview events={events} isRunning={isRunning} liveMode={liveMode} />
        </Stack>

        <Stack spacing={3}>
          <DecisionSummary caseFile={caseFile} />
          <EvidenceLanes lanes={caseFile.lanes} />
        </Stack>

        <Stack spacing={3}>
          <AssessmentDecisionPanel
            assessmentReport={assessmentReport}
            caseFile={caseFile}
            decision={reviewDecision}
            disabled={!assessmentReport.human_review_required && events.length > 0}
            onDecision={onDecision}
          />
        </Stack>
      </Box>
    </Stack>
  );
}

function DecisionHeader({ assessmentReport }: { assessmentReport: AssessmentReport }) {
  return (
    <Card
      variant="outlined"
      sx={{
        background:
          assessmentReport.risk_level === "CRITICAL"
            ? "linear-gradient(135deg, #fff7ed 0%, #ffffff 62%)"
            : "background.paper",
      }}
    >
      <CardContent>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" } }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography color="primary" sx={{ fontWeight: 850 }} variant="overline">
              Decision Header
            </Typography>
            <Typography sx={{ fontWeight: 950 }} variant="h4">
              Listing Risk: {assessmentReport.risk_level}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }} variant="body1">
              Recommended Action: {formatAction(assessmentReport.recommended_action)}
            </Typography>
          </Box>
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
            <RiskChip risk={assessmentReport.risk_level} />
            <TagChip label={`Confidence ${Math.round(assessmentReport.confidence * 100)}%`} tone="blue" />
            <TagChip
              label={assessmentReport.human_review_required ? "Human Review Required" : "Human Review Optional"}
              tone={assessmentReport.human_review_required ? "orange" : "green"}
            />
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function ChangeSummaryCard({
  previous,
  current,
  scenario,
}: {
  previous: DemoScenario["versions"][number];
  current: DemoScenario["versions"][number];
  scenario: DemoScenario;
}) {
  const fields = [
    ["title", previous.title, current.title],
    ["description", previous.description, current.description],
    ["brand", previous.brand ?? "None", current.brand ?? "None"],
    ["price", `$${previous.price}`, `$${current.price}`],
    ["image", previous.image_id, current.image_id],
  ];

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" sx={{ justifyContent: "space-between" }}>
            <Box>
              <Typography color="primary" sx={{ fontWeight: 850 }} variant="overline">
                Change Summary
              </Typography>
              <Typography sx={{ fontWeight: 850 }} variant="h6">
                v1 approval to v2 edit
              </Typography>
            </Box>
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75, justifyContent: "flex-end" }}>
              {getChangedFields(scenario).map((field) => (
                <TagChip key={field} label={field} tone={fieldTone(field)} />
              ))}
            </Stack>
          </Stack>
          <Stack spacing={1}>
            {fields.map(([label, before, after]) => (
              <Box
                key={label}
                sx={{
                  bgcolor: before !== after ? "#fff7ed" : "grey.50",
                  border: 1,
                  borderColor: before !== after ? "warning.light" : "divider",
                  borderRadius: 2,
                  p: 1.25,
                }}
              >
                <Typography color="text.secondary" sx={{ fontWeight: 850 }} variant="caption">
                  {label}
                </Typography>
                <Typography sx={{ overflowWrap: "anywhere" }} variant="body2">
                  {before !== after ? `${before} -> ${after}` : String(after)}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function SpecialistEvidenceReview({
  events,
  isRunning,
  liveMode,
}: {
  events: AgentEvent[];
  isRunning: boolean;
  liveMode: boolean;
}) {
  return (
    <Accordion disableGutters variant="outlined">
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography sx={{ fontWeight: 850 }} variant="subtitle2">
            Specialist Evidence Review
          </Typography>
          <Typography color="text.secondary" variant="caption">
            {isRunning ? "Packaging evidence..." : `${events.length} runtime events available`}
          </Typography>
        </Box>
        <TagChip label={liveMode ? "ADK" : "Mock"} tone={liveMode ? "blue" : "slate"} />
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={1}>
          {events.length === 0 ? (
            <Alert severity="info">Evidence review starts automatically when this case opens.</Alert>
          ) : (
            events.map((event) => (
              <Box
                key={event.id}
                sx={{
                  border: 1,
                  borderColor: "divider",
                  borderLeft: 4,
                  borderLeftColor: event.type === "final_recommendation" ? "primary.main" : "grey.300",
                  borderRadius: 2,
                  p: 1,
                }}
              >
                <Typography color="text.secondary" sx={{ fontWeight: 800 }} variant="caption">
                  {event.timestamp}
                </Typography>
                <Typography sx={{ fontWeight: 800 }} variant="body2">
                  {event.title}
                </Typography>
                {event.message && (
                  <Typography color="text.secondary" variant="caption">
                    {event.message}
                  </Typography>
                )}
              </Box>
            ))
          )}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

function DecisionSummary({ caseFile }: { caseFile: CaseFile }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Typography color="primary" sx={{ fontWeight: 850 }} variant="overline">
              Decision Summary
            </Typography>
            <Typography sx={{ fontWeight: 900 }} variant="h5">
              Case packaged for a 30-second review
            </Typography>
          </Box>
          <List dense>
            {caseFile.topReasons.map((reason, index) => (
              <ListItem key={reason} sx={{ alignItems: "flex-start" }}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <TagChip label={String(index + 1)} tone="orange" />
                </ListItemIcon>
                <ListItemText primary={reason} />
              </ListItem>
            ))}
          </List>
        </Stack>
      </CardContent>
    </Card>
  );
}

function EvidenceLanes({ lanes }: { lanes: EvidenceLane[] }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Typography color="primary" sx={{ fontWeight: 850 }} variant="overline">
              Evidence Lanes
            </Typography>
            <Typography sx={{ fontWeight: 900 }} variant="h5">
              Specialist evidence packaged by category
            </Typography>
          </Box>
          <Stack spacing={1.25} sx={{ maxHeight: 560, overflowY: "auto", pr: 1 }}>
            {lanes.map((lane) => (
              <Accordion
                defaultExpanded={lane.title === "Brand & Policy Evidence"}
                disableGutters
                key={lane.title}
                variant="outlined"
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Stack spacing={0.75} sx={{ width: "100%" }}>
                    <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
                      <Typography sx={{ fontWeight: 900 }} variant="subtitle1">
                        {lane.title}
                      </Typography>
                      <TagChip label={lane.severity} tone={lane.tone} />
                    </Stack>
                    <Typography color="text.secondary" variant="body2">
                      {lane.summary}
                    </Typography>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    {lane.facts.map((fact) => (
                      <ListItem key={fact} sx={{ px: 0 }}>
                        <ListItemIcon sx={{ minWidth: 34 }}>
                          <FactCheckIcon color="primary" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={fact} />
                      </ListItem>
                    ))}
                  </List>
                </AccordionDetails>
              </Accordion>
            ))}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function AssessmentDecisionPanel({
  caseFile,
  assessmentReport,
  decision,
  disabled,
  onDecision,
}: {
  caseFile: CaseFile;
  assessmentReport: AssessmentReport;
  decision: ReviewDecision | null;
  disabled: boolean;
  onDecision: (decision: ReviewDecision) => void;
}) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Box>
            <Typography color="primary" sx={{ fontWeight: 850 }} variant="overline">
              Human Decision
            </Typography>
            <Typography sx={{ fontWeight: 900 }} variant="h6">
              {decision ?? "Awaiting reviewer"}
            </Typography>
          </Box>
          <Box
            sx={{
              alignItems: "end",
              display: "grid",
              gap: 2,
              gridTemplateColumns: "minmax(95px, 0.7fr) minmax(0, 1.3fr)",
            }}
          >
            <Box>
              <Typography sx={{ fontWeight: 950, lineHeight: 1 }} variant="h2">
                {assessmentReport.risk_score}
              </Typography>
              <RiskChip risk={assessmentReport.risk_level} />
            </Box>
            <Typography color="text.secondary" variant="body2">
              {formatAction(assessmentReport.recommended_action)}
            </Typography>
          </Box>
          <Alert severity="warning">
            {assessmentReport.risk_level === "CRITICAL"
              ? "Recommended because multiple evidence lanes point to counterfeit/IP infringement risk."
              : "Recommended action follows the current evidence strength."}
          </Alert>
          <Typography color="text.secondary" variant="caption">
            {caseFile.falsePositiveGuardrail}
          </Typography>
          <Stack spacing={1}>
            <Button
              disabled={disabled}
              onClick={() => onDecision("Approve Suppression")}
              variant={decision === "Approve Suppression" ? "contained" : "outlined"}
            >
              Approve
            </Button>
            <Accordion disableGutters variant="outlined">
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography sx={{ fontWeight: 850 }} variant="body2">
                  Other human decisions
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1}>
                  {(["Request Seller Verification", "Override to Allow", "Escalate", "Mark False Positive"] as ReviewDecision[]).map(
                    (item) => (
                      <Button
                        disabled={disabled}
                        key={item}
                        onClick={() => onDecision(item)}
                        size="small"
                        variant={decision === item ? "contained" : "text"}
                      >
                        {item}
                      </Button>
                    ),
                  )}
                </Stack>
              </AccordionDetails>
            </Accordion>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function buildCaseFile(
  scenario: DemoScenario,
  investigation: InvestigationReport,
  assessment: AssessmentReport,
): CaseFile {
  const [previous, current] = scenario.versions;
  const changedFields = getChangedFields(scenario);
  const sellerTrustFacts =
    scenario.id === "brand_injection"
      ? ["Seller account is new to the category.", "Seller has 2 prior suspicious edit patterns.", "Repeated post-approval edits increase review priority."]
      : scenario.id === "replica_reveal"
        ? ["Seller has repeated luxury-category edits.", "Prior listing was monitored for similar language."]
        : ["No high-priority seller trust flags in the mock case."];

  const topReasons =
    scenario.id === "brand_injection"
      ? [
          "Brand Apple was added after approval.",
          "Price dropped 60%.",
          "\"OEM\", \"1:1\", and \"mirror quality\" appeared in listing text.",
          "Product image changed to branded packaging.",
          "Seller has prior suspicious edits.",
        ]
      : [
          ...investigation.evidence.slice(0, 4),
          sellerTrustFacts[0],
        ].filter(Boolean);

  return {
    topReasons,
    sellerTrustFacts,
    policyReasoning:
      assessment.risk_level === "CRITICAL"
        ? "The evidence maps to counterfeit/IP infringement and prohibited-listing risk: brand injection after approval, suspicious authenticity terms, a sharp price drop, and changed visual packaging. Temporary suppression plus human review is proportionate because it protects buyers while preserving a reviewer decision point."
        : "The recommendation is calibrated to the available evidence. Lower-confidence or isolated signals should be handled with monitoring or seller verification before punitive action.",
    falsePositiveGuardrail:
      "This is not a final guilt finding. Seller verification, appeal evidence, or reviewer override can reverse, narrow, or downgrade the action to avoid wrongly penalizing legitimate sellers.",
    lanes: [
      {
        title: "Brand & Policy Evidence",
        severity: investigation.signals.brand_injection || investigation.signals.counterfeit_keywords.length ? "HIGH" : "LOW",
        tone: investigation.signals.brand_injection || investigation.signals.counterfeit_keywords.length ? "purple" : "green",
        summary: "Checks whether the edit introduced brand or counterfeit/IP infringement indicators after approval.",
        facts: [
          investigation.signals.brand_added
            ? `Brand added after approval: ${investigation.signals.brand_added}.`
            : "No new brand was added.",
          investigation.signals.counterfeit_keywords.length
            ? `Counterfeit-associated terms: ${investigation.signals.counterfeit_keywords.join(", ")}.`
            : "No newly introduced counterfeit terms.",
          "Policy framing: prohibited listings, IP infringement, and counterfeit listings may require removal, suppression, or seller verification.",
        ],
      },
      {
        title: "Pricing Evidence",
        severity: investigation.signals.price_anomaly ? "HIGH" : "LOW",
        tone: investigation.signals.price_anomaly ? "amber" : "green",
        summary: "Checks whether the listing price changed in a way that increases counterfeit risk.",
        facts: [
          `Previous price: $${previous.price}. Current price: $${current.price}.`,
          investigation.signals.price_drop_pct
            ? `Price dropped ${investigation.signals.price_drop_pct}%.`
            : "No material price drop detected.",
          "Large post-approval discounts can strengthen counterfeit-risk signals when paired with brand and text changes.",
        ],
      },
      {
        title: "Visual Evidence",
        severity: investigation.signals.image_swapped ? "MEDIUM" : "LOW",
        tone: investigation.signals.image_swapped ? "blue" : "green",
        summary: "Checks whether the listing image changed after approval.",
        facts: [
          `Previous image ID: ${previous.image_id}.`,
          `Current image ID: ${current.image_id}.`,
          investigation.signals.image_swapped
            ? "Image changed to branded packaging in the mock evidence."
            : "Image did not materially change.",
        ],
      },
      {
        title: "Seller Trust Evidence",
        severity: sellerTrustFacts.length > 1 ? "MEDIUM" : "LOW",
        tone: sellerTrustFacts.length > 1 ? "orange" : "green",
        summary: "Adds lightweight seller context so reviewers can avoid both buyer harm and false positives.",
        facts: sellerTrustFacts,
      },
      {
        title: "Timeline Evidence",
        severity: investigation.signals.post_approval_edit ? "MEDIUM" : "LOW",
        tone: investigation.signals.post_approval_edit ? "teal" : "green",
        summary: "Focuses on what changed after the listing was already approved.",
        facts: [
          investigation.signals.post_approval_edit
            ? "Listing was edited after approval."
            : "No post-approval edit detected.",
          changedFields.length ? `Changed fields: ${changedFields.join(", ")}.` : "No meaningful changed fields.",
          "Post-approval drift is the core TrustPatrol detection pattern.",
        ],
      },
    ],
  };
}

function RiskChip({ risk }: { risk: RiskLevel }) {
  return <TagChip label={risk} tone={riskTone(risk)} />;
}

function hasEvent(events: AgentEvent[], eventId: string) {
  return events.some((event) => event.id === eventId);
}

function pendingInvestigation(events: AgentEvent[]): InvestigationReport {
  return {
    status: events.some((event) => event.agent === "InvestigationAgent") ? "running" : "pending",
    signals: {
      brand_injection: false,
      brand_added: null,
      price_drop_pct: 0,
      price_anomaly: false,
      counterfeit_keywords: [],
      image_swapped: false,
      text_fields_unchanged: false,
      post_approval_edit: false,
    },
    evidence: [],
    tools_called: [],
    uncertainty: "TrustPatrol is analyzing the listing timeline.",
  };
}

function pendingAssessment(events: AgentEvent[]): AssessmentReport {
  return {
    status: events.some((event) => event.agent === "AssessmentAgent") ? "running" : "pending",
    risk_score: 0,
    risk_level: "PENDING",
    confidence: 0,
    recommended_action: "PENDING_AGENT_ASSESSMENT",
    reasoning: [],
    human_review_required: false,
  };
}

function formatAction(value: string) {
  return value.replaceAll("_", " ");
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export default App;
