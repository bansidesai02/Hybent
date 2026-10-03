/**
 * CopilotSteps
 * Live "what the agent is doing" timeline shown above an assistant reply,
 * like Claude / Cursor: each step spins while it runs, then gets a tick and
 * a short result ("Found 12 candidates"). Once the reply is done the
 * timeline folds into a single "Worked for 3s · 2 steps" line that can be
 * expanded again. Replies that needed no lookups show nothing afterwards.
 */
import { useEffect, useState } from 'react'
import { Check, ChevronDown, ChevronRight, Loader2, X } from 'lucide-react'
import type { CopilotStep } from '@/store/useCopilotStore'

interface CopilotStepsProps {
  steps?: CopilotStep[]
  startedAt?: number
  finishedAt?: number
  /** True once answer text has started streaming. */
  hasContent: boolean
}

function StepIcon({ state }: { state: CopilotStep['state'] }) {
  if (state === 'running') return <Loader2 size={13} className="shrink-0 animate-spin text-hb-blue" />
  if (state === 'error') return <X size={13} className="shrink-0 text-hb-error" />
  return <Check size={13} className="shrink-0 text-hb-success" />
}

function StepRow({ step }: { step: CopilotStep }) {
  return (
    <li className="flex min-w-0 items-start gap-2 py-0.5">
      <span className="mt-[3px]">
        <StepIcon state={step.state} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={step.state === 'running' ? 'text-hb-text' : 'text-hb-muted'}>
          {step.label}
          {step.state === 'running' && '…'}
        </span>
        {step.detail && step.state !== 'running' && <span className="text-hb-dim"> — {step.detail}</span>}
      </span>
    </li>
  )
}

export function CopilotSteps({ steps, startedAt, finishedAt, hasContent }: CopilotStepsProps) {
  const [expanded, setExpanded] = useState<boolean | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const all = steps ?? []
  const toolSteps = all.filter((s) => s.tool)
  const running = all.some((s) => s.state === 'running')
  const active = running || !finishedAt

  // Tick the elapsed timer only while the agent is working.
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [active])

  if (all.length === 0) return null
  if (!active && toolSteps.length === 0) return null

  // While working: show tool steps plus whichever "thinking" step is live.
  const visible = all.filter((s) => s.tool || s.state === 'running')
  const elapsed = Math.max(1, Math.round(((finishedAt ?? now) - (startedAt ?? now)) / 1000))
  const collapsed = expanded === null ? !running && hasContent : !expanded

  if (active && !collapsed) {
    return (
      <ul className="mb-2 border-l-2 border-hb-blue/25 pl-3 text-hb-xs" aria-live="polite">
        {visible.map((s) => (
          <StepRow key={s.id} step={s} />
        ))}
      </ul>
    )
  }

  const label = active
    ? `Working · ${elapsed}s`
    : `Worked for ${elapsed}s · ${toolSteps.length} step${toolSteps.length === 1 ? '' : 's'}`

  return (
    <div className="mb-2 text-hb-xs">
      <button
        type="button"
        onClick={() => setExpanded(collapsed)}
        className="flex items-center gap-1 text-hb-dim transition-colors hover:text-hb-muted"
        aria-expanded={!collapsed}
      >
        {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
        {label}
      </button>
      {!collapsed && (
        <ul className="mt-1 border-l-2 border-hb-border pl-3">
          {(active ? visible : toolSteps).map((s) => (
            <StepRow key={s.id} step={s} />
          ))}
        </ul>
      )}
    </div>
  )
}
