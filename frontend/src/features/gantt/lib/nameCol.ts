/** Resizable name column of the Gantt: limits, defaults and persistence (pure helpers). */

export const NAME_COL_KEY = 'phaengan.gantt.namecol'
export const NAME_COL_MIN = 120
export const NAME_COL_MAX = 560
/** Keyboard step (ArrowLeft / ArrowRight on the separator). */
export const NAME_COL_STEP = 16

/** Default width matches `--w-namecol` in tokens.css (220px desktop, 120px mobile). */
export function defaultNameColWidth(mobile: boolean): number {
  return mobile ? 120 : 220
}

export function clampNameColWidth(px: number): number {
  return Math.round(Math.min(NAME_COL_MAX, Math.max(NAME_COL_MIN, px)))
}

/** Stored width, or null when the user never resized (fall back to the responsive default). */
export function readNameColWidth(storage: Pick<Storage, 'getItem'> | null = safeStorage()): number | null {
  try {
    const v = storage?.getItem(NAME_COL_KEY)
    if (!v) return null
    const n = Number(v)
    return Number.isFinite(n) ? clampNameColWidth(n) : null
  } catch {
    return null
  }
}

export function writeNameColWidth(px: number | null, storage: Pick<Storage, 'setItem' | 'removeItem'> | null = safeStorage()): void {
  try {
    if (px === null) storage?.removeItem(NAME_COL_KEY)
    else storage?.setItem(NAME_COL_KEY, String(clampNameColWidth(px)))
  } catch {
    /* ignore quota / private mode */
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}
