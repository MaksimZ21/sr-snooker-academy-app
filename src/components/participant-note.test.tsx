import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { ParticipantNote } from "./participant-note";

function Harness({ canEdit }: { canEdit: boolean }) {
  const { data } = useQuery<{ participantNotes: Record<string, string> }>({
    queryKey: ["tournament", "T1"],
    enabled: false,
  });
  return (
    <ParticipantNote
      tournamentId="T1"
      participantId="P1"
      note={data?.participantNotes.P1 ?? ""}
      canEdit={canEdit}
    />
  );
}

function setup(note = "", canEdit = true) {
  const qc = new QueryClient();
  qc.setQueryData(["tournament", "T1"], { participantNotes: note ? { P1: note } : {} });
  render(
    <QueryClientProvider client={qc}>
      <Harness canEdit={canEdit} />
    </QueryClientProvider>,
  );
}

const box = () => screen.getByPlaceholderText("הערה לטורניר הזה, רק לצוות");

describe("ParticipantNote", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("adds a note for this tournament's player and shows it at once", async () => {
    let answer: (r: Response) => void = () => {};
    const fetchMock = vi.fn((..._args: unknown[]) => new Promise<Response>((resolve) => { answer = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    setup();

    fireEvent.click(screen.getByRole("button", { name: "הוסף הערה" }));
    fireEvent.change(box(), { target: { value: "מגיע מאוחר" } });
    fireEvent.click(screen.getByRole("button", { name: "שמור" }));

    await waitFor(() => expect(screen.getByText("מגיע מאוחר")).toBeTruthy());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/tournaments/T1/participants/P1/note");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({ text: "מגיע מאוחר" });
    answer(new Response("{}", { status: 200 }));
  });

  it("puts the old note back when saving fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 500 })));
    setup("ישן");

    fireEvent.click(screen.getByText("ישן"));
    fireEvent.change(box(), { target: { value: "חדש" } });
    fireEvent.click(screen.getByRole("button", { name: "שמור" }));

    await waitFor(() => expect(screen.getByText("ישן")).toBeTruthy());
    expect(screen.queryByText("חדש")).toBeNull();
  });

  it("deleting sends an empty note", async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    setup("ישן");

    fireEvent.click(screen.getByText("ישן"));
    fireEvent.click(screen.getByRole("button", { name: "מחק" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({ text: "" });
    expect(screen.queryByText("ישן")).toBeNull();
  });

  it("someone who can't edit the tournament sees the note but can't change it", () => {
    setup("ישן", false);

    expect(screen.getByText("ישן")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "הוסף הערה" })).toBeNull();
    fireEvent.click(screen.getByText("ישן"));
    expect(screen.queryByPlaceholderText("הערה לטורניר הזה, רק לצוות")).toBeNull();
  });
});
