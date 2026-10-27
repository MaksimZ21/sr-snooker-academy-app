// Pure constants/types only — no `db` or other server-only import, so
// this module is safe to import from a client component. intro-events.ts
// (which does import `db`) re-exports these for server-side callers;
// src/components/intro-event-detail-view.tsx imports directly from here
// instead, to avoid pulling the server-only data-access module (and its
// transitive next/cache usage) into the client bundle.
export const INTRO_EXPERIENCE_LEVELS = ["none", "hobbyist", "regular"] as const;
export type IntroExperienceLevel = (typeof INTRO_EXPERIENCE_LEVELS)[number];
export const INTRO_EXPERIENCE_LEVEL_LABEL: Record<IntroExperienceLevel, string> = {
  none: "ללא ניסיון בכלל",
  hobbyist: "שחקן חובבן",
  regular: "שחקן קבוע",
};

export const INTRO_GOALS = ["cue_control", "technique", "angles", "beat_friend", "advance", "basics"] as const;
export type IntroGoal = (typeof INTRO_GOALS)[number];
export const INTRO_GOAL_LABEL: Record<IntroGoal, string> = {
  cue_control: "שליטה בלבן",
  technique: "טכניקה",
  angles: "זוויות",
  beat_friend: "לנצח חבר/ים",
  advance: "להתקדם מקצועית",
  basics: "בסיס של הבסיס",
};
