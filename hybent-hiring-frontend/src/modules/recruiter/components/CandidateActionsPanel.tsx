import {
  Ban,
  Check,
  FileSignature,
  Pause,
  Play,
  Plus,
  Trash2,
  Briefcase,
  UserCheck,
  ChevronRight,
  Sparkles,
} from 'lucide-react'

import { Avatar, Button, StatusPill, statusDef } from '@/components/hb'
import { STAGE_GROUPS, isCandidateInActivePipeline } from '@/modules/recruiter/pipeline'

/**
 * Everything you can do to a candidate from a list row.
 * Enhanced with modern visual hierarchy and sleek stage selection UI.
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
  const inPipeline = isCandidateInActivePipeline(candidate.pipeline_stage)
  const isInactive = stage === 'inactive'

  return (
    <div className="space-y-hb-5 pb-6">
      {/* ── Candidate Summary Banner ── */}
      <div className="relative overflow-hidden rounded-hb border border-hb-border bg-gradient-to-br from-hb-surface to-hb-surface-2 p-4 shadow-sm">
        <div className="absolute right-0 top-0 h-24 w-24 translate-x-6 -translate-y-6 rounded-full bg-hb-blue/5 blur-2xl pointer-events-none" />
        <div className="flex items-center gap-3">
          <Avatar
            name={candidate?.full_name || 'Candidate'}
            src={candidate?.avatar_url}
            size="lg"
            className="ring-2 ring-hb-blue/20 shadow-sm"
          />
          <div className="min-w-0 flex-1">
            <h4 className="truncate font-display text-hb-h4 text-hb-text font-bold">
              {candidate?.full_name || 'Candidate'}
            </h4>
            <p className="truncate text-hb-xs text-hb-muted">{candidate?.email || '—'}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-hb-full bg-hb-surface-3 px-2.5 py-0.5 text-hb-micro font-medium text-hb-muted border border-hb-border">
                <Briefcase size={11} className="text-hb-blue" />
                {candidate?.applied_job_title || candidate?.current_title || 'General Pool'}
              </span>
              {candidate?.pipeline_stage && (
                <StatusPill status={candidate.pipeline_stage} label="Active Stage" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Pipeline & Designation Actions ── */}
      <section className="grid gap-2">
        {hasActiveJobs &&
          (inPipeline ? (
            <div className="flex items-center gap-2.5 rounded-hb border border-emerald-500/20 bg-emerald-500/8 px-3.5 py-2.5 text-hb-sm font-medium text-emerald-600 dark:text-emerald-400">
              <UserCheck size={16} className="shrink-0" />
              <span>Currently active in hiring pipeline</span>
            </div>
          ) : (
            <Button
              fullWidth
              variant="primary"
              icon={<Plus size={15} />}
              onClick={onAddToPipeline}
              className="shadow-sm shadow-hb-blue/20"
            >
              Add to pipeline
            </Button>
          ))}

        <Button
          fullWidth
          variant="ghost"
          icon={<Briefcase size={15} />}
          onClick={onChangeDesignation}
        >
          Change designation
        </Button>
      </section>

      {/* ── Stage Groups ── */}
      <div className="space-y-4">
        {STAGE_GROUPS.map((group) => (
          <section key={group.label} className="space-y-1.5">
            <div className="flex items-center gap-2 px-1">
              <span className="h-1.5 w-1.5 rounded-full bg-hb-blue" />
              <h3 className="font-mono text-hb-micro font-semibold uppercase tracking-wider text-hb-muted">
                {group.label}
              </h3>
              <span className="h-px flex-1 bg-hb-border/60" />
            </div>
            <div className="grid gap-1">
              {group.stages.map((key) => {
                const active = stage === key
                return (
                  <button
                    key={key}
                    type="button"
                    aria-current={active ? 'true' : undefined}
                    onClick={() => onStage(key)}
                    className={
                      'group relative flex w-full items-center justify-between gap-3 rounded-hb px-3.5 py-2.5 text-left text-hb-sm transition-all duration-hb focus-visible:outline-none focus-visible:shadow-hb-ring ' +
                      (active
                        ? 'border-l-4 border-hb-blue bg-hb-blue/10 font-semibold text-hb-text shadow-sm'
                        : 'border border-transparent bg-hb-surface-2/60 text-hb-muted hover:border-hb-border-strong hover:bg-hb-surface-2 hover:text-hb-text hover:translate-x-0.5')
                    }
                  >
                    <span className="flex items-center gap-2 truncate">
                      {active && <Sparkles size={14} className="shrink-0 text-hb-blue" />}
                      <span className="truncate">{statusDef(key).label}</span>
                    </span>
                    {active ? (
                      <StatusPill status={key} label="Current" />
                    ) : (
                      <ChevronRight
                        size={14}
                        className="shrink-0 text-hb-dim opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {/* ── Record Management ── */}
      <section className="space-y-1.5 pt-2 border-t border-hb-border">
        <div className="flex items-center gap-2 px-1">
          <span className="h-1.5 w-1.5 rounded-full bg-hb-muted" />
          <h3 className="font-mono text-hb-micro font-semibold uppercase tracking-wider text-hb-muted">
            Record Actions
          </h3>
          <span className="h-px flex-1 bg-hb-border/60" />
        </div>

        <div className="grid gap-1">
          {onGenerateOffer && (
            <button
              type="button"
              onClick={onGenerateOffer}
              className="flex w-full items-center gap-2.5 rounded-hb px-3.5 py-2.5 text-left text-hb-sm text-hb-text transition-colors duration-hb hover:bg-hb-surface-2 focus-visible:outline-none"
            >
              <FileSignature size={15} className="text-hb-blue" />
              <span>Generate offer letter</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onStage(isInactive ? 'applied' : 'inactive')}
            className="flex w-full items-center gap-2.5 rounded-hb px-3.5 py-2.5 text-left text-hb-sm text-hb-muted transition-colors duration-hb hover:bg-hb-surface-2 hover:text-hb-text focus-visible:outline-none"
          >
            {isInactive ? (
              <Play size={15} className="text-emerald-500" />
            ) : (
              <Pause size={15} className="text-amber-500" />
            )}
            <span>{isInactive ? 'Activate candidate' : 'Deactivate candidate'}</span>
          </button>

          {!isInactive && !inPipeline && (
            <button
              type="button"
              onClick={() => onStage('rejected')}
              className="flex w-full items-center gap-2.5 rounded-hb px-3.5 py-2.5 text-left text-hb-sm text-amber-600 dark:text-amber-400 transition-colors duration-hb hover:bg-amber-500/10 focus-visible:outline-none"
            >
              <Ban size={15} />
              <span>Reject candidate</span>
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={onDelete}
              className="flex w-full items-center gap-2.5 rounded-hb px-3.5 py-2.5 text-left text-hb-sm font-medium text-hb-error transition-colors duration-hb hover:bg-hb-error/10 focus-visible:outline-none"
            >
              <Trash2 size={15} />
              <span>Delete candidate</span>
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
