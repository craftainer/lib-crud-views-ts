import type { Preview } from "@storybook/react-vite";
import type { StubOptions } from "../tests/fixtures/stub.ts";
import { Frame } from "./Frame.tsx";

/** What a story may set in `parameters`. */
export interface StubParameters {
  /** How the fake CRUD server behaves (see tests/fixtures/stub.ts). */
  stub?: StubOptions;
}

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Color scheme",
      toolbar: {
        title: "Scheme",
        icon: "circlehollow",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "light" },
  decorators: [
    (Story, { globals, parameters }) => {
      const { stub } = parameters as StubParameters;
      return (
        <Frame
          stub={stub ?? {}}
          scheme={globals.theme === "dark" ? "dark" : "light"}
        >
          <Story />
        </Frame>
      );
    },
  ],
  parameters: {
    layout: "fullscreen",
    controls: { disable: true },
    // Fails the story's a11y panel on any violation; the Playwright suite
    // (tests/visual/) enforces serious and critical ones in CI.
    a11y: { test: "error" },
  },
};

export default preview;
