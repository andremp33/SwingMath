import { createLucideIcon } from 'lucide-react'

/**
 * Icons the set does not have, drawn on its 24-unit grid with its stroke,
 * so they sit with the others.
 */

/** A racket, upright: the head with a thin string grid, the throat's V into
 *  the handle. Thin strings, so the grid never reads as a cross. */
export const RacketIcon = createLucideIcon('racket', [
  ['ellipse', { cx: '12', cy: '8', rx: '6', ry: '6.5', key: 'head' }],
  ['path', { d: 'M10 2.6v10.8', strokeWidth: '1.1', key: 'main-1' }],
  ['path', { d: 'M14 2.6v10.8', strokeWidth: '1.1', key: 'main-2' }],
  ['path', { d: 'M6.8 6h10.4', strokeWidth: '1.1', key: 'cross-1' }],
  ['path', { d: 'M6.8 10h10.4', strokeWidth: '1.1', key: 'cross-2' }],
  ['path', { d: 'M9.5 14 12 17l2.5-3', key: 'throat' }],
  ['path', { d: 'M12 17v5', key: 'handle' }],
])
