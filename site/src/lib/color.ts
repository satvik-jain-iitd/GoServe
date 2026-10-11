// Colour math for the palette page and for contrast tests.
// Kept dependency-free so it is trivial to unit test.

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export function isValidHex(hex: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex.trim());
}

export function hexToRgb(hex: string): RGB {
  if (!isValidHex(hex)) {
    throw new Error(`Invalid hex colour: ${hex}`);
  }
  let h = hex.trim().replace("#", "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

// WCAG relative luminance.
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channel = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

// WCAG contrast ratio between two colours. Range 1 to 21.
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
}

export type WcagLevel = "AAA" | "AA" | "AA Large" | "Fail";

// Normal text: AA needs 4.5, AAA needs 7.
// Large text (18.66px bold or 24px): AA needs 3, AAA needs 4.5.
export function wcagLevel(ratio: number): WcagLevel {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA Large";
  return "Fail";
}

export function formatRatio(ratio: number): string {
  return `${ratio.toFixed(2)}:1`;
}

// Decide black or white ink for a given background, for readable swatch labels.
export function readableInk(bg: string): "#263528" | "#FFFFFF" {
  return contrastRatio(bg, "#FFFFFF") >= contrastRatio(bg, "#263528")
    ? "#FFFFFF"
    : "#263528";
}
