// A "Field Ledger"-like demo theme for stories (template-react's
// docs/design direction: warm paper, vermilion, bottle green, 2px radius).
// It is not part of the package: the library is theme-agnostic and reads only
// the MUI theme it is given. Raw colors are fine here, outside src/.
import { createTheme } from "@mui/material/styles";

const light = {
  primary: { main: "#B3361B", contrastText: "#FFF8EE" },
  secondary: { main: "#2F4A3A", contrastText: "#FFF8EE" },
  error: { main: "#9E1C1C", contrastText: "#FFF8EE" },
  warning: { main: "#8A5300", contrastText: "#FFF8EE" },
  info: { main: "#2D5F86", contrastText: "#FFF8EE" },
  success: { main: "#2F6B3C", contrastText: "#FFF8EE" },
  background: { default: "#F6EFE2", paper: "#FBF7EE" },
  text: { primary: "#231C14", secondary: "#5E5242" },
  divider: "#D9CDB6",
};

const dark = {
  primary: { main: "#E8795C", contrastText: "#1B1510" },
  secondary: { main: "#9CC0A8", contrastText: "#1B1510" },
  error: { main: "#F08A7E", contrastText: "#1B1510" },
  warning: { main: "#E0A94A", contrastText: "#1B1510" },
  info: { main: "#8FB6DA", contrastText: "#1B1510" },
  success: { main: "#8CC79B", contrastText: "#1B1510" },
  background: { default: "#1B1510", paper: "#241D16" },
  text: { primary: "#F1E7D3", secondary: "#B8AA92" },
  divider: "#3D3328",
};

export const demoTheme = createTheme({
  cssVariables: { colorSchemeSelector: "data" },
  colorSchemes: { light: { palette: light }, dark: { palette: dark } },
  shape: { borderRadius: 2 },
  typography: {
    fontFamily: 'system-ui, "Helvetica Neue", Arial, sans-serif',
    h1: { fontFamily: "Georgia, serif", fontWeight: 600 },
    h2: { fontFamily: "Georgia, serif", fontWeight: 600 },
    h4: { fontFamily: "Georgia, serif", fontWeight: 600 },
    h6: { fontFamily: "Georgia, serif", fontWeight: 600 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiChip: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: "transparent",
          border: `1px solid ${theme.vars.palette.divider}`,
        }),
      },
    },
  },
});
