// Story 1789: the name on the customer's rider card. First name up to 12 letters, else initials with dots ("S.J."); nothing gives "Your rider".
export function riderShortName(name?: string | null): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!words.length || words.join(" ") === "Your rider") return "Your rider";   // supabase.ts already stores "Your rider" for a missing name
  if ([...words[0]].length <= 12) return words[0];
  return words.map((w) => [...w][0] + ".").join("");
}
