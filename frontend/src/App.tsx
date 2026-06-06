import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import Inventory2Icon from "@mui/icons-material/Inventory2";
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
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ListingsPage } from "./components/ListingsPage";
import { TagChip, fieldTone, riskTone, type TagTone } from "./components/TagChip";
import { fetchReviewQueue, fetchSessionDetail } from "./lib/adkClient";
import type {
  AgentEvent,
  ChangedField,
  LeadDecision,
  ListingVersion,
  Phase2CaseFile,
  ReviewDecision,
  ReviewQueueRow,
  RiskLevel,
  SpecialistFinding,
} from "./types";

type EvidenceLane = {
  title: string;
  severity: RiskLevel;
  summary: string;
  facts: string[];
  tone: TagTone;
};

type CaseFileView = {
  lanes: EvidenceLane[];
  topReasons: string[];
  policyReasoning: string;
  falsePositiveGuardrail: string;
  enforcementFacts: string[];
};

function App() {
  const [rows, setRows] = useState<ReviewQueueRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"overview" | "details">("overview");
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reviewDecision, setReviewDecision] = useState<ReviewDecision | null>(null);
  const [localEvents, setLocalEvents] = useState<Record<string, AgentEvent[]>>({});

  const selectedRow = useMemo(
    () => rows.find((row) => row.sessionId === selectedId) ?? null,
    [rows, selectedId],
  );

  const refreshQueue = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const nextRows = await fetchReviewQueue();
      setRows(nextRows);
      setSelectedId((current) => current ?? nextRows[0]?.sessionId ?? null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load ADK sessions.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshQueue();
  }, [refreshQueue]);

  async function openRow(row: ReviewQueueRow) {
    setSelectedId(row.sessionId);
    setReviewDecision(null);
    setActiveView("details");
    try {
      const hydrated = await fetchSessionDetail(row.sessionId, row.userId);
      setRows((current) => current.map((item) => (item.sessionId === row.sessionId ? hydrated : item)));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not refresh session details.");
    }
  }

  function onDecision(decision: ReviewDecision) {
    if (!selectedId) return;
    setReviewDecision(decision);
    setLocalEvents((current) => ({
      ...current,
      [selectedId]: [
        ...(current[selectedId] ?? []),
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
      ],
    }));
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
          <Tooltip title="ADK sessions">
            <IconButton aria-label="ADK sessions" color="primary" onClick={() => setActiveView("overview")}>
              <Inventory2Icon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {isLoading && <LinearProgress />}

      <Container maxWidth="xl" sx={{ py: 3 }}>
        {activeView === "overview" || !selectedRow ? (
          <ListingsPage
            error={loadError}
            isLoading={isLoading}
            onOpenRow={openRow}
            onRefresh={refreshQueue}
            rows={rows}
          />
        ) : (
          <ListingDetailsPage
            localEvents={localEvents[selectedRow.sessionId] ?? []}
            onBack={() => setActiveView("overview")}
            onDecision={onDecision}
            reviewDecision={reviewDecision}
            row={selectedRow}
          />
        )}
      </Container>
    </Box>
  );
}

type DetailsProps = {
  row: ReviewQueueRow;
  localEvents: AgentEvent[];
  reviewDecision: ReviewDecision | null;
  onBack: () => void;
  onDecision: (decision: ReviewDecision) => void;
};

