import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DistrictSwitcher } from "./district-switcher";

const items = [
  { id: "n", label: "צפון", content: <p>טבלת צפון</p> },
  { id: "s", label: "דרום", content: <p>טבלת דרום</p> },
];

describe("DistrictSwitcher", () => {
  it("shows only the first district until another button is pressed", () => {
    render(<DistrictSwitcher items={items} />);
    expect(screen.getByText("טבלת צפון")).toBeTruthy();
    expect(screen.queryByText("טבלת דרום")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "דרום" }));
    expect(screen.getByText("טבלת דרום")).toBeTruthy();
    expect(screen.queryByText("טבלת צפון")).toBeNull();
  });

  it("shows a lone district without any buttons", () => {
    render(<DistrictSwitcher items={[items[0]]} />);
    expect(screen.getByText("טבלת צפון")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
