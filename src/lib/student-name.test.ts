import { describe, it, expect } from "vitest";
import { hasStudentNamed, isSameFullName } from "./student-name";

describe("isSameFullName", () => {
  it("ignores extra spaces and quotes", () => {
    expect(isSameFullName("  דני   כהן ", "דני כהן")).toBe(true);
    expect(isSameFullName('דני "כהן"', "דני כהן")).toBe(true);
    expect(isSameFullName("דני כהן", "דני לוי")).toBe(false);
  });
});

describe("hasStudentNamed", () => {
  it("compares first and last name together against the typed name", () => {
    const students = [{ first_name: "דני", last_name: "כהן" }, { first_name: "יוסי לוי", last_name: "" }];
    expect(hasStudentNamed(students, "דני כהן")).toBe(true);
    expect(hasStudentNamed(students, "יוסי לוי")).toBe(true);
    expect(hasStudentNamed(students, "דני")).toBe(false);
  });
});
