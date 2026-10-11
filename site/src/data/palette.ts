// The GoServe palette, exactly as extracted from the investor deck.
// Used by the /palette page and by the contrast tests.

export interface Swatch {
  name: string;
  hex: string;
  usage: string;
}

export interface PaletteGroup {
  title: string;
  note: string;
  swatches: Swatch[];
}

export const CORE: Swatch[] = [
  { name: "Cream", hex: "#E4E6D9", usage: "The canvas. Every page starts here." },
  { name: "Deep Green", hex: "#45654E", usage: "Primary colour. Buttons and structure." },
  { name: "Ink Green", hex: "#263528", usage: "Main text. Headings and body." },
  { name: "Sage", hex: "#BFCFB4", usage: "Section backgrounds and hero blocks." },
  { name: "Off White", hex: "#F7F3EF", usage: "Warm panels and cards." },
  { name: "Lime", hex: "#C8D888", usage: "Soft accent. Badges and highlights." },
  { name: "Lime Soft", hex: "#CFD998", usage: "A lighter lime. Pairs with Lime." },
  { name: "Warm Yellow", hex: "#FFDE59", usage: "The one bright pop. Use it rarely." },
];

export const SUPPORTING: Swatch[] = [
  { name: "Olive", hex: "#7F9743", usage: "Secondary accent." },
  { name: "Olive Soft", hex: "#889848", usage: "A lighter olive." },
  { name: "Muted Gray", hex: "#706F70", usage: "Secondary text and chrome." },
  { name: "Earth Deep", hex: "#654E3A", usage: "Warm brown. Earthy sections." },
  { name: "Earth Mid", hex: "#966E3A", usage: "Warm tan. Tags and dividers." },
  { name: "Earth Light", hex: "#C17D46", usage: "Warm highlight. Food mood." },
];

export const STATUS: Swatch[] = [
  { name: "Placed", hex: "#706F70", usage: "Order received." },
  { name: "Accepted", hex: "#7F9743", usage: "Kitchen accepted." },
  { name: "Cooking", hex: "#FFDE59", usage: "Being prepared." },
  { name: "Ready", hex: "#C8D888", usage: "Waiting for the rider." },
  { name: "Out for delivery", hex: "#966E3A", usage: "On the way." },
  { name: "Delivered", hex: "#45654E", usage: "Done." },
  { name: "Failed / late", hex: "#B3261E", usage: "Needs attention." },
];

export const GROUPS: PaletteGroup[] = [
  {
    title: "Core — the eight that matter",
    note: "Everything in the product is built from these eight colours.",
    swatches: CORE,
  },
  {
    title: "Supporting — olive and earthy",
    note: "Charts, tags, and food imagery. Never the primary action.",
    swatches: SUPPORTING,
  },
  {
    title: "Order status",
    note: "Built from the palette, so status still feels like the deck.",
    swatches: STATUS,
  },
];

// Pairs we assert in tests and show on the palette page.
export const CONTRAST_PAIRS: { fg: string; bg: string; label: string }[] = [
  { fg: "#263528", bg: "#E4E6D9", label: "Ink Green on Cream (body text)" },
  { fg: "#FFFFFF", bg: "#45654E", label: "White on Deep Green (primary button)" },
  { fg: "#263528", bg: "#BFCFB4", label: "Ink Green on Sage (section text)" },
  { fg: "#263528", bg: "#C8D888", label: "Ink Green on Lime (secondary button)" },
  { fg: "#263528", bg: "#FFDE59", label: "Ink Green on Warm Yellow (accent)" },
];
