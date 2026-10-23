// The rules for a kitchen and a dish, checked in the admin app before any call (story H1). The database has the same rules (migration 0022); this gives the admin a plain message first.
import { parsePins, rupeesToPaise } from "./admin";

export const MAX_PRICE_PAISE = 500000;   // ₹5,000
const len = (t: string, min: number, max: number) => t.trim().length >= min && t.trim().length <= max;

export type KitchenForm = { name: string; address: string; phone: string; pins: string; opensAt: string; closesAt: string };
export function kitchenProblem(f: KitchenForm): string | null {
  if (!len(f.name, 2, 60)) return "The kitchen name must be 2 to 60 characters.";
  if (!len(f.address, 5, 200)) return "The address must be 5 to 200 characters.";
  if (!/^[6-9]\d{9}$/.test(f.phone.trim())) return "The phone must be ten digits and start with 6, 7, 8 or 9.";
  const { pins, bad } = parsePins(f.pins);
  if (bad.length) return `Pin codes are six digits. Check: ${bad.join(", ")}`;
  if (pins.length === 0) return "Give the kitchen at least one pin code.";
  if (pins.length > 20) return "A kitchen can have 20 pin codes at most.";
  if (f.opensAt && f.closesAt && f.opensAt === f.closesAt) return "The opening time and the closing time must be different.";
  return null;
}

export function dishProblem(f: { name: string; price: string; category: string }): string | null {
  if (!len(f.name, 2, 60)) return "The dish name must be 2 to 60 characters.";
  const paise = rupeesToPaise(f.price);
  if (paise === null) return "Type the price in rupees, for example 220 or 220.50. It must be more than zero.";
  if (paise > MAX_PRICE_PAISE) return "The price can be ₹5,000 at most.";
  if (f.category.trim().length > 30) return "The category can be 30 characters at most.";
  return null;
}
