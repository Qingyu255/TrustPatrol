import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import VisibilityIcon from "@mui/icons-material/Visibility";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { TagChip, fieldTone, riskTone } from "./TagChip";
import type { ChangedField, ReviewQueueRow, RiskLevel } from "../types";

type Props = {
  rows: ReviewQueueRow[];
  isLoading: boolean;
  error: string | null;
  onOpenRow: (row: ReviewQueueRow) => void;
  onRefresh: () => void;
};

type RiskFilter = "All" | Exclude<RiskLevel, "PENDING"> | "PENDING";
type TimeFilter = "all" | "1h" | "6h" | "today";
type ActionFilter = "All" | string;
type ChangedFieldFilter = "all" | ChangedField;

const riskFilters: RiskFilter[] = ["All", "CRITICAL", "HIGH", "MEDIUM", "LOW", "PENDING"];
const changedFieldOptions: Array<{ label: string; value: ChangedFieldFilter }> = [
  { label: "All changes", value: "all" },
  { label: "Brand", value: "brand" },
  { label: "Price", value: "price" },
  { label: "Image", value: "image" },
  { label: "Text", value: "text" },
  { label: "Keywords", value: "keywords" },
  { label: "Status", value: "status" },
];

export function ListingsPage({ rows, isLoading, error, onOpenRow, onRefresh }: Props) {
  const [risk, setRisk] = useState<RiskFilter>("All");
  const [changedField, setChangedField] = useState<ChangedFieldFilter>("all");
  const [timeframe, setTimeframe] = useState<TimeFilter>("all");
  const [action, setAction] = useState<ActionFilter>("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const anchorTime = useMemo(
    () => Math.max(Date.now(), ...rows.map((row) => row.last_update_time * 1000)),
    [rows],
  );
  const actions = useMemo(
    () => ["All", ...Array.from(new Set(rows.map((row) => row.recommended_action)))],
    [rows],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const haystack = `${row.listing_id} ${row.sessionId} ${row.signal_tags.join(" ")}`.toLowerCase();
      return (
        (risk === "All" || row.risk_level === risk) &&
        (changedField === "all" || row.changed_fields.includes(changedField)) &&
        (action === "All" || row.recommended_action === action) &&
        (!query || haystack.includes(query)) &&
        isWithinTimeframe(row.last_update_time, timeframe, anchorTime)
      );
    });
  }, [action, anchorTime, changedField, risk, rows, search, timeframe]);

  const visibleRows = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  function resetPage() {
    setPage(0);
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" } }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography color="primary" sx={{ fontWeight: 850 }} variant="overline">
            Review Queue
          </Typography>
          <Typography sx={{ fontWeight: 800 }} variant="h4">
            ADK investigation sessions
          </Typography>
        </Box>
        <Tooltip title="Refresh sessions">
          <span>
            <IconButton aria-label="Refresh sessions" disabled={isLoading} onClick={onRefresh}>
              <RefreshIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      <Card variant="outlined">
        <CardContent>
          <Stack direction={{ xs: "column", lg: "row" }} spacing={2}>
            <TextField
              label="Listing or session"
              onChange={(event) => {
                setSearch(event.target.value);
                resetPage();
              }}
              size="small"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
              value={search}
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <Select
                displayEmpty
                onChange={(event) => {
                  setRisk(event.target.value as RiskFilter);
                  resetPage();
                }}
                value={risk}
              >
                {riskFilters.map((item) => (
                  <MenuItem key={item} value={item}>
                    Risk: {item}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 190 }}>
              <Select
                onChange={(event) => {
                  setTimeframe(event.target.value as TimeFilter);
                  resetPage();
                }}
                value={timeframe}
              >
                <MenuItem value="all">Updated: All time</MenuItem>
                <MenuItem value="1h">Updated: Past 1 hour</MenuItem>
                <MenuItem value="6h">Updated: Past 6 hours</MenuItem>
                <MenuItem value="today">Updated: Today</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 190 }}>
              <Select
                onChange={(event) => {
                  setChangedField(event.target.value as ChangedFieldFilter);
                  resetPage();
                }}
                value={changedField}
              >
                {changedFieldOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    Changes: {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 260 }}>
              <Select
                onChange={(event) => {
                  setAction(event.target.value);
                  resetPage();
                }}
                value={action}
              >
                {actions.map((item) => (
                  <MenuItem key={item} value={item}>
                    Action: {item === "All" ? item : formatAction(item)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </CardContent>
      </Card>

      <Paper elevation={0} sx={{ border: 1, borderColor: "divider", overflow: "hidden" }}>
        <TableContainer>
          <Table aria-label="ADK sessions review queue" size="medium">
            <TableHead>
              <TableRow>
                <TableCell>Listing</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell>Risk</TableCell>
                <TableCell>Score</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Changes</TableCell>
                <TableCell>Signals</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Open</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleRows.map((row) => (
                <TableRow hover key={row.sessionId}>
                  <TableCell sx={{ maxWidth: 280 }}>
                    <Typography sx={{ fontWeight: 800 }}>{row.listing_id}</Typography>
                    <Typography color="text.secondary" variant="body2">
                      {row.userId} / {row.sessionId}
                    </Typography>
                  </TableCell>
                  <TableCell>{formatTime(row.last_update_time)}</TableCell>
                  <TableCell>
                    <RiskChip risk={row.risk_level} />
                  </TableCell>
                  <TableCell>{row.final_risk_score ?? "-"}</TableCell>
                  <TableCell>{formatAction(row.recommended_action)}</TableCell>
                  <TableCell>
                    <TagStack labels={row.changed_fields} toneFor={fieldTone} />
                  </TableCell>
                  <TableCell>
                    <TagStack labels={row.signal_tags} />
                  </TableCell>
                  <TableCell>
                    <TagChip label={row.status} tone={row.status === "completed" ? "green" : row.status === "error" ? "red" : "slate"} />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      endIcon={<VisibilityIcon />}
                      onClick={() => onOpenRow(row)}
                      size="small"
                      variant="contained"
                    >
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && visibleRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9}>
                    <Alert severity="info">No ADK sessions match the current filters.</Alert>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={filtered.length}
          onPageChange={(_, nextPage) => setPage(nextPage)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(Number(event.target.value));
            setPage(0);
          }}
          page={page}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[5, 10, 25]}
        />
      </Paper>
    </Stack>
  );
}

function TagStack({
  labels,
  toneFor = () => "slate",
}: {
  labels: string[];
  toneFor?: (label: string) => Parameters<typeof TagChip>[0]["tone"];
}) {
  return (
    <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
      {labels.length ? (
        labels.map((label) => <TagChip key={label} label={label} tone={toneFor(label)} />)
      ) : (
        <Typography color="text.secondary" variant="body2">
          -
        </Typography>
      )}
    </Stack>
  );
}

function RiskChip({ risk }: { risk: RiskLevel }) {
  return <TagChip label={risk} tone={riskTone(risk)} />;
}

function isWithinTimeframe(lastUpdateTime: number, timeframe: TimeFilter, anchorTime: number) {
  if (timeframe === "all" || !lastUpdateTime) return true;
  const time = lastUpdateTime * 1000;
  if (timeframe === "1h") return anchorTime - time <= 60 * 60 * 1000;
  if (timeframe === "6h") return anchorTime - time <= 6 * 60 * 60 * 1000;
  const date = new Date(time);
  const anchor = new Date(anchorTime);
  return (
    date.getFullYear() === anchor.getFullYear() &&
    date.getMonth() === anchor.getMonth() &&
    date.getDate() === anchor.getDate()
  );
}

function formatTime(value: number) {
  if (!value) return "-";
  return new Date(value * 1000).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAction(value: string) {
  return value.replaceAll("_", " ");
}
