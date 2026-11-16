'use client'

import * as React from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'

type Tip = { x: number; y: number; label: string } | null

export function WorldMap({
  counts,
  max,
}: {
  counts: Record<string, number>
  max: number
}) {
  const [tip, setTip] = React.useState<Tip>(null)
  const [hoverId, setHoverId] = React.useState<string | null>(null)

  function colorFor(id: string): string {
    const c = counts[id] ?? 0
    if (!c || max <= 0) return 'hsl(var(--muted))'
    const t = c / max
    return `hsl(var(--primary) / ${(0.3 + 0.7 * t).toFixed(2)})`
  }

  return (
    <div className="relative" onMouseLeave={() => setTip(null)}>
      <ComposableMap
        projection="geoEqualEarth"
        projectionConfig={{ scale: 150 }}
        width={800}
        height={380}
        style={{ width: '100%', height: 'auto' }}
      >
        <Geographies geography="/geo/world-110m.json">
          {({ geographies }) =>
            geographies.map((geo) => {
              const id = String(geo.id)
              const count = counts[id] ?? 0
              const name = geo.properties?.name ?? ''
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={hoverId === id ? 'hsl(var(--primary))' : colorFor(id)}
                  stroke="hsl(var(--border))"
                  strokeWidth={0.4}
                  onMouseMove={(e: React.MouseEvent) => {
                    setHoverId(id)
                    setTip({
                      x: e.clientX,
                      y: e.clientY,
                      label: `${name}: ${count}`,
                    })
                  }}
                  onMouseLeave={() => {
                    setHoverId(null)
                    setTip(null)
                  }}
                  style={{ outline: 'none' }}
                />
              )
            })
          }
        </Geographies>
      </ComposableMap>

      {tip && (
        <div
          className="pointer-events-none fixed z-50 rounded-md border border-border bg-popover px-2 py-1 text-xs shadow-md"
          style={{ left: tip.x + 12, top: tip.y + 12 }}
        >
          {tip.label}
        </div>
      )}
    </div>
  )
}
