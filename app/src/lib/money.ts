// Money is whole paise everywhere. Only the screen turns it into rupees.
export const formatRupees = (paise: number): string => {
  const rupees = paise / 100;
  return "₹" + (Number.isInteger(rupees) ? String(rupees) : rupees.toFixed(2));
};

// Story #1332: one line price for every staff slip: the base price plus a paid option, times the quantity. The order total counts both.
export const linePaise = (i: { price_paise: number; extras_paise?: number | null; qty: number }): number => (i.price_paise + (i.extras_paise ?? 0)) * i.qty;
