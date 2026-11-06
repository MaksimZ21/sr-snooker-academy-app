import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { AttendancePanel } from "./attendance-panel";
import type { Attendance, Note, Student } from "@/lib/sheets/schemas";

const student = { id: "S1", first_name: "דני", last_name: "כהן" } as Student;

function Harness() {
  const { data } = useQuery<{ attendance: Attendance[]; notesByStudent: Record<string, Note[]> }>({
    queryKey: ["session", "A"],
    enabled: false,
  });
  return (
    <AttendancePanel
      sessionId="A"
      students={[student]}
      attendance={data?.attendance ?? []}
      notesByStudent={data?.notesByStudent ?? {}}
      readOnly={false}
    />
  );
}

function setup(attendance: Attendance[] = []) {
  const qc = new QueryClient();
  qc.setQueryData(["session", "A"], { attendance, notesByStudent: {} });
  render(
    <QueryClientProvider client={qc}>
      <Harness />
    </QueryClientProvider>,
  );
  return qc;
}

const button = (name: string) => screen.getByRole("button", { name }) as HTMLButtonElement;

describe("AttendancePanel", () => {
  afterEach(cleanup);
  beforeEach(() => vi.restoreAllMocks());

  it("marks immediately, before the server answers, and has no save button", async () => {
    let answer: (r: Response) => void = () => {};
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { answer = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    setup();

    fireEvent.click(button("נוכח"));

    await waitFor(() => expect(button("נוכח").getAttribute("aria-pressed")).toBe("true"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /שמור/ })).toBeNull();
    expect(button("איחור").disabled).toBe(false);
    answer(new Response("{}", { status: 200 }));
  });

  it("puts the previous status back when saving fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 500 })));
    setup([{ session_id: "A", student_id: "S1", status: "late", marked_by: "x", marked_at: "t" }]);

    fireEvent.click(button("נוכח"));

    await waitFor(() => expect(button("איחור").getAttribute("aria-pressed")).toBe("true"));
    expect(button("נוכח").getAttribute("aria-pressed")).toBe("false");
  });

  it("pressing the active status clears it on the server", async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    setup([{ session_id: "A", student_id: "S1", status: "present", marked_by: "x", marked_at: "t" }]);

    fireEvent.click(button("נוכח"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("DELETE");
    expect(button("נוכח").getAttribute("aria-pressed")).toBe("false");
  });

  function writeNote(text: string) {
    fireEvent.click(button("הוסף הערה"));
    fireEvent.change(screen.getByPlaceholderText("הוסף הערה לשחקן..."), { target: { value: text } });
    fireEvent.click(button("שמור"));
  }

  it("shows a note under the player and closes the box before the server answers", async () => {
    let answer: (r: Response) => void = () => {};
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { answer = resolve; })));
    setup();

    writeNote("לעבוד על הפתיחה");

    await waitFor(() => expect(screen.getByText("לעבוד על הפתיחה")).toBeTruthy());
    expect(screen.queryByPlaceholderText("הוסף הערה לשחקן...")).toBeNull();
    answer(new Response(JSON.stringify({ note: {} }), { status: 200 }));
  });

  it("gives the text back when saving a note fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 500 })));
    setup();

    writeNote("לא ללכת לאיבוד");

    const box = await screen.findByPlaceholderText("הוסף הערה לשחקן...");
    await waitFor(() => expect((box as HTMLTextAreaElement).value).toBe("לא ללכת לאיבוד"));
    expect(screen.queryByText("לא ללכת לאיבוד", { selector: "p" })).toBeNull();
  });
});
