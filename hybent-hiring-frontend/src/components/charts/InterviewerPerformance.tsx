import type { InterviewerPerformance } from '@/types'
import { Avatar } from '@/components/hb'

export function InterviewerPerformanceTable({ data }: { data: InterviewerPerformance[] }) {
  return (
    <div className="divide-y divide-hb-border">
      {data.map((row) => (
        <div key={row.interviewer_id} className="flex items-center gap-3 py-3">
          <Avatar name={row.interviewer_name} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="truncate text-hb-sm font-semibold text-hb-text">
              {row.interviewer_name}
            </p>
          </div>
          <div className="text-right space-y-0.5">
            <p className="text-hb-sm font-semibold text-hb-muted">
              {row.interviews_conducted} interviews
            </p>
            <p className="text-hb-xs text-hb-dim">
              Avg rating: {row.avg_rating_given != null ? row.avg_rating_given.toFixed(1) : '—'}/5
            </p>
          </div>
        </div>
      ))}
      {data.length === 0 && (
        <p className="py-6 text-center text-hb-sm text-hb-dim">No data yet</p>
      )}
    </div>
  )
}
