// How a form arranges its fields: flat, titled sections, tabs or a stepper.
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Stepper from "@mui/material/Stepper";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { useId, type ReactElement, type ReactNode } from "react";
import type { FormLayoutKind, FormSection } from "./sections.ts";

export interface FormLayoutProps {
  readonly layout: FormLayoutKind;
  readonly sections: readonly FormSection[];
  /** The input of one field. */
  readonly renderField: (name: string) => ReactNode;
  /** Visible error count of a section (tabs and steps show it). */
  readonly errorCount: (section: FormSection) => number;
  /** The tab or step shown. */
  readonly active: number;
  readonly onActive: (index: number) => void;
  /** Stepper: leave the step forward; the form validates it first. */
  readonly onNext: () => void;
  /** Stepper: the submit button, shown on the last step. */
  readonly submit: ReactNode;
}

const stack = (
  section: FormSection,
  renderField: FormLayoutProps["renderField"],
): ReactElement => (
  <Stack spacing={2.5}>{section.fields.map((name) => renderField(name))}</Stack>
);

const errorSuffix = (count: number): string =>
  count === 0 ? "" : ` (${count} ${count === 1 ? "error" : "errors"})`;

/** Arranges `sections` as the chosen layout. Every panel stays mounted so drafts survive; inactive ones are hidden. */
export function FormLayout({
  layout,
  sections,
  renderField,
  errorCount,
  active,
  onActive,
  onNext,
  submit,
}: FormLayoutProps): ReactElement {
  const id = useId();
  if (layout === "flat") {
    return stack(
      { title: "", fields: sections.flatMap((s) => s.fields) },
      renderField,
    );
  }
  if (layout === "sections") {
    return (
      <Stack spacing={4}>
        {sections.map((section, index) => (
          <Box
            key={section.title}
            component="section"
            aria-labelledby={`${id}-s${index}`}
          >
            <Typography
              id={`${id}-s${index}`}
              component="h3"
              variant="subtitle1"
              sx={{ mb: 2 }}
            >
              {section.title}
            </Typography>
            {stack(section, renderField)}
          </Box>
        ))}
      </Stack>
    );
  }
  const panel = (section: FormSection, index: number): ReactElement => (
    <Box
      key={section.title}
      role={layout === "tabs" ? "tabpanel" : "group"}
      id={`${id}-p${index}`}
      aria-labelledby={`${id}-t${index}`}
      hidden={index !== active}
      sx={{ pt: 2 }}
    >
      {stack(section, renderField)}
    </Box>
  );
  if (layout === "tabs") {
    return (
      <Box>
        <Tabs
          value={active}
          onChange={(_event, index: number) => onActive(index)}
          variant="scrollable"
          aria-label="Form sections"
        >
          {sections.map((section, index) => {
            const count = errorCount(section);
            return (
              <Tab
                key={section.title}
                id={`${id}-t${index}`}
                aria-controls={`${id}-p${index}`}
                label={
                  <Badge color="error" variant="dot" invisible={count === 0}>
                    {section.title + errorSuffix(count)}
                  </Badge>
                }
              />
            );
          })}
        </Tabs>
        {sections.map(panel)}
      </Box>
    );
  }
  const last = active === sections.length - 1;
  return (
    <Box>
      <Stepper activeStep={active} alternativeLabel sx={{ mb: 2 }}>
        {sections.map((section, index) => {
          const count = errorCount(section);
          return (
            <Step key={section.title} id={`${id}-t${index}`}>
              <StepLabel error={count > 0}>
                {section.title + errorSuffix(count)}
              </StepLabel>
            </Step>
          );
        })}
      </Stepper>
      {sections.map(panel)}
      <Stack
        direction="row"
        spacing={1}
        sx={{ justifyContent: "flex-end", mt: 3 }}
      >
        <Button disabled={active === 0} onClick={() => onActive(active - 1)}>
          Back
        </Button>
        {last ? submit : <Button onClick={onNext}>Next</Button>}
      </Stack>
    </Box>
  );
}
