/**
 * WCAG 2.1 relative luminance and contrast ratio, for verifying the DEC-083
 * token palette rather than trusting it.
 *
 * DEC-083 states that "contrast is measured, not assumed", and DEC-038 left the
 * technical verification method to be defined later. This module plus
 * `tests/contrast.test.ts` are that method for colour: the thresholds are
 * asserted against the actual token values in `src/index.css`, so changing a
 * token to something illegible fails the suite rather than shipping.
 *
 * Pure — no DOM, no React, no imports. Formulae from WCAG 2.1 SC 1.4.3
 * (contrast minimum) and 1.4.11 (non-text contrast).
 */

export type Rgb = { readonly red: number; readonly green: number; readonly blue: number }

/** Parses `#rgb` or `#rrggbb`. Throws on anything else rather than guessing. */
export function parseHex(hex: string): Rgb {
  const value = hex.trim().replace(/^#/, '')
  const expanded = value.length === 3 ? value.split('').map((c) => c + c).join('') : value
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    throw new Error(`Not a hex colour: ${hex}`)
  }
  return {
    red: Number.parseInt(expanded.slice(0, 2), 16),
    green: Number.parseInt(expanded.slice(2, 4), 16),
    blue: Number.parseInt(expanded.slice(4, 6), 16),
  }
}

/** WCAG 2.1 relative luminance. Channels are linearized before weighting. */
export function relativeLuminance({ red, green, blue }: Rgb): number {
  const linearize = (channel: number): number => {
    const srgb = channel / 255
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue)
}

/**
 * WCAG 2.1 contrast ratio, from 1 (identical) to 21 (black on white).
 * Order-independent: the lighter colour is always the numerator.
 */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(parseHex(foreground))
  const b = relativeLuminance(parseHex(background))
  const lighter = Math.max(a, b)
  const darker = Math.min(a, b)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Reads `--token: #value;` declarations out of a CSS source string. Deliberately
 * simple: it only understands the hex-literal custom properties this project's
 * token layer actually uses, and ignores everything else.
 */
export function readHexTokens(css: string): Record<string, string> {
  const tokens: Record<string, string> = {}
  const pattern = /(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g
  let match = pattern.exec(css)
  while (match !== null) {
    tokens[match[1]] = match[2]
    match = pattern.exec(css)
  }
  return tokens
}
