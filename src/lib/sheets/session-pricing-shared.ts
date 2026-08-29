export type SessionPricingRule = {
  id: string;
  label: string;
  price_nis: number;
};

// Tolerant to the Hebrew grammatical variation between a word's standalone
// form ("מכללה") and its construct-state form used before a following word
// ("מכללת תל אביב") — the same ה/ת ending swap already handled for group
// name matching in groups.ts's collegeNameVariants().
function matchesKeyword(haystack: string, keyword: string): boolean {
  if (haystack.includes(keyword)) return true;
  if (keyword.endsWith("ה")) {
    const variant = keyword.slice(0, -1) + "ת";
    if (haystack.includes(variant)) return true;
  }
  return false;
}

// Finds the first rule whose label appears (case-insensitively, and
// tolerant of the Hebrew ה/ת construct-state variation) anywhere in the
// session name, and returns the source/price it implies — or null if no
// rule matches. Pure function, no DB access.
export function resolveSessionPricing(
  name: string,
  rules: SessionPricingRule[],
): { source: string; price_nis: number } | null {
  const haystack = name.toLowerCase();
  const match = rules.find((r) => matchesKeyword(haystack, r.label.toLowerCase()));
  return match ? { source: match.label, price_nis: match.price_nis } : null;
}
