export const TRAINING_TYPE_LABEL: Record<string, string> = {
  private: "פרטני",
  group: "קבוצתי",
  beginners: "מתחילים",
  advanced: "מתקדמים",
  technique: "טכניקה",
  "match-play": "משחק",
};

export const TRAINING_TYPE_COLOR: Record<string, string> = {
  private: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200 border-blue-200 dark:border-blue-900",
  group: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-200 dark:border-emerald-900",
  beginners: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-amber-200 dark:border-amber-900",
  advanced: "bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200 border-purple-200 dark:border-purple-900",
  technique: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200 border-orange-200 dark:border-orange-900",
  "match-play": "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200 border-rose-200 dark:border-rose-900",
};

export function trainingTypeBadge(type: string) {
  return {
    label: TRAINING_TYPE_LABEL[type] ?? type,
    className: TRAINING_TYPE_COLOR[type] ?? "bg-secondary text-secondary-foreground",
  };
}
