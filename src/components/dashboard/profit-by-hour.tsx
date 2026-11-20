'use client'

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  ReferenceLine,
  LabelList,
  ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

export type HourProfit = { label: string; profit: number }

export function ProfitByHour({ data }: { data: HourProfit[] }) {
  const POS = 'hsl(222 85% 58%)'
  const NEG = 'hsl(var(--destructive))'

  return (
    <div>
      <div className="mb-2 flex items-center justify-center gap-5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: POS }} />
          Lucro +
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: NEG }} />
          Prejuízo −
        </span>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <BarChart
            data={data}
            margin={{ top: 20, right: 6, left: 0, bottom: 0 }}
          >
            <XAxis
              dataKey="label"
              interval={0}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis hide />
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
            <Bar dataKey="profit" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.profit >= 0 ? POS : NEG} />
              ))}
              <LabelList
                dataKey="profit"
                position="top"
                formatter={(v) => {
                  const n = Number(v)
                  return n !== 0 ? formatCurrency(n) : ''
                }}
                style={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
