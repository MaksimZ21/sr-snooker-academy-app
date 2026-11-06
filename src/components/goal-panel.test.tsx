import type { ReactNode } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { GoalPanel, type GoalsByStudent } from "./goal-panel";
import type { Student } from "@/lib/sheets/schemas";

// The real dropdown's option clicks don't register under jsdom. This file tests
// the panel, so a native select stands in for it.
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: {
    value: string;
    onValueChange: (v: string) => void;
    children: ReactNode;
  }) => (
    <select value={value} onChange={(e) => onValueChange(e.target.value)}>
      <option value="" />
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => <option value={value}>{children}</option>,
}));

const student = { id: "S1", first_name: "דני", last_name: "כהן" } as Student;

const savedGoal = {
  id: "g1", student_id: "S1", month: "2026-10", category: "angle", created_at: "2026-11-06T10:00:00Z",
};

function Harness({ readOnly }: { readOnly: boolean }) {
  const { data } = useQuery<{ goalsByStudent: GoalsByStudent }>({ queryKey: ["session", "A"], enabled: false });
  return (
    <GoalPanel
      sessionId="A"
      month="2026-10"
      students={[student]}
      goalsByStudent={data?.goalsByStudent ?? {}}
      readOnly={readOnly}
    />
  );
}

function setup(readOnly = false) {
  const qc = new QueryClient();
  qc.setQueryData(["session", "A"], { goalsByStudent: { S1: { goal: null, entry: null } } });
  render(
    <QueryClientProvider client={qc}>
      <Harness readOnly={readOnly} />
    </QueryClientProvider>,
  );
}

function pick(value: string) {
  fireEvent.change(screen.getByRole("combobox"), { target: { value } });
}

const saveButton = () => screen.getByRole("button", { name: "שמור" }) as HTMLButtonElement;

describe("GoalPanel without a goal", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("saves the picked goal on the session's month and opens its entry row", async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) =>
      new Response(JSON.stringify({ goal: savedGoal }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    setup();

    expect(saveButton().disabled).toBe(true);
    pick("angle");
    fireEvent.click(saveButton());

    await waitFor(() => expect(screen.getByPlaceholderText("הצליחו")).toBeTruthy());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/students/S1/monthly-goal");
    expect(JSON.parse(init.body as string)).toEqual({ category: "angle", month: "2026-10" });
  });

  it("stays on the picker when saving fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    setup();

    pick("angle");
    fireEvent.click(saveButton());

    await waitFor(() => expect(saveButton().disabled).toBe(false));
    expect(screen.queryByPlaceholderText("הצליחו")).toBeNull();
  });

  it("shows no picker when read only", () => {
    setup(true);

    expect(screen.getByText("לא נבחרה מטרה החודש")).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
