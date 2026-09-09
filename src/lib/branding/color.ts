// globals.css guarda cores como "H S% L%" (consumidas via hsl(var(--x))).
// Essas funções convertem um hex escolhido pelo usuário (#rrggbb) para esse formato,
// e decidem se o texto sobre essa cor deve ser branco ou escuro.

const HEX_PATTERN = /^#([0-9a-f]{6})$/i;

export function isValidHexColor(value: string): boolean {
  return HEX_PATTERN.test(value.trim());
}

export function hexToHslTriplet(hex: string): string | null {
  const match = HEX_PATTERN.exec(hex.trim());
  if (!match) return null;

  const r = parseInt(match[1].slice(0, 2), 16) / 255;
  const g = parseInt(match[1].slice(2, 4), 16) / 255;
  const b = parseInt(match[1].slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// Fórmula de luminância relativa (WCAG) para decidir texto branco ou escuro sobre a cor.
export function contrastForegroundHslTriplet(hex: string): string {
  const match = HEX_PATTERN.exec(hex.trim());
  if (!match) return "0 0% 100%";

  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };

  const r = channel(parseInt(match[1].slice(0, 2), 16));
  const g = channel(parseInt(match[1].slice(2, 4), 16));
  const b = channel(parseInt(match[1].slice(4, 6), 16));

  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  // Mesmo tom escuro usado em --foreground no globals.css, para manter consistência visual.
  return luminance > 0.55 ? "222 47% 11%" : "0 0% 100%";
}
