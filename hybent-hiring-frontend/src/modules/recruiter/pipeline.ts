/**
 * The hiring pipeline, as data.
 *
 * These stage lists were declared inline in `CandidatesPage`, mixed into a
 * 220-line array of `<GlassIcon>` elements — so the vocabulary of the product's
 * central domain concept could only be read by reading JSX, and could not be
 * reused by the pipeline board, the talent list or the profile drawer, each of
 * which had grown its own partial copy.
 *
 * Labels and colours are *not* here. Those belong to `StatusPill`, which is the
 * one place a stage string becomes something visible.
 */

/** Terminal stages that mean the candidate is out of the running. */
export const REJECTION_STAGES = [
  'rejected',
  'screening_rejected',
  'pre_screening_rejected',
  'technical_round_rejected',
  'technical_round_back_out',
  'practical_round_rejected',
  'practical_round_back_out',
  'techno_functional_rejected',
  'management_round_rejected',
  'hr_round_rejected',
  'offered_back_out',
  'offer_withdrawn',
] as const

/** Stages that sit before the interview pipeline proper. */
const PRE_PIPELINE_STAGES: Array<string | null | undefined> = [
  null,
  undefined,
  'needs_review',
  'pre_screening',
  'pre_screening_selected',
]

export function isRejectionStage(stage: string | null | undefined): boolean {
  return !!stage && (REJECTION_STAGES as readonly string[]).includes(stage)
}

/** True when the candidate is actively moving through interview rounds. */
export function isCandidateInActivePipeline(stage: string | null | undefined): boolean {
  if (!stage) return false
  if (stage === 'inactive') return false
  if (PRE_PIPELINE_STAGES.includes(stage)) return false
  if (isRejectionStage(stage)) return false
  return true
}

/**
 * Collapses the 34-stage vocabulary to the five buckets the status filter and
 * the status column speak in.
 */
const SCHEDULED_STAGES = [
  'technical_round_selected',
  'practical_round_selected',
  'techno_functional_selected',
  'management_round_selected',
  'hr_round_selected',
  'offered',
  'hired',
  'hired_joined',
  'pre_screening',
  'technical_round',
  'practical_round',
  'techno_functional_round',
  'management_round',
  'hr_round',
  /* legacy values still present on older rows */
  'screening',
  'interview',
  'interviewed',
]

export type CandidateStatus = 'in_review' | 'shortlisted' | 'scheduled' | 'rejected' | 'inactive'

export function statusFromStage(stage: string | null | undefined): CandidateStatus {
  if (!stage || stage === 'applied' || stage === 'needs_review') return 'in_review'
  if (stage === 'pre_screening_selected' || stage === 'completed') return 'shortlisted'
  if (SCHEDULED_STAGES.includes(stage)) return 'scheduled'
  if (stage === 'inactive') return 'inactive'
  if (isRejectionStage(stage)) return 'rejected'
  return 'in_review'
}

/** The stage picker, grouped by round. Labels come from `statusDef`. */
export const STAGE_GROUPS: Array<{ label: string; stages: string[] }> = [
  {
    label: 'Pre-screening',
    stages: ['pre_screening', 'pre_screening_selected', 'pre_screening_rejected'],
  },
  {
    label: 'Technical round',
    stages: [
      'technical_round',
      'technical_round_selected',
      'technical_round_rejected',
      'technical_round_back_out',
    ],
  },
  {
    label: 'Practical round',
    stages: [
      'practical_round',
      'practical_round_selected',
      'practical_round_rejected',
      'practical_round_back_out',
    ],
  },
  {
    label: 'Techno-functional round',
    stages: [
      'techno_functional_round',
      'techno_functional_selected',
      'techno_functional_rejected',
    ],
  },
  {
    label: 'Management round',
    stages: ['management_round', 'management_round_selected', 'management_round_rejected'],
  },
  {
    label: 'HR round',
    stages: ['hr_round', 'hr_round_selected', 'hr_round_rejected'],
  },
  {
    label: 'Offer & joining',
    stages: [
      'completed',
      'offered',
      'offered_back_out',
      'offer_withdrawn',
      'hired_joined',
    ],
  },
]

/** Status filter tabs, in the order they read as a funnel. */
export const STATUS_TABS: Array<{ value: Exclude<CandidateStatus, 'inactive'>; label: string }> = [
  { value: 'in_review', label: 'In review' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'rejected', label: 'Rejected' },
]
