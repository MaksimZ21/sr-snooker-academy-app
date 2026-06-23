export const TRAINING_TYPE_LABEL: Record<string, string> = {
  private: "פרטני",
  group: "קבוצתי",
  beginners: "מתחילים",
  advanced: "מתקדמים",
  technique: "טכניקה",
  "match-play": "משחק",
};

// Colors mapped to actual snooker ball colors:
// private → red ball, group → blue ball, beginners → yellow ball,
// advanced → pink ball, technique → brown ball, match-play → green ball (baize)
export const TRAINING_TYPE_COLOR: Record<string, string> = {
  private:
    "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900",
  group:
    "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900",
  beginners:
    "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-400 dark:border-yellow-900",
  advanced:
    "bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-950/40 dark:text-pink-400 dark:border-pink-900",
  technique:
    "bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-900/40 dark:text-stone-400 dark:border-stone-800",
  "match-play":
    "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900",
};

export function trainingTypeBadge(type: string) {
  return {
    label: TRAINING_TYPE_LABEL[type] ?? type,
    className: TRAINING_TYPE_COLOR[type] ?? "bg-secondary text-secondary-foreground",
  };
}
