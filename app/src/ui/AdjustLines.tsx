// Story #1332: the two lines that take money off an order (a discount, the early friend gift), shown on every slip so the lines add up to the total. Staff slips show the rupee sign.
import { formatRupees } from "../lib/money";

export type Adjust = { discount_paise?: number; early_friend_paise?: number } | null | undefined;

export function AdjustLines({ bill, plain }: { bill: Adjust; plain?: boolean }) {
  const money = (p: number) => `−${plain ? formatRupees(p).replace("₹", "") : formatRupees(p)}`;
  return (
    <>
      {(bill?.discount_paise ?? 0) > 0 && <div><span>Discount</span><span>{money(bill!.discount_paise!)}</span></div>}
      {(bill?.early_friend_paise ?? 0) > 0 && <div><span>Early friend gift</span><span>{money(bill!.early_friend_paise!)}</span></div>}
    </>
  );
}
