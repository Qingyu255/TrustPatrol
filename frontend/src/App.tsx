import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import TimelineIcon from "@mui/icons-material/Timeline";
import {
  Alert,
  AppBar,
  Box,
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
  Step,
  StepLabel,
  Stepper,
  Switch,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HumanReviewPanel } from "./components/HumanReviewPanel";
import { TagChip, categoryTone, fieldTone, riskTone, type TagTone } from "./components/TagChip";
import { ListingsPage, getChangedFields } from "./components/ListingsPage";
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
            {scenario.category} / {scenario.name}
          </Typography>
          <Typography sx={{ fontWeight: 900 }} variant="h4">
            {scenario.listing_id}
          </Typography>
        </Box>
        <TagChip
          label={isRunning ? "TrustPatrol running" : liveMode ? "Live analysis complete" : "Mock analysis complete"}
          tone={isRunning ? "blue" : "green"}
        />
      </Stack>

      {isRunning && <LinearProgress />}
      {runError && <Alert severity="warning">{runError}</Alert>}

      <Box
        sx={{
          alignItems: "start",
          display: "grid",
          gap: 3,
          gridTemplateColumns: { xs: "1fr", lg: "minmax(310px, 0.9fr) minmax(460px, 1.35fr) minmax(320px, 0.9fr)" },
        }}
      >
        <Stack spacing={3}>
          <ListingOverviewCard
            assessmentReport={assessmentReport}
            currentTitle={current.title}
            reviewDecision={reviewDecision}
            scenario={scenario}
          />
          <VersionDiffCard current={current} previous={previous} scenario={scenario} />
        </Stack>

        <AgentReviewCard events={events} isRunning={isRunning} liveMode={liveMode} reviewDecision={reviewDecision} />

        <Stack spacing={3}>
          <FindingsCard assessmentReport={assessmentReport} investigationReport={investigationReport} />
          <HumanReviewPanel
            decision={reviewDecision}
            disabled={!assessmentReport.human_review_required && events.length > 0}
            onDecision={onDecision}
          />
        </Stack>
      </Box>
    </Stack>
  );
}

