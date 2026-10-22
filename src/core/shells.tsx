// Layout shells: the frames views render into. Styled with theme tokens only.
import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Drawer from "@mui/material/Drawer";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useId, type ReactElement, type ReactNode } from "react";

/** Props every shell shares. */
export interface ShellProps {
  readonly title: ReactNode;
  /** Buttons for the footer (dialog, drawer) or the header (page). */
  readonly actions?: ReactNode;
  readonly children?: ReactNode;
}

export interface PageShellProps extends ShellProps {
  readonly subtitle?: ReactNode;
  /** Links shown above the title, e.g. `[<Link>Heroes</Link>]`. */
  readonly breadcrumbs?: readonly ReactNode[] | undefined;
  readonly maxWidth?: "sm" | "md" | "lg" | "xl" | false;
}

/** A full page: heading row (title, subtitle, actions) above the content. */
export function PageShell({
  title,
  subtitle,
  actions,
  breadcrumbs,
  maxWidth = "lg",
  children,
}: PageShellProps): ReactElement {
  return (
    <Container component="main" maxWidth={maxWidth} sx={{ py: 3 }}>
      {breadcrumbs !== undefined && breadcrumbs.length > 0 && (
        <Breadcrumbs aria-label="Breadcrumb" sx={{ mb: 1 }}>
          {breadcrumbs.map((crumb, index) => (
            <Box key={index} component="span">
              {crumb}
            </Box>
          ))}
        </Breadcrumbs>
      )}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{
          alignItems: { sm: "center" },
          justifyContent: "space-between",
          mb: 3,
        }}
      >
        <Box>
          <Typography component="h1" variant="h4">
            {title}
          </Typography>
          {subtitle !== undefined && (
            <Typography variant="body1" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        {actions !== undefined && (
          <Stack direction="row" spacing={1}>
            {actions}
          </Stack>
        )}
      </Stack>
      {children}
    </Container>
  );
}

export interface OverlayShellProps extends ShellProps {
  readonly open: boolean;
  readonly onClose: () => void;
  /** Label of the close button that is always present. Default "Close". */
  readonly closeLabel?: string;
}

export interface DialogShellProps extends OverlayShellProps {
  readonly maxWidth?: "xs" | "sm" | "md" | "lg";
}

/** A modal dialog with a title, scrolling content and a footer of actions. */
export function DialogShell({
  open,
  onClose,
  title,
  actions,
  closeLabel = "Close",
  maxWidth = "sm",
  children,
}: DialogShellProps): ReactElement {
  const titleId = useId();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth={maxWidth}
      aria-labelledby={titleId}
    >
      <DialogTitle id={titleId}>{title}</DialogTitle>
      <DialogContent dividers>{children}</DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{closeLabel}</Button>
        {actions}
      </DialogActions>
    </Dialog>
  );
}

export interface DrawerShellProps extends OverlayShellProps {
  readonly anchor?: "left" | "right";
  /** Width in theme spacing units on screens from `sm` up (full width below). Default 60. */
  readonly width?: number;
}

/** A side drawer with a title, scrolling content and a footer of actions. */
export function DrawerShell({
  open,
  onClose,
  title,
  actions,
  closeLabel = "Close",
  anchor = "right",
  width = 60,
  children,
}: DrawerShellProps): ReactElement {
  const titleId = useId();
  return (
    <Drawer
      open={open}
      onClose={onClose}
      anchor={anchor}
      slotProps={{
        paper: {
          "aria-labelledby": titleId,
          sx: { width: (theme) => ({ xs: "100%", sm: theme.spacing(width) }) },
        },
      }}
    >
      <Stack sx={{ height: "100%" }}>
        <Typography id={titleId} component="h2" variant="h6" sx={{ p: 2 }}>
          {title}
        </Typography>
        <Box
          sx={{
            flex: 1,
            overflow: "auto",
            p: 2,
            borderTop: 1,
            borderColor: "divider",
          }}
        >
          {children}
        </Box>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            justifyContent: "flex-end",
            p: 2,
            borderTop: 1,
            borderColor: "divider",
          }}
        >
          <Button onClick={onClose}>{closeLabel}</Button>
          {actions}
        </Stack>
      </Stack>
    </Drawer>
  );
}
