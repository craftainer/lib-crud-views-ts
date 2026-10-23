import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import type { ReactElement } from "react";

/** The shared "could not load" alert with a Retry action. */
export function LoadError({
  title,
  error,
  onRetry,
}: {
  readonly title: string;
  readonly error: Error;
  readonly onRetry: () => void;
}): ReactElement {
  return (
    <Alert severity="error" action={<Button onClick={onRetry}>Retry</Button>}>
      {`Could not load ${title}: ${error.message}`}
    </Alert>
  );
}
