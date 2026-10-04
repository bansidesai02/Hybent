import type { ApplicationStage } from '@/types'
import { statusDef } from '@/components/hb'

/** Board headings, where the pipeline stage names differ from the pill's. */
const BOARD_LABEL: Partial<Record<ApplicationStage, string>> = {
  screening: 'Shortlisted',
  interview: 'In interview',
  offer: 'Offer / hired',
}

export function stageLabel(stage: ApplicationStage): string {
  return BOARD_LABEL[stage] ?? statusDef(stage)?.label ?? stage
}
