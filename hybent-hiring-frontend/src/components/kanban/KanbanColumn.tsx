import { Droppable } from '@hello-pangea/dnd'
import { clsx } from 'clsx'

import { KanbanCard } from './KanbanCard'
import type { KanbanCard as KanbanCardType, ApplicationStage } from '@/types'
import { Badge, statusDef } from '@/components/hb'

/**
 * One column of the pipeline board.
 *
 * Rebuilt on the design system in phase 10. `stageConfig` gave each of the six
 * stages its own hex, painted as a 4px top border and a dot — six colours to
 * distinguish six columns that are already side by side, in order, each with
 * its name in the header. The stage label now comes from `statusDef`, the same
 * source `StatusPill` uses everywhere else, so a stage is worded identically
 * on the board and in a table.
 */

/** Board headings, where the pipeline stage names differ from the pill's. */
const BOARD_LABEL: Partial<Record<ApplicationStage, string>> = {
  screening: 'Shortlisted',
  interview: 'In interview',
  offer: 'Offer / hired',
}

export function KanbanColumn({
  stage,
  cards,
  onCardClick,
}: {
  stage: ApplicationStage
  cards: KanbanCardType[]
  onCardClick?: (card: KanbanCardType) => void
}) {
  const label = BOARD_LABEL[stage] ?? statusDef(stage)?.label ?? stage

  return (
    <div className="flex min-w-[280px] shrink-0 flex-col rounded-hb-md border border-hb-border bg-hb-surface-2 sm:min-w-[250px] lg:min-w-[220px] lg:flex-1">
      <div className="flex items-center gap-2 border-b border-hb-border px-3 py-2.5">
        <span className="text-hb-sm font-semibold text-hb-text">{label}</span>
        <Badge className="ml-auto">{cards.length}</Badge>
      </div>

      <Droppable droppableId={stage}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={clsx(
              'min-h-24 flex-1 space-y-2 p-2 transition-colors duration-hb',
              snapshot.isDraggingOver && 'bg-hb-blue/[0.06]'
            )}
          >
            {cards.map((card, idx) => (
              <KanbanCard
                key={card.id}
                card={card}
                index={idx}
                onClick={() => onCardClick?.(card)}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  )
}
