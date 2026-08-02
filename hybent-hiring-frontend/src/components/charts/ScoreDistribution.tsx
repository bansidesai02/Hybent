import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts'

import type { ScoreDistributionBucket } from '@/types'
import { axisProps, ChartTooltip, useChartTheme } from '@/components/hb'

/**
 * Match scores, bucketed.
 *
 * Rebuilt on the design system in phase 10. Here the colour genuinely carries
 * a verdict — a bucket of 0–20% matches is bad news and a bucket of 80–100% is
 * good — so the bars run the product's error → warning → success ladder rather
 * than the categorical series. That is the same three-band scale `ScoreRing`
 * and `Meter` use, so a score means the same thing wherever it appears.
 */
export function ScoreDistribution({ data }: { data: ScoreDistributionBucket[] }) {
  const theme = useChartTheme()

  /* Read the bucket's position in the range, not its index, so a partial
     dataset still colours correctly. */
  const toneFor = (i: number) => {
    const pct = data.length > 1 ? i / (data.length - 1) : 1
    if (pct >= 0.75) return theme.success
    if (pct >= 0.4) return theme.warning
    return theme.error
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <XAxis dataKey="range" {...axisProps(theme)} />
        <YAxis {...axisProps(theme)} />
        <ChartTooltip />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Candidates">
          {data.map((_, i) => (
            <Cell key={i} fill={toneFor(i)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
