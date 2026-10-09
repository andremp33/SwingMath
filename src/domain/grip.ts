/**
 * Grip size. Sizes go up in 1/8 inch of handle circumference: L0 = 4",
 * L1 = 4 1/8" ... L5 = 4 5/8" (EU sizes 0-5 are the same steps).
 * Rules of thumb: an overgrip adds about 1/16" (half a size), a heat-shrink
 * sleeve about 1/8" (a full size). Thickness varies by brand.
 */
export const GRIP_SIZES = [0, 1, 2, 3, 4, 5] as const

export const OVERGRIP_EIGHTHS = 0.5
export const SLEEVE_EIGHTHS = 1

/** Final size in eighths of an inch above 4", e.g. 3.5 = L3 and a half. */
export function gripSize(base: number, overgrips: number, sleeves: number) {
  return base + overgrips * OVERGRIP_EIGHTHS + sleeves * SLEEVE_EIGHTHS
}

/** Circumference in inches as a fraction, e.g. 3.5 -> "4 7/16". */
export function gripInches(eighths: number) {
  const sixteenths = Math.round(eighths * 2)
  const whole = 4 + Math.floor(sixteenths / 16)
  let num = sixteenths % 16
  let den = 16
  while (num && num % 2 === 0) {
    num /= 2
    den /= 2
  }
  return num ? `${whole} ${num}/${den}"` : `${whole}"`
}

/** Circumference in mm. */
export const gripMm = (eighths: number) => Math.round((4 + eighths / 8) * 25.4)