function ListingOverviewCard({
  scenario,
  currentTitle,
  assessmentReport,
  reviewDecision,
}: {
  scenario: DemoScenario;
  currentTitle: string;
  assessmentReport: AssessmentReport;
  reviewDecision: ReviewDecision | null;
}) {
  const current = scenario.versions[scenario.versions.length - 1];
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" sx={{ justifyContent: "space-between" }}>
            <Box>
              <Typography color="primary" sx={{ fontWeight: 850 }} variant="overline">
                Listing Overview
              </Typography>
              <Typography sx={{ fontWeight: 850 }} variant="h6">
                {currentTitle}
              </Typography>
            </Box>
            <RiskChip risk={assessmentReport.risk_level} />
          </Stack>
          <Box
            sx={{
              display: "grid",
              gap: 1.25,
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            }}
          >
            <Metric label="Seller" value={current.seller_id} />
            <Metric label="Category" value={scenario.category} tone={categoryTone(scenario.category)} />
            <Metric label="Price" value={`$${current.price}`} />
            <Metric label="Brand" value={current.brand ?? "None"} />
            <Metric label="Recommendation" value={formatAction(assessmentReport.recommended_action)} wide />
            <Metric label="Reviewer Decision" value={reviewDecision ?? "Awaiting review"} wide />
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function VersionDiffCard({
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
        <Stack spacing={2}>
          <Stack direction="row" sx={{ justifyContent: "space-between" }}>
            <Box>
              <Typography color="primary" sx={{ fontWeight: 850 }} variant="overline">
                Version Diff
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
                  p: 1.5,
                }}
              >
                <Typography color="text.secondary" sx={{ fontWeight: 800 }} variant="caption">
                  {label}
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                  <Typography sx={{ flex: 1, overflowWrap: "anywhere" }} variant="body2">
                    v1: {before}
                  </Typography>
                  <Typography sx={{ flex: 1, overflowWrap: "anywhere" }} variant="body2">
                    v2: {after}
                  </Typography>
                </Stack>
              </Box>
            ))}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function AgentReviewCard({
  events,
  isRunning,
  liveMode,
  reviewDecision,
}: {
  events: AgentEvent[];
  isRunning: boolean;
  liveMode: boolean;
  reviewDecision: ReviewDecision | null;
}) {
  const activeStep = reviewDecision
    ? 3
    : events.some((event) => event.agent === "AssessmentAgent")
      ? 2
      : events.some((event) => event.agent === "InvestigationAgent")
        ? 1
        : events.length > 0
          ? 0
          : -1;

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" sx={{ justifyContent: "space-between" }}>
            <Box>
              <Typography color="primary" sx={{ fontWeight: 850 }} variant="overline">
                Agent Review
              </Typography>
              <Typography sx={{ fontWeight: 850 }} variant="h6">
                {liveMode ? "ADK stream" : "Mock playback"} timeline
              </Typography>
            </Box>
            {isRunning && <TagChip label="Running" tone="blue" />}
          </Stack>

          <Stepper activeStep={activeStep} alternativeLabel>
            {["Root", "Investigation", "Assessment", "Human Review"].map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          <Divider />

          <Stack spacing={1.25} sx={{ maxHeight: 590, overflow: "auto", pr: 1 }}>
            {events.length === 0 ? (
              <Alert severity="info">TrustPatrol starts automatically when the listing opens.</Alert>
            ) : (
              events.map((event) => (
                <Box
                  key={event.id}
                  sx={{
                    border: 1,
                    borderColor: event.type === "final_recommendation" ? "error.light" : "divider",
                    borderLeft: 4,
                    borderLeftColor:
                      event.type === "final_recommendation"
                        ? "primary.main"
                        : event.type === "report_generated"
                          ? "orange"
                          : "grey.400",
                    borderRadius: 2,
                    p: 1.5,
                  }}
                >
                  <Stack direction="row" spacing={1.5}>
                    <Typography color="text.secondary" sx={{ fontWeight: 800 }} variant="caption">
                      {event.timestamp}
                    </Typography>
                    <Box>
                      <Typography sx={{ fontWeight: 800 }} variant="body2">
                        {event.title}
                      </Typography>
                      {event.message && (
                        <Typography color="text.secondary" variant="body2">
                          {event.message}
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                </Box>
              ))
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function FindingsCard({
  investigationReport,
  assessmentReport,
}: {
  investigationReport: InvestigationReport;
  assessmentReport: AssessmentReport;
}) {
  const signals = [
    ["Brand injection", investigationReport.signals.brand_injection],
    ["Price anomaly", investigationReport.signals.price_anomaly],
    ["Keywords", investigationReport.signals.counterfeit_keywords.length > 0],
    ["Image swap", investigationReport.signals.image_swapped],
    ["Post-approval edit", investigationReport.signals.post_approval_edit],
  ];

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Typography color="primary" sx={{ fontWeight: 850 }} variant="overline">
              Findings
            </Typography>
            <Typography sx={{ fontWeight: 850 }} variant="h6">
              Evidence and assessment
            </Typography>
          </Box>

          <Box
            sx={{
              alignItems: "end",
              display: "grid",
              gap: 2,
              gridTemplateColumns: "minmax(110px, 0.7fr) minmax(0, 1.3fr)",
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

          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
            {signals.map(([label, active]) => (
              <TagChip
                icon={active ? <CheckCircleIcon /> : undefined}
                key={String(label)}
                label={label}
                tone={active ? signalTone(String(label)) : "slate"}
              />
            ))}
          </Stack>

          <Divider />

          <List dense>
            {investigationReport.evidence.length === 0 ? (
              <ListItem>
                <ListItemIcon>
                  <TimelineIcon />
                </ListItemIcon>
                <ListItemText primary="Evidence will appear as the automatic analysis completes." />
              </ListItem>
            ) : (
              investigationReport.evidence.map((item) => (
                <ListItem key={item}>
                  <ListItemIcon>
                    <FactCheckIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText primary={item} />
                </ListItem>
              ))
            )}
          </List>

          {assessmentReport.reasoning.length > 0 && (
            <Alert severity="warning">
              {assessmentReport.reasoning[0]}
            </Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  wide = false,
  tone,
}: {
  label: string;
  value: string;
  wide?: boolean;
  tone?: TagTone;
}) {
  return (
    <Box sx={{ bgcolor: "grey.50", borderRadius: 2, gridColumn: wide ? "1 / -1" : "auto", p: 1.5 }}>
      <Typography color="text.secondary" sx={{ fontWeight: 800 }} variant="caption">
        {label}
      </Typography>
      {tone ? (
        <Box sx={{ mt: 0.5 }}>
          <TagChip label={value} tone={tone} />
        </Box>
      ) : (
        <Typography sx={{ fontWeight: 800, overflowWrap: "anywhere" }} variant="body2">
          {value}
        </Typography>
      )}
    </Box>
  );
}

function RiskChip({ risk }: { risk: RiskLevel }) {
  return <TagChip label={risk} tone={riskTone(risk)} />;
}

function signalTone(label: string): TagTone {
  if (label === "Brand injection") return "purple";
  if (label === "Price anomaly") return "amber";
  if (label === "Keywords") return "pink";
  if (label === "Image swap") return "blue";
  if (label === "Post-approval edit") return "orange";
  return "slate";
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
