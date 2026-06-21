export type TechniqueKey =
  | "eye_on_cue"
  | "leg_before_hit"
  | "layer_after_descent"
  | "focus_vs_layer"
  | "bridge_distance"
  | "thumb"
  | "bridge_nest"
  | "tip_distance"
  | "palm_base"
  | "ring"
  | "elbow"
  | "back_hand_90";

export type Technique = Partial<Record<TechniqueKey, boolean>>;

export type Assessment = {
  id: string;
  coach_email: string;
  participant_name: string;
  participant_phone: string | null;
  event_date: string;
  strong_hand: "right" | "left" | null;
  strong_eye: "right" | "left" | null;
  technique: Technique;
  notes: string | null;
  photo_url: string | null;
  created_at: string;
};

export const TECHNIQUE_CRITERIA: { key: TechniqueKey; label: string }[] = [
  { key: "eye_on_cue", label: "עין בקן" },
  { key: "leg_before_hit", label: "רגל בקן מכה לפני" },
  { key: "layer_after_descent", label: "ליייר על העין אחרי הירידה" },
  { key: "focus_vs_layer", label: "פיקוס מקול ביחס לליייר" },
  { key: "bridge_distance", label: "מרחק הגשר מהלבן" },
  { key: "thumb", label: "אגודל" },
  { key: "bridge_nest", label: "קן הגשר" },
  { key: "tip_distance", label: "מרחק טיפ מהלבן" },
  { key: "palm_base", label: "בסיס כף היד" },
  { key: "ring", label: "טבעת" },
  { key: "elbow", label: "מרפק בקן המכה" },
  { key: "back_hand_90", label: "90 מעלות יד אחורית" },
];
