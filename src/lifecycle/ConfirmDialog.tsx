import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import type { ReactElement, ReactNode } from "react";
import { DialogShell } from "../core/index.ts";

export interface ConfirmDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly children: ReactNode;
  readonly confirmLabel: string;
  readonly busy?: boolean;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
}

/** A small confirmation built on `DialogShell`: Cancel and one destructive action. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  busy = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps): ReactElement {
  return (
    <DialogShell
      open={open}
      onClose={onClose}
      title={title}
      closeLabel="Cancel"
      maxWidth="xs"
      actions={
        <Button
          color="error"
          variant="contained"
          disabled={busy}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      }
    >
      <Typography>{children}</Typography>
    </DialogShell>
  );
}
