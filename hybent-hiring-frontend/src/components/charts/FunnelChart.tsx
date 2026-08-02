import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from 'recharts'

import type { FunnelData } from '@/types'
import { axisProps, ChartTooltip, useChartTheme } from '@/components/hb'

/**
 * The hiring funnel, stage by stage.
 *
 * Rebuilt on the design system in phase 10. The six bar colours were a
 * hardcoded `COLORS` array; they now come from `theme.series`, which reads the
 * live `--hb-*` tokens. One colour per stage stays, because the funnel is read
 * left to right as a sequence — the palette's own progression is the cue.
 */
export function FunnelChart({ data }: { data: FunnelData }) {
  const theme = useChartTheme()

  const chartData = data.stages.map((s) => ({
    name: s.stage.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    count: s.count,
    percentage: s.percentage,
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
        <XAxis dataKey="name" {...axisProps(theme)} />
        <YAxis {...axisProps(theme)} />
        <ChartTooltip formatter={(value: number) => [value, 'Candidates']} />
        <Bar dataKey="count" name="Candidates" radius={[6, 6, 0, 0]}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={theme.series[i % theme.series.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
