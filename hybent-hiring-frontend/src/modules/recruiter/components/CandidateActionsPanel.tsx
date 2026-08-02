import { Ban, Check, FileSignature, Pause, Play, Plus, Trash2 } from 'lucide-react'

import { Button, StatusPill, statusDef } from '@/components/hb'
import { STAGE_GROUPS, isCandidateInActivePipeline } from '@/modules/recruiter/pipeline'

/**
 * Everything you can do to a candidate from a list row.
 *
 * Designed to be the body of a `Drawer`. Both the candidates list and the
 * talent list previously rendered this as an `absolute` dropdown inside the
 * row — the talent list's version carried sixty lines of manual placement
 * arithmetic (measure the viewport, flip up or down, flip left or right,
 * recompute on scroll and on resize via a `ResizeObserver`) to work around
 * being clipped by its own scroll container. A portalled drawer needs none of
 * it and is keyboard-trappable, which the dropdown never was.
 *
 * The active stage carries `aria-current` as well as a pill, so it is announced
 * and not only coloured.
 */
export function CandidateActionsPanel({
  candidate,
  isAdmin,
  hasActiveJobs,
  onStage,
  onAddToPipeline,
  onChangeDesignation,
  onGenerateOffer,
  onDelete,
}: {
  candidate: any
  isAdmin: boolean
  hasActiveJobs: boolean
  onStage: (stage: string) => void
  onAddToPipeline: () => void
  onChangeDesignation: () => void
  /** Omitted where the surface has no offer flow. */
  onGenerateOffer?: () => void
  onDelete: () => void
}) {
  const stage: string = candidate.pipeline_stage || 'applied'
  /* Deliberately `isCandidateInActivePipeline`, not "has a known stage" — the
     talent list used the latter, so a rejected or inactive candidate showed
     "Already in the pipeline" and could never be re-added. */
  const inPipeline = isCandidateInActivePipeline(candidate.pipeline_stage)
  const isInactive = stage === 'inactive'

  const row =
    'flex w-full items-center gap-2.5 rounded-hb-sm px-3 py-2.5 text-left text-hb-sm transition-colors duration-hb focus-visible:outline-none focus-visible:shadow-hb-ring'
  const quiet = ' text-hb-muted hover:bg-hb-surface-2 hover:text-hb-text'

  return (
    <div className="space-y-hb-5 pb-4">
      <section className="space-y-2">
        {hasActiveJobs &&
          (inPipeline ? (
            <p className="flex items-center gap-2 rounded-hb-sm border border-hb-border bg-hb-surface-2 px-3 py-2.5 text-hb-sm text-hb-muted">
              <Check size={14} aria-hidden />
              Already in the pipeline
            </p>
          ) : (
            <Button fullWidth icon={<Plus size={15} />} onClick={onAddToPipeline}>
              Add to pipeline
            </Button>
          ))}

        <Button fullWidth variant="ghost" icon={<Plus size={15} />} onClick={onChangeDesignation}>
          Change designation
        </Button>
      </section>

      {STAGE_GROUPS.map((group) => (
        <section key={group.label}>
          <h3 className="mb-1.5 font-mono text-hb-label uppercase text-hb-dim">{group.label}</h3>
          <ul>
            {group.stages.map((key) => {
              const active = stage === key
              return (
                <li key={key}>
                  <button
                    type="button"
                    aria-current={active ? 'true' : undefined}
                    onClick={() => onStage(key)}
                    className={
                      row +
                      (active ? ' bg-hb-blue/8 font-semibold text-hb-text' : quiet)
                    }
                  >
                    <span className="flex-1">{statusDef(key).label}</span>
                    {active && <StatusPill status={key} label="Current" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      <section>
        <h3 className="mb-1.5 font-mono text-hb-label uppercase text-hb-dim">Record</h3>

        {onGenerateOffer && (
          <button type="button" onClick={onGenerateOffer} className={row + quiet}>
            <FileSignature size={15} aria-hidden />
            Generate offer letter
          </button>
        )}

        <button
          type="button"
          onClick={() => onStage(isInactive ? 'applied' : 'inactive')}
          className={row + quiet}
        >
          {isInactive ? <Play size={15} aria-hidden /> : <Pause size={15} aria-hidden />}
          {isInactive ? 'Activate candidate' : 'Deactivate candidate'}
        </button>

        {!isInactive && !inPipeline && (
          <button type="button" onClick={() => onStage('rejected')} className={row + quiet}>
            <Ban size={15} aria-hidden />
            Reject candidate
          </button>
        )}

        {isAdmin && (
          <button
            type="button"
            onClick={onDelete}
            className={row + ' text-hb-error hover:bg-hb-error/8'}
          >
            <Trash2 size={15} aria-hidden />
            Delete candidate
          </button>
        )}
      </section>
    </div>
  )
}
