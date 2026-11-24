/**
 * ApprovalSteps
 * The numbered list on an approval card when the Copilot plans several
 * actions at once ("shortlist the top 3 and email each"). The recruiter
 * approves the whole list; the actions then run in this order.
 * Each step's details (e.g. an email's subject and body) open on click.
 */
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

export type ApprovalStep = { name: string; title: string; args?: Record<string, unknown> }

/* Shown on the step's own line already, or internal. */
const HIDDEN_ARGS = new Set(['candidate_id'])

function label(key: string) {
  return key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

function StepRow({ step, index }: { step: ApprovalStep; index: number }) {
  const [open, setOpen] = useState(false)
  const details = Object.entries(step.args ?? {}).filter(([k, v]) => !HIDDEN_ARGS.has(k) && v !== '' && v != null)
  return (
    <li className="rounded-hb-sm border border-hb-border bg-hb-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start gap-2.5 px-3 py-2 text-left"
      >
        <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-hb-blue/10 text-[11px] font-semibold text-hb-blue">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1 break-words text-hb-sm text-hb-text">{step.title}</span>
        {details.length > 0 && (
          <ChevronDown size={14} aria-hidden className={`mt-0.5 shrink-0 text-hb-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>
      {open && details.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-hb-border px-3 py-2 text-hb-xs">
          {details.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-hb-muted">{label(k)}</dt>
              <dd className="whitespace-pre-wrap break-words text-hb-text">{String(v)}</dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  )
}

export function ApprovalSteps({ steps }: { steps: ApprovalStep[] }) {
  return (
    <div>
      <p className="mb-2 text-hb-xs text-hb-muted">
        {steps.length} actions · run in this order after you approve. Tap a step to see its details.
      </p>
      <ol className="grid gap-1.5">
        {steps.map((s, i) => (
          <StepRow key={i} step={s} index={i} />
        ))}
      </ol>
    </div>
  )
}
