'use client'

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import type { PaymentSlice } from '@/lib/analytics'

const RAD = Math.PI / 180

type LabelProps = {
  cx: number
  cy: number
  midAngle: number
  innerRadius: number
  outerRadius: number
  percent: number
}

function renderLabel(props: unknown) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } =
    props as LabelProps
  if (percent < 0.06) return null
  const r = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + r * Math.cos(-midAngle * RAD)
  const y = cy + r * Math.sin(-midAngle * RAD)
  return (
    <text
      x={x}
      y={y}
      fill="#fff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={600}
      style={{ textShadow: '0 1px 3px rgba(0,0,0,.5)' }}
    >
      {Math.round(percent * 100)}%
    </text>
  )
}

export function PaymentDonut({ data }: { data: PaymentSlice[] }) {
  const total = data.reduce((s, d) => s + d.count, 0)
  const slices = data.filter((d) => d.count > 0)

  return (
    <div>
      <div className="relative mx-auto h-56 w-full max-w-xs">
        {total > 0 ? (
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={slices}
                dataKey="count"
                nameKey="label"
                innerRadius="62%"
                outerRadius="92%"
                paddingAngle={slices.length > 1 ? 2 : 0}
                stroke="none"
                startAngle={90}
                endAngle={-270}
                label={renderLabel}
                labelLine={false}
                isAnimationActive={false}
              >
                {slices.map((s) => (
                  <Cell key={s.key} fill={s.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="absolute inset-0 rounded-full border-[18px] border-secondary" />
        )}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="tabular text-3xl font-bold">{total}</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2">
        {data.map((d) => {
          const pct = total > 0 ? Math.round((d.count / total) * 100) : 0
          return (
            <span
              key={d.key}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: d.color }}
              />
              {d.label}
              {d.count > 0 && (
                <span className="tabular font-medium text-foreground">
                  {d.count} ({pct}%)
                </span>
              )}
            </span>
          )
        })}
      </div>
    </div>
  )
}
