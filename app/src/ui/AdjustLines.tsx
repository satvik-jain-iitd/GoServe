// Story #1332: the lines that move the total away from the plain sum of the dishes: packaging, delivery, tax (when it is added on top), a discount and the early friend gift.
// Shown on every slip, so the lines add up to the total. A line shows only when its amount is above zero. Staff slips show the rupee sign.
import { formatRupees } from "../lib/money";
import type { OrderBill } from "../lib/orders";

export function AdjustLines({ bill, plain }: { bill: OrderBill | null | undefined; plain?: boolean }) {
  const amount = (p: number) => (plain ? formatRupees(p).replace("₹", "") : formatRupees(p));
  const add = (label: string, p: number | undefined) => (p ?? 0) > 0 && <div><span>{label}</span><span>{amount(p!)}</span></div>;
  const take = (label: string, p: number | undefined) => (p ?? 0) > 0 && <div><span>{label}</span><span>−{amount(p!)}</span></div>;
  return (
    <>
      {add("Packaging", bill?.fees?.packaging_paise)}
      {add("Delivery", bill?.fees?.delivery_paise)}
      {bill?.tax_mode === "exclusive" && add("Tax", bill?.tax_paise)}
      {take("Discount", bill?.discount_paise)}
      {take("Early friend gift", bill?.early_friend_paise)}
    </>
  );
}
