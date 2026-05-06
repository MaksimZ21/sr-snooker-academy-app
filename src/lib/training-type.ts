export const TRAINING_TYPE_LABEL: Record<string, string> = {
  private: "פרטני",
  group: "קבוצתי",
  beginners: "מתחילים",
  advanced: "מתקדמים",
  technique: "טכניקה",
  "match-play": "משחק",
};

export const TRAINING_TYPE_COLOR: Record<string, string> = {
  private:
    "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/50 dark:text-blue-200 dark:border-blue-700",
  group:
    "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-200 dark:border-emerald-700",
  beginners:
    "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-200 dark:border-amber-700",
  advanced:
    "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-900/50 dark:text-violet-200 dark:border-violet-700",
  technique:
    "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/50 dark:text-orange-200 dark:border-orange-700",
  "match-play":
    "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/50 dark:text-rose-200 dark:border-rose-700",
};

export function trainingTypeBadge(type: string) {
  return {
    label: TRAINING_TYPE_LABEL[type] ?? type,
    className: TRAINING_TYPE_COLOR[type] ?? "bg-secondary text-secondary-foreground",
  };
}
