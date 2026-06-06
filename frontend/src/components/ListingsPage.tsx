import SearchIcon from "@mui/icons-material/Search";
import VisibilityIcon from "@mui/icons-material/Visibility";
import {
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
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
  Tabs,
  Tab,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { TagChip, categoryTone, fieldTone, riskTone } from "./TagChip";
import type { ChangedField, DemoScenario, MarketplaceCategory, RiskLevel } from "../types";

type Props = {
  scenarios: DemoScenario[];
  onOpenScenario: (scenario: DemoScenario) => void;
};

type CategoryFilter = "All" | MarketplaceCategory;
type RiskFilter = "All" | Exclude<RiskLevel, "PENDING">;
type TimeFilter = "all" | "1h" | "6h" | "today";
type ActionFilter = "All" | string;
type ChangedFieldFilter = "all" | ChangedField;

const categories: CategoryFilter[] = ["All", "Electronics", "Bags & Luxury", "Fashion", "Footwear"];
const riskFilters: RiskFilter[] = ["All", "CRITICAL", "HIGH", "MEDIUM", "LOW"];
const changedFieldOptions: Array<{ label: string; value: ChangedFieldFilter }> = [
  { label: "All changes", value: "all" },
  { label: "Brand", value: "brand" },
  { label: "Price", value: "price" },
  { label: "Image", value: "image" },
  { label: "Text", value: "text" },
  { label: "Keywords", value: "keywords" },
];
const counterfeitKeywords = ["OEM", "1:1", "1-1", "AAA", "mirror", "factory batch", "replica", "no receipt"];

export function ListingsPage({ scenarios, onOpenScenario }: Props) {
  const [category, setCategory] = useState<CategoryFilter>("All");
  const [risk, setRisk] = useState<RiskFilter>("All");
  const [changedField, setChangedField] = useState<ChangedFieldFilter>("all");
  const [timeframe, setTimeframe] = useState<TimeFilter>("all");
  const [action, setAction] = useState<ActionFilter>("All");
  const [sellerSearch, setSellerSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const anchorTime = useMemo(
    () => Math.max(...scenarios.map((scenario) => latestDate(scenario).getTime())),
    [scenarios],
  );
  const actions = useMemo(
    () => ["All", ...Array.from(new Set(scenarios.map((scenario) => scenario.expected_action)))],
    [scenarios],
  );

  const filtered = useMemo(() => {
    return scenarios.filter((scenario) => {
      const latest = scenario.versions[scenario.versions.length - 1];
      const changedFields = getChangedFields(scenario);
      const latestTime = latestDate(scenario);
      const sellerMatch = latest.seller_id.toLowerCase().includes(sellerSearch.trim().toLowerCase());

      return (
        (category === "All" || scenario.category === category) &&
        (risk === "All" || scenario.expected_risk === risk) &&
        (changedField === "all" || changedFields.includes(changedField)) &&
        (action === "All" || scenario.expected_action === action) &&
        sellerMatch &&
        isWithinTimeframe(latestTime, timeframe, anchorTime)
      );
    });
  }, [action, anchorTime, category, changedField, risk, scenarios, sellerSearch, timeframe]);

  const visibleRows = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  function resetPage() {
    setPage(0);
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography color="primary" sx={{ fontWeight: 850 }} variant="overline">
          Review Queue
        </Typography>
        <Typography sx={{ fontWeight: 800 }} variant="h4">
          Listings created or edited after approval
        </Typography>
      </Box>

      <Card variant="outlined">
        <CardContent>
          <Tabs
            aria-label="Listing categories"
            onChange={(_, value: CategoryFilter) => {
              setCategory(value);
              resetPage();
            }}
            value={category}
            variant="scrollable"
          >
            {categories.map((item) => (
              <Tab
                key={item}
                label={`${item} (${countByCategory(scenarios, item)})`}
                value={item}
              />
            ))}
          </Tabs>

          <Stack direction={{ xs: "column", lg: "row" }} spacing={2} sx={{ mt: 2 }}>
            <TextField
              slotProps={{
                input: {
                  startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                  ),
                },
              }}
              label="Seller ID"
              onChange={(event) => {
                setSellerSearch(event.target.value);
                resetPage();
              }}
              size="small"
              value={sellerSearch}
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
                <MenuItem value="all">Edited: All time</MenuItem>
                <MenuItem value="1h">Edited: Past 1 hour</MenuItem>
                <MenuItem value="6h">Edited: Past 6 hours</MenuItem>
                <MenuItem value="today">Edited: Today</MenuItem>
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

          <Box sx={{ mt: 2, overflowX: "auto" }}>
            <ToggleButtonGroup
              exclusive
              onChange={(_, value: ChangedFieldFilter | null) => {
                if (!value) return;
                setChangedField(value);
                resetPage();
              }}
              size="small"
              value={changedField}
            >
              {changedFieldOptions.map((option) => (
                <ToggleButton key={option.value} value={option.value}>
                  {option.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        </CardContent>
      </Card>

      <Paper elevation={0} sx={{ border: 1, borderColor: "divider", overflow: "hidden" }}>
        <TableContainer>
          <Table aria-label="Listings review queue" size="medium">
            <TableHead>
              <TableRow>
                <TableCell>Listing</TableCell>
                <TableCell>Seller</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Latest Edit</TableCell>
                <TableCell>Changes</TableCell>
                <TableCell>Risk</TableCell>
                <TableCell>Action</TableCell>
                <TableCell align="right">Open</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleRows.map((scenario) => {
                const latest = scenario.versions[scenario.versions.length - 1];
                const changedFields = getChangedFields(scenario);
                return (
                  <TableRow hover key={scenario.id}>
                    <TableCell sx={{ maxWidth: 310 }}>
                      <Typography sx={{ fontWeight: 800 }}>{scenario.listing_id}</Typography>
                      <Typography color="text.secondary" variant="body2">
                        {latest.title}
                      </Typography>
                    </TableCell>
                    <TableCell>{latest.seller_id}</TableCell>
                    <TableCell>
                      <TagChip label={scenario.category} tone={categoryTone(scenario.category)} />
                    </TableCell>
                    <TableCell>{formatTime(latest.updated_at)}</TableCell>
                    <TableCell>
                      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
                        {changedFields.map((field) => (
                          <TagChip key={field} label={field} tone={fieldTone(field)} />
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <RiskChip risk={scenario.expected_risk} />
                    </TableCell>
                    <TableCell>{formatAction(scenario.expected_action)}</TableCell>
                    <TableCell align="right">
                      <Button
                        endIcon={<VisibilityIcon />}
                        onClick={() => onOpenScenario(scenario)}
                        size="small"
                        variant="contained"
                      >
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
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

function RiskChip({ risk }: { risk: RiskLevel }) {
  return <TagChip label={risk} tone={riskTone(risk)} />;
}

function countByCategory(scenarios: DemoScenario[], category: CategoryFilter) {
  if (category === "All") return scenarios.length;
  return scenarios.filter((scenario) => scenario.category === category).length;
}

export function getChangedFields(scenario: DemoScenario): ChangedField[] {
  const [previous, current] = scenario.versions;
  const fields = new Set<ChangedField>();
  if ((previous.brand ?? "") !== (current.brand ?? "")) fields.add("brand");
  if (previous.price !== current.price) fields.add("price");
  if (previous.image_id !== current.image_id) fields.add("image");
  if (previous.title !== current.title || previous.description !== current.description) fields.add("text");

  const previousText = `${previous.title} ${previous.description}`.toLowerCase();
  const currentText = `${current.title} ${current.description}`.toLowerCase();
  if (
    counterfeitKeywords.some(
      (keyword) => currentText.includes(keyword.toLowerCase()) && !previousText.includes(keyword.toLowerCase()),
    )
  ) {
    fields.add("keywords");
  }
  return Array.from(fields);
}

function latestDate(scenario: DemoScenario) {
  const latest = scenario.versions[scenario.versions.length - 1];
  return new Date(latest.updated_at ?? latest.created_at ?? "2026-06-06T00:00:00+08:00");
}

function isWithinTimeframe(date: Date, timeframe: TimeFilter, anchorTime: number) {
  if (timeframe === "all") return true;
  if (timeframe === "1h") return anchorTime - date.getTime() <= 60 * 60 * 1000;
  if (timeframe === "6h") return anchorTime - date.getTime() <= 6 * 60 * 60 * 1000;
  const anchor = new Date(anchorTime);
  return (
    date.getFullYear() === anchor.getFullYear() &&
    date.getMonth() === anchor.getMonth() &&
    date.getDate() === anchor.getDate()
  );
}

function formatTime(value?: string) {
  if (!value) return "Today";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatAction(value: string) {
  return value.replaceAll("_", " ");
}