function ListingDetailsPage({
  row,
  localEvents,
  reviewDecision,
  onBack,
  onDecision,
}: DetailsProps) {
  const caseFile = row.caseFile;
  const timeline = row.sourceCase?.timeline ?? [];
  const previous = timeline.length >= 2 ? timeline[timeline.length - 2] : null;
  const current = timeline.length >= 1 ? timeline[timeline.length - 1] : null;
  const events = [...row.events, ...localEvents];
  const view = caseFile ? buildCaseFileView(caseFile) : null;
  const decision = caseFile?.lead_decision ?? pendingDecision(row);

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ alignItems: { xs: "stretch", md: "center" } }}
      >
        <Tooltip title="Back to sessions">
          <IconButton
            aria-label="Back to sessions"
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
            Agent Session / {row.sessionId}
          </Typography>
          <Typography sx={{ fontWeight: 900 }} variant="h4">
            {row.listing_id}
          </Typography>
        </Box>
        <TagChip label={row.status} tone={row.status === "completed" ? "green" : row.status === "error" ? "red" : "slate"} />
      </Stack>

      {!caseFile && (
        <Alert severity={row.status === "error" ? "error" : "info"}>
          {row.status === "running"
            ? "This Agent session does not have a final TrustPatrol case file yet."
            : "No final TrustPatrolRootAgent JSON was found for this session."}
        </Alert>
      )}

      <DecisionHeader decision={decision} />

      <Box
        sx={{
          alignItems: "start",
          display: "grid",
          gap: 3,
          gridTemplateColumns: { xs: "1fr", lg: "minmax(280px, 0.75fr) minmax(640px, 1.65fr) minmax(260px, 0.7fr)" },
        }}
      >
        <Stack spacing={2}>
          <ChangeSummaryCard
            caseFile={caseFile}
            changedFields={row.changed_fields}
            current={current}
            listingId={row.listing_id}
            previous={previous}
          />
          <SpecialistEvidenceReview events={events} />
        </Stack>

        <Stack spacing={3}>
          {view ? (
            <>
              <DecisionSummary view={view} />
              <EvidenceLanes lanes={view.lanes} />
            </>
          ) : (
            <Alert severity="info">Evidence lanes will appear after the ADK run completes.</Alert>
          )}
        </Stack>

        <Stack spacing={3}>
          <AssessmentDecisionPanel
            decision={reviewDecision}
            disabled={!decision.human_review_required || !caseFile}
            leadDecision={decision}
            onDecision={onDecision}
            view={view}
          />
          {view && <EnforcementCard view={view} />}
        </Stack>
      </Box>
    </Stack>
  );
}

