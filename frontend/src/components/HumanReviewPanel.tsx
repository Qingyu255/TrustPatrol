import GavelIcon from "@mui/icons-material/Gavel";
import {
  Button,
  Card,
  CardContent,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import type { ReviewDecision } from "../types";

type Props = {
  decision: ReviewDecision | null;
  disabled: boolean;
  onDecision: (decision: ReviewDecision) => void;
};

const decisions: ReviewDecision[] = [
  "Approve AI Action",
  "Override To Allow",
  "Request Verification",
  "Escalate To Investigator",
  "Mark False Positive",
];

export function HumanReviewPanel({ decision, disabled, onDecision }: Props) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1.25}>
            <GavelIcon color="primary" />
            <div>
              <Typography color="text.secondary" sx={{ fontWeight: 700 }} variant="overline">
                Human Review
              </Typography>
              <Typography sx={{ fontWeight: 850 }} variant="h6">
                {decision ?? "Awaiting reviewer decision"}
              </Typography>
            </div>
          </Stack>

          <ToggleButtonGroup
            exclusive
            fullWidth
            onChange={(_, value: ReviewDecision | null) => {
              if (value) onDecision(value);
            }}
            orientation="vertical"
            value={decision}
          >
            {decisions.map((item) => (
              <ToggleButton disabled={disabled} key={item} value={item}>
                {item}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          {decision && (
            <Button color="success" startIcon={<GavelIcon />} variant="contained">
              Decision recorded
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
