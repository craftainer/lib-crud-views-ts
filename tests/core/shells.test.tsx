import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DialogShell, DrawerShell, PageShell } from "../../src/core/index.ts";

describe("PageShell", () => {
  it("renders title, subtitle, actions, breadcrumbs and content", () => {
    render(
      <PageShell
        title="Heroes"
        subtitle="All of them"
        actions={<button>Add</button>}
        breadcrumbs={[
          <a key="a" href="/">
            Home
          </a>,
        ]}
      >
        <p>content</p>
      </PageShell>,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Heroes" }),
    ).toBeInTheDocument();
    expect(screen.getByText("All of them")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Breadcrumb" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("content");
  });

  it("omits the optional parts", () => {
    render(<PageShell title="Bare" breadcrumbs={[]} />);
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.getByRole("heading")).toHaveTextContent("Bare");
  });
});

describe("DialogShell", () => {
  it("is labelled by its title, closes, and shows actions", async () => {
    const onClose = vi.fn();
    render(
      <DialogShell
        open
        onClose={onClose}
        title="Edit"
        actions={<button>Save</button>}
      >
        body
      </DialogShell>,
    );
    expect(screen.getByRole("dialog", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("renders nothing while closed and takes a close label", () => {
    const { rerender } = render(
      <DialogShell open={false} onClose={() => {}} title="T" />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    rerender(
      <DialogShell
        open
        onClose={() => {}}
        title="T"
        closeLabel="Cancel"
        maxWidth="md"
      />,
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });
});

describe("DrawerShell", () => {
  it("is labelled by its title, closes, and shows actions", async () => {
    const onClose = vi.fn();
    render(
      <DrawerShell
        open
        onClose={onClose}
        title="Details"
        actions={<button>Go</button>}
      >
        body
      </DrawerShell>,
    );
    expect(screen.getByRole("dialog", { name: "Details" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("anchors left with a custom width and close label", () => {
    render(
      <DrawerShell
        open
        onClose={() => {}}
        title="L"
        anchor="left"
        width={40}
        closeLabel="Done"
      />,
    );
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
  });
});
