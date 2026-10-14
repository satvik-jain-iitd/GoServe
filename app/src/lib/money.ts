// Money is whole paise everywhere. Only the screen turns it into rupees.
export const formatRupees = (paise: number): string => {
  const rupees = paise / 100;
  return "₹" + (Number.isInteger(rupees) ? String(rupees) : rupees.toFixed(2));
};
