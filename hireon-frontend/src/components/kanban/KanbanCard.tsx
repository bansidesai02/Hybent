import { Draggable } from '@hello-pangea/dnd'
import type { KanbanCard as KanbanCardType } from '@/types'
import { Avatar } from '@/components/ui/Avatar'
import { ScoreRing } from '@/components/ui/ScoreRing'
import { Badge } from '@/components/ui/Badge'
import { timeAgo } from '@/utils/formatters'

interface KanbanCardProps {
  card: KanbanCardType
  index: number
  onClick?: () => void
}

export function KanbanCard({ card, index, onClick }: KanbanCardProps) {
  return (
    <Draggable draggableId={card.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          className={`
            bg-white dark:bg-[var(--card-bg)] rounded-xl p-4 border border-gray-100 dark:border-[var(--card-border)]
            cursor-pointer select-none transition-all duration-200 shadow-sm
            ${snapshot.isDragging
              ? 'shadow-xl scale-105 border-[var(--violet)]/50 dark:border-[var(--violet)]'
              : 'hover:shadow-md hover:border-gray-200 dark:hover:border-[var(--input-border)]'
            }
          `}
        >
          <div className="mb-4">
            <p className="text-[15px] font-bold text-gray-900 dark:text-[var(--text)] truncate">
              {card.candidate_name}
            </p>
            {card.current_title && (
              <p className="text-[13px] text-gray-400 dark:text-[var(--text-light)] truncate mt-0.5 font-medium">
                {card.current_title}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50 dark:border-[var(--border)]/40">
            <div className="flex flex-col">
              <span className="text-[9px] uppercase text-gray-400 dark:text-[var(--text-light)] font-bold leading-none mb-1">Added By</span>
              <span className="text-[11px] font-bold text-gray-700 dark:text-[var(--text-mid)] truncate max-w-[100px]">
                {card.created_by_name || 'Admin'}
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <div 
                className="bg-[var(--violet)]/10 text-[var(--violet)] px-2 py-1 rounded-lg text-[11px] font-black"
                style={{ letterSpacing: '0.2px' }}
              >
                {card.match_score}%
              </div>
              <div className="opacity-90">
                <Avatar name={card.candidate_name} size="xs" />
              </div>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  )
}
