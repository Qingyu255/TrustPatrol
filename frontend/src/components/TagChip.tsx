import { Chip, type ChipProps } from "@mui/material";

export type TagTone =
  | "orange"
  | "red"
  | "blue"
  | "green"
  | "purple"
  | "teal"
  | "amber"
  | "pink"
  | "slate";

const toneStyles: Record<TagTone, { bg: string; border: string; color: string }> = {
  orange: { bg: "#fff2e8", border: "#ffb27a", color: "#c94610" },
  red: { bg: "#fff0f0", border: "#ff9d9d", color: "#b42318" },
  blue: { bg: "#eef5ff", border: "#9fc5ff", color: "#1d5fbf" },
  green: { bg: "#ecfdf3", border: "#9bdcb2", color: "#087443" },
  purple: { bg: "#f4f0ff", border: "#c8b6ff", color: "#5a35b1" },
  teal: { bg: "#eafbf8", border: "#90ddd2", color: "#08786c" },
  amber: { bg: "#fff8db", border: "#f2d36b", color: "#8a6100" },
  pink: { bg: "#fff0f7", border: "#f3aad0", color: "#a1266b" },
  slate: { bg: "#f2f5f8", border: "#cbd5df", color: "#3f4f5f" },
};

type Props = Omit<ChipProps, "color" | "variant"> & {
  tone?: TagTone;
};

export function TagChip({ tone = "slate", sx, ...props }: Props) {
  const colors = toneStyles[tone];
  return (
    <Chip
      size="small"
      {...props}
      sx={{
        bgcolor: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.color,
        fontWeight: 850,
        "& .MuiChip-icon": {
          color: colors.color,
        },
        ...sx,
      }}
    />
  );
}

export function riskTone(risk: string): TagTone {
  if (risk === "CRITICAL") return "red";
  if (risk === "HIGH") return "orange";
  if (risk === "MEDIUM") return "amber";
  if (risk === "LOW") return "green";
  return "slate";
}

export function fieldTone(field: string): TagTone {
  if (field === "brand") return "purple";
  if (field === "price") return "amber";
  if (field === "image") return "blue";
  if (field === "text") return "teal";
  if (field === "keywords") return "pink";
  if (field === "created_listing") return "green";
  return "slate";
}