function DecisionHeader({ decision }: { decision: LeadDecision }) {
  return (
    <Card
      variant="outlined"
      sx={{
        background:
          decision.risk_level === "CRITICAL"
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
              Listing Risk: {decision.risk_level}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }} variant="body1">
              Recommended Action: {formatAction(decision.recommended_action)}
            </Typography>
          </Box>
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
            <RiskChip risk={decision.risk_level} />
            <TagChip label={`Confidence ${Math.round(decision.confidence * 100)}%`} tone="blue" />
            <TagChip
              label={decision.human_review_required ? "Human Review Required" : "Human Review Optional"}
              tone={decision.human_review_required ? "orange" : "green"}
            />
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function ChangeSummaryCard({
  caseFile,
  previous,
  current,
  changedFields,
  listingId,
}: {
  caseFile: Phase2CaseFile | null;
  previous: ListingVersion | null;
  current: ListingVersion | null;
  changedFields: ChangedField[];
  listingId: string;
}) {
  const signals = caseFile?.timeline_diff.signals;
  const isBaseline = Boolean(signals?.baseline_review || signals?.review_type === "baseline_review");

  if (isBaseline) {
    const version = current ?? previous;
    const facts = [
      ["listing", listingId],
      ["review type", signals?.review_type ?? "baseline_review"],
      ["status", version?.status ?? "created"],
      ["title", version?.title ?? "-"],
      ["brand", version?.brand ?? signals?.current_brand ?? "None"],
      ["price", formatPrice(version?.price ?? signals?.current_price)],
      ["image", version?.image_id ?? signals?.image_category ?? "-"],
      ["seller", version?.seller_id ?? "-"],
    ];

    return (
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={1.5}>
            <Stack direction="row" sx={{ justifyContent: "space-between" }}>
              <Box>
                <Typography color="primary" sx={{ fontWeight: 850 }} variant="overline">
                  Baseline Listing Summary
                </Typography>
                <Typography sx={{ fontWeight: 850 }} variant="h6">
                  Newly created listing review
                </Typography>
              </Box>
              <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75, justifyContent: "flex-end" }}>
                {changedFields.map((field) => (
                  <TagChip key={field} label={field} tone={fieldTone(field)} />
                ))}
              </Stack>
            </Stack>
            <Stack spacing={1}>
              {facts.map(([label, value]) => (
                <SummaryFact key={label} label={label} value={String(value)} />
              ))}
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (!previous || !current) {
    const fallbackFacts = timelineDiffFacts(caseFile);
    return (
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={1.5}>
            <Stack direction="row" sx={{ justifyContent: "space-between" }}>
              <Box>
                <Typography color="primary" sx={{ fontWeight: 850 }} variant="overline">
                  Timeline Diff Summary
                </Typography>
                <Typography sx={{ fontWeight: 850 }} variant="h6">
                  {caseFile?.timeline_diff.summary ?? "Timeline details unavailable"}
                </Typography>
              </Box>
              <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75, justifyContent: "flex-end" }}>
                {changedFields.map((field) => (
                  <TagChip key={field} label={field} tone={fieldTone(field)} />
                ))}
              </Stack>
            </Stack>
            {fallbackFacts.length ? (
              <Stack spacing={1}>
                {fallbackFacts.map(([label, value]) => (
                  <SummaryFact key={label} label={label} value={value} />
                ))}
              </Stack>
            ) : (
              <Alert severity="info">ADK did not return raw listing versions for this session.</Alert>
            )}
          </Stack>
        </CardContent>
      </Card>
    );
  }

  const fields = [
    ["title", previous.title ?? "-", current.title ?? "-"],
    ["description", previous.description ?? "-", current.description ?? "-"],
    ["brand", previous.brand ?? "None", current.brand ?? "None"],
    ["price", formatPrice(previous.price), formatPrice(current.price)],
    ["image", previous.image_id ?? "-", current.image_id ?? "-"],
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
                v{previous.version} to v{current.version}
              </Typography>
            </Box>
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75, justifyContent: "flex-end" }}>
              {changedFields.map((field) => (
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

function SummaryFact({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ bgcolor: "grey.50", border: 1, borderColor: "divider", borderRadius: 2, p: 1.25 }}>
      <Typography color="text.secondary" sx={{ fontWeight: 850 }} variant="caption">
        {label}
      </Typography>
      <Typography sx={{ overflowWrap: "anywhere" }} variant="body2">
        {value}
      </Typography>
    </Box>
  );
}

function SpecialistEvidenceReview({ events }: { events: AgentEvent[] }) {
  return (
    <Accordion disableGutters variant="outlined">
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography sx={{ fontWeight: 850 }} variant="subtitle2">
            Specialist Evidence Review
          </Typography>
          <Typography color="text.secondary" variant="caption">
            {events.length} runtime events available
          </Typography>
        </Box>
        <TagChip label="ADK" tone="blue" />
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={1}>
          {events.length === 0 ? (
            <Alert severity="info">No ADK events were returned for this session.</Alert>
          ) : (
            events.map((event) => {
              const title = formatRuntimeEventTitle(event);
              const message = formatRuntimeEventMessage(event);
              return (
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
                    {title}
                  </Typography>
                  {message && (
                    <Typography color="text.secondary" variant="caption">
                      {message}
                    </Typography>
                  )}
                </Box>
              );
            })
          )}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

function DecisionSummary({ view }: { view: CaseFileView }) {
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
            {view.topReasons.map((reason, index) => (
              <ListItem key={`${reason}-${index}`} sx={{ alignItems: "flex-start" }}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <TagChip label={String(index + 1)} tone="orange" />
                </ListItemIcon>
                <ListItemText primary={reason} />
              </ListItem>
            ))}
          </List>
          <Alert severity="info">{view.policyReasoning}</Alert>
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
            {lanes.map((lane, index) => (
              <Accordion defaultExpanded={index === 0} disableGutters key={lane.title} variant="outlined">
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
  view,
  leadDecision,
  decision,
  disabled,
  onDecision,
}: {
  view: CaseFileView | null;
  leadDecision: LeadDecision;
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
                {leadDecision.final_risk_score}
              </Typography>
              <RiskChip risk={leadDecision.risk_level} />
            </Box>
            <Typography color="text.secondary" variant="body2">
              {formatAction(leadDecision.recommended_action)}
            </Typography>
          </Box>
          <Alert severity={leadDecision.risk_level === "CRITICAL" ? "warning" : "info"}>
            {leadDecision.decision_reasoning[0] ?? "Recommended action follows the current evidence strength."}
          </Alert>
          <Typography color="text.secondary" variant="caption">
            {view?.falsePositiveGuardrail ??
              "This is not a final guilt finding. Seller verification, appeal evidence, or reviewer override can change the outcome."}
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

function EnforcementCard({ view }: { view: CaseFileView }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography color="primary" sx={{ fontWeight: 850 }} variant="overline">
          Enforcement Context
        </Typography>
        <List dense>
          {view.enforcementFacts.map((fact) => (
            <ListItem key={fact} sx={{ px: 0 }}>
              <ListItemIcon sx={{ minWidth: 34 }}>
                <FactCheckIcon color="primary" fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={fact} />
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );
}

function buildCaseFileView(caseFile: Phase2CaseFile): CaseFileView {
  const decision = caseFile.lead_decision;
  const timelineFacts = timelineFactsFromCase(caseFile);
  const lanes = [
    ...caseFile.specialist_findings.map(evidenceLaneFromFinding),
    {
      title: "Timeline Evidence",
      severity: riskFromChangedFields(caseFile.timeline_diff.changed_fields),
      tone: "teal" as TagTone,
      summary: caseFile.timeline_diff.summary,
      facts: timelineFacts,
    },
  ];

  return {
    lanes,
    topReasons: decision.top_evidence.length ? decision.top_evidence : decision.decision_reasoning,
    policyReasoning:
      decision.policy_buckets.length || decision.decision_reasoning.length
        ? [...decision.policy_buckets, ...decision.decision_reasoning].join(" ")
        : "The recommendation is calibrated to the available evidence.",
    falsePositiveGuardrail:
      "This is not a final guilt finding. Seller verification, appeal evidence, or reviewer override can reverse, narrow, or downgrade the action to avoid wrongly penalizing legitimate sellers.",
    enforcementFacts: formatEnforcementSentences(caseFile.enforcement_action_log),
  };
}

function evidenceLaneFromFinding(finding: SpecialistFinding): EvidenceLane {
  return {
    title: agentTitle(finding.agent),
    severity: finding.risk_level,
    tone: riskTone(finding.risk_level),
    summary: cleanEvidenceText(finding.finding),
    facts: [
      ...finding.evidence.map(cleanEvidenceText),
      cleanUncertaintyText(finding.uncertainty),
    ].filter(Boolean),
  };
}

function timelineFactsFromCase(caseFile: Phase2CaseFile): string[] {
  const signals = caseFile.timeline_diff.signals;
  const facts = [
    caseFile.timeline_diff.changed_fields.length
      ? `Changed fields: ${caseFile.timeline_diff.changed_fields.join(", ")}.`
      : "No material listing-field changes detected.",
  ];
  if (signals.brand_added) facts.push(`Brand changed from ${signals.previous_brand ?? "None"} to ${signals.brand_added_value}.`);
  if ((signals.price_drop_pct ?? 0) > 0) facts.push(`Price dropped ${signals.price_drop_pct}%.`);
  if ((signals.counterfeit_keywords ?? []).length) facts.push(`Replica-associated terms: ${signals.counterfeit_keywords?.join(", ")}.`);
  if (signals.image_swapped) facts.push("Image changed after approval.");
  if (signals.post_approval_edit) facts.push("Listing was edited after approval.");
  return facts;
}

function timelineDiffFacts(caseFile: Phase2CaseFile | null): Array<[string, string]> {
  if (!caseFile) return [];
  const signals = caseFile.timeline_diff.signals;
  return [
    ["listing", caseFile.listing_id],
    ["review type", signals.review_type ?? "-"],
    ["changed fields", caseFile.timeline_diff.changed_fields.join(", ") || "-"],
    ["previous brand", signals.previous_brand ?? "None"],
    ["current brand", signals.current_brand ?? "None"],
    ["previous price", formatPrice(signals.previous_price)],
    ["current price", formatPrice(signals.current_price)],
    ["price drop", `${signals.price_drop_pct ?? 0}%`],
    ["keywords", signals.counterfeit_keywords?.join(", ") || "None"],
    ["image category", signals.image_category ?? "-"],
  ];
}

function formatEnforcementSentences(log: Phase2CaseFile["enforcement_action_log"]): string[] {
  const actionSentences = log.actions.map(formatActionSentence);
  const queueSentence =
    !log.review_queue || log.review_queue === "None"
      ? "No review queue is needed."
      : `The case should go to the ${stripTrailingPeriod(log.review_queue)} queue.`;
  const sellerSentence = isNoMessage(log.seller_message_summary)
    ? "No seller message is needed."
    : `The seller message should say: ${stripTrailingPeriod(log.seller_message_summary)}.`;
  const auditSentence = log.audit_log_summary
    ? `The audit log records that ${lowercaseFirst(stripTrailingPeriod(log.audit_log_summary))}.`
    : "The audit log should be updated.";

  return uniqueSentences([...actionSentences, queueSentence, sellerSentence, auditSentence]);
}

function formatActionSentence(action: Phase2CaseFile["enforcement_action_log"]["actions"][number]): string {
  if (action.action === "ALLOW_LISTING") return "The listing can remain live.";
  if (action.action === "TEMPORARY_SUPPRESSION") return "The listing should be temporarily suppressed pending review.";
  if (action.action === "CREATE_REVIEW_TICKET") return "A human review ticket should be created.";
  if (action.action === "REQUEST_SELLER_VERIFICATION") return "Seller verification should be requested.";
  if (action.action === "MONITOR_LISTING") return "The listing should be monitored.";
  return `${formatAction(action.action)} should be recorded.`;
}

function formatRuntimeEventTitle(event: AgentEvent): string {
  if (event.type === "human_review_decision") return "Human decision recorded";
  if (event.type === "final_recommendation") return "Final case file ready";
  if (event.agent === "TimelineDiffAgent") return "Timeline checked";
  if (event.agent === "InvestigationRouterAgent") return "Evidence routing complete";
  if (event.agent === "LeadAdjudicatorAgent") return "Risk decision prepared";
  if (event.agent === "EnforcementActionAgent") return "Enforcement guidance prepared";
  if (event.agent === "BrandProtectionAgent") return "Brand evidence reviewed";
  if (event.agent === "PricingAgent") return "Pricing evidence reviewed";
  if (event.agent === "VisualEvidenceAgent") return "Visual evidence reviewed";
  if (event.agent === "SellerTrustAgent") return "Seller trust reviewed";
  if (event.agent === "ReviewIntegrityAgent") return "Review integrity checked";
  if (event.agent === "TrustPatrolRootAgent") return event.type === "agent_started" ? "Case review started" : "Case review updated";
  return cleanEventTitle(event.title);
}

function formatRuntimeEventMessage(event: AgentEvent): string {
  const message = event.message?.trim();
  if (!message) return "";
  if (message.includes("Investigate this listing timeline")) return "Listing timeline submitted for review.";
  if (message.includes("Computing listing timeline")) return "Checking what changed in the listing.";
  if (message.includes("Routing the case")) return "Choosing the evidence checks needed for this case.";
  if (message.includes("Combining specialist evidence")) return "Preparing the final risk recommendation.";
  if (message.includes("Preparing simulated enforcement")) return "Preparing suggested follow-up actions.";
  if (message.startsWith("{") || message.startsWith("[")) return "Structured case data was received.";
  return truncateSentence(cleanEvidenceText(message), 140);
}

function cleanEvidenceText(value: string) {
  return stripTrailingPeriod(value.replace(/\s+/g, " ").trim()) + ".";
}

function cleanUncertaintyText(value: string) {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.toLowerCase().includes("does not prove")) return "This evidence is a risk signal, not proof on its own.";
  if (text.toLowerCase().includes("insufficient")) return "This evidence should be combined with other signals.";
  return truncateSentence(cleanEvidenceText(text), 150);
}

function cleanEventTitle(value: string) {
  return value
    .replace("TrustPatrolRootAgent event", "Case review updated")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace("Agent event", "updated")
    .trim();
}

function truncateSentence(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trim()}…`;
}

function stripTrailingPeriod(value: string) {
  return value.trim().replace(/[.。]+$/, "");
}

function lowercaseFirst(value: string) {
  return value ? value.charAt(0).toLowerCase() + value.slice(1) : value;
}

function isNoMessage(value: string) {
  return !value || value.toLowerCase().includes("no seller message");
}

function uniqueSentences(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function pendingDecision(row: ReviewQueueRow): LeadDecision {
  return {
    agent: "LeadAdjudicatorAgent",
    status: row.status,
    final_risk_score: row.final_risk_score ?? 0,
    risk_level: row.risk_level,
    confidence: 0,
    recommended_action: row.recommended_action,
    policy_buckets: [],
    top_evidence: [],
    agent_consensus: {},
    decision_reasoning: [],
    human_review_required: false,
  };
}

function riskFromChangedFields(fields: ChangedField[]): RiskLevel {
  if (fields.includes("brand") || fields.includes("keywords")) return "HIGH";
  if (fields.includes("price") || fields.includes("image")) return "MEDIUM";
  return fields.length ? "LOW" : "LOW";
}

function RiskChip({ risk }: { risk: RiskLevel }) {
  return <TagChip label={risk} tone={riskTone(risk)} />;
}

function agentTitle(agent: string) {
  return agent
    .replace("Agent", " Evidence")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace("Brand Protection", "Brand & Policy")
    .replace("Visual Evidence Evidence", "Visual Evidence")
    .replace("Seller Trust", "Seller Trust")
    .trim();
}

function formatPrice(value?: number) {
  return typeof value === "number" ? `$${value}` : "-";
}

function formatAction(value: string) {
  return value.replaceAll("_", " ");
}

export default App;
