import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

describe("Select", () => {
  it("shows the selected item's label, not its raw value", () => {
    const districts = [
      { id: "6f1c2a90-uuid-north", label: "צפון" },
      { id: "0b7e44d1-uuid-south", label: "דרום" },
    ];
    render(
      <Select value="0b7e44d1-uuid-south">
        <SelectTrigger>
          <SelectValue placeholder="ללא מחוז" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">ללא מחוז</SelectItem>
          {districts.map((d) => (
            <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>,
    );
    expect(screen.getByText("דרום")).toBeTruthy();
    expect(screen.queryByText("0b7e44d1-uuid-south")).toBeNull();
  });

  it("still lets a SelectValue render function override the label", () => {
    render(
      <Select value="credit">
        <SelectTrigger>
          <SelectValue>{(v: string) => `שולם ב-${v}`}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="credit">אשראי</SelectItem>
        </SelectContent>
      </Select>,
    );
    expect(screen.getByText("שולם ב-credit")).toBeTruthy();
  });
});
