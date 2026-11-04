/**
 * Squarified treemap (Bruls, Huizing, van Wijk): lays weighted items into a w x h box so the
 * tiles stay close to square and their areas are proportional to the values.
 * Items with a value <= 0 are dropped. The result keeps the descending order of the values.
 */
export interface TreemapItem {
  id: number | string
  value: number
}

export interface TreemapRect {
  id: number | string
  x: number
  y: number
  w: number
  h: number
}

function worstRatio(areas: number[], side: number): number {
  const sum = areas.reduce((n, a) => n + a, 0)
  const max = Math.max(...areas)
  const min = Math.min(...areas)
  const s2 = side * side
  return Math.max((s2 * max) / (sum * sum), (sum * sum) / (s2 * min))
}

export function squarify(items: TreemapItem[], width: number, height: number): TreemapRect[] {
  const sorted = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value)
  const out: TreemapRect[] = []
  if (sorted.length === 0 || width <= 0 || height <= 0) { return out }

  const total = sorted.reduce((n, i) => n + i.value, 0)
  const scale = (width * height) / total
  let x = 0
  let y = 0
  let w = width
  let h = height
  let rest = sorted.map((i) => ({ id: i.id, area: i.value * scale }))

  while (rest.length > 0) {
    const side = Math.min(w, h)
    let count = 1
    let best = worstRatio([rest[0]?.area ?? 0], side)
    while (count < rest.length) {
      const next = worstRatio(rest.slice(0, count + 1).map((r) => r.area), side)
      if (next > best) { break }
      best = next
      count += 1
    }
    const row = rest.slice(0, count)
    const rowArea = row.reduce((n, r) => n + r.area, 0)
    if (w >= h) {
      // the row is a column on the left edge
      const colW = rowArea / h
      let yy = y
      for (const r of row) {
        const hh = r.area / colW
        out.push({ id: r.id, x, y: yy, w: colW, h: hh })
        yy += hh
      }
      x += colW
      w -= colW
    } else {
      const rowH = rowArea / w
      let xx = x
      for (const r of row) {
        const ww = r.area / rowH
        out.push({ id: r.id, x: xx, y, w: ww, h: rowH })
        xx += ww
      }
      y += rowH
      h -= rowH
    }
    rest = rest.slice(count)
  }
  return out
}
