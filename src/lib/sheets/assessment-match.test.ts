import { describe, it, expect } from "vitest";
import { assessmentMatchesStudent } from "./assessment-match";

const student = { first_name: "דני", last_name: "כהן", phone: "0501234567" };

describe("assessmentMatchesStudent", () => {
  it("matches the same phone and the same full name", () => {
    expect(assessmentMatchesStudent({ participant_name: "דני כהן", participant_phone: "0501234567" }, student)).toBe(true);
  });

  it("matches the phone in any format and ignores extra spaces", () => {
    expect(assessmentMatchesStudent({ participant_name: "  דני   כהן ", participant_phone: "+972-50-123-4567" }, student)).toBe(true);
  });

  it("does not match a different name on the same phone (siblings on a parent's phone)", () => {
    expect(assessmentMatchesStudent({ participant_name: "יוסי כהן", participant_phone: "0501234567" }, student)).toBe(false);
  });

  it("does not match the same name on a different phone", () => {
    expect(assessmentMatchesStudent({ participant_name: "דני כהן", participant_phone: "0529999999" }, student)).toBe(false);
  });

  it("never matches when either side has no phone", () => {
    expect(assessmentMatchesStudent({ participant_name: "דני כהן", participant_phone: null }, student)).toBe(false);
    expect(assessmentMatchesStudent({ participant_name: "דני כהן", participant_phone: "0501234567" }, { ...student, phone: "" })).toBe(false);
  });

  it("matches a student with no last name on the first name alone", () => {
    expect(
      assessmentMatchesStudent({ participant_name: "דני", participant_phone: "0501234567" }, { ...student, last_name: "" }),
    ).toBe(true);
  });
});
