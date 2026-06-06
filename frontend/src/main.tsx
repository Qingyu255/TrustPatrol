import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import App from "./App";
import "./styles.css";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#ee4d2d",
      light: "#ff8a5c",
      dark: "#b83216",
    },
    secondary: {
      main: "#111827",
    },
    background: {
      default: "#f7f8fb",
      paper: "#ffffff",
    },
    text: {
      primary: "#111827",
      secondary: "#64748b",
    },
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    button: {
      fontWeight: 800,
      textTransform: "none",
    },
    h4: {
      letterSpacing: 0,
      color: "#111827",
      fontWeight: 900,
    },
    h6: {
      letterSpacing: 0,
      color: "#111827",
      fontWeight: 850,
    },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderColor: "#e8edf3",
          boxShadow: "0 10px 32px rgba(17, 24, 39, 0.06)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: "#f8fafc",
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          fontWeight: 850,
          textTransform: "none",
        },
      },
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
);
