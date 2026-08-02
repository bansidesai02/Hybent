import { Draggable } from '@hello-pangea/dnd'
import type { KanbanCard as KanbanCardType } from '@/types'
import { Avatar, Badge } from '@/components/hb'

/**
 * One candidate on the pipeline board.
 *
 * Rebuilt on the design system in phase 10. `provided.draggableProps` still
 * supplies its own `style` — that is the drag library positioning the card in
 * flight, the one place inline style is unavoidable and not appearance.
 */
export function KanbanCard({
  card,
  index,
  onClick,
}: {
  card: KanbanCardType
  index: number
  onClick?: () => void
}) {
  return (
    <Draggable draggableId={card.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          className={`cursor-pointer select-none rounded-hb-md border bg-hb-surface p-4 shadow-hb-1 transition-all duration-hb ease-hb ${
            snapshot.isDragging
              ? 'scale-[1.03] border-hb-blue/50 shadow-hb-3'
              : 'border-hb-border hover:border-hb-border-strong hover:shadow-hb-2'
          }`}
        >
          <div className="mb-hb-4">
            <p className="truncate text-hb-body font-semibold text-hb-text">
              {card.candidate_name}
            </p>
            {card.current_title && (
              <p className="mt-0.5 truncate text-hb-sm text-hb-muted">{card.current_title}</p>
            )}
          </div>

          <div className="mt-hb-4 flex items-center justify-between border-t border-hb-border pt-3">
            <div className="flex min-w-0 flex-col">
              <span className="mb-1 font-mono text-hb-micro uppercase leading-none text-hb-dim">
                Added by
              </span>
              <span className="max-w-[100px] truncate text-hb-xs font-semibold text-hb-muted">
                {card.created_by_name || 'Admin'}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2.5">
              <Badge tone="brand">{card.match_score}%</Badge>
              <Avatar name={card.candidate_name} size="xs" />
            </div>
          </div>
        </div>
      )}
    </Draggable>
  )
}
