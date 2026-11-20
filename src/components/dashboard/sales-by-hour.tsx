'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  LabelList,
  ResponsiveContainer,
} from 'recharts'
import type { HourBucket } from '@/lib/analytics'

export function SalesByHour({ data }: { data: HourBucket[] }) {
  const total = data.reduce((s, d) => s + d.count, 0)
  const rows = data.map((d) => ({
    ...d,
    pct: total > 0 ? (d.count / total) * 100 : 0,
  }))

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 20, right: 6, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="label"
            interval={0}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis hide />
          <Bar
            dataKey="count"
            radius={[3, 3, 0, 0]}
            fill="hsl(222 85% 58%)"
            isAnimationActive={false}
          >
            <LabelList
              dataKey="pct"
              position="top"
              formatter={(v) => {
                const n = Number(v)
                return n > 0 ? `${n.toFixed(1)}%` : ''
              }}
              style={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
