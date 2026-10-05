import { useEffect, useRef, useState } from 'react'
import { DragDropContext, type DropResult } from '@hello-pangea/dnd'
import { clsx } from 'clsx'
import { KanbanColumn } from './KanbanColumn'
import { stageLabel } from './stages'
import type { PipelineData, ApplicationStage, KanbanCard } from '@/types'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { candidatesApi } from '@/api/candidates'
import { useNotificationStore } from '@/store/notificationStore'
import toast from 'react-hot-toast'
import { Sparkles } from 'lucide-react'

const STAGES: ApplicationStage[] = ['applied', 'screening', 'interview', 'interviewed', 'offer', 'rejected']

interface KanbanBoardProps {
  data: PipelineData
  onCardClick?: (card: KanbanCard) => void
}

export function KanbanBoard({ data, onCardClick }: KanbanBoardProps) {
  const queryClient = useQueryClient()

  /* Phones: one stage per screen. The chip row jumps between stages and
     follows the swipe, so you always know which stage you're looking at. */
  const scrollerRef = useRef<HTMLDivElement>(null)
  const chipsRef = useRef<HTMLDivElement>(null)
  const [activeStage, setActiveStage] = useState<ApplicationStage>(STAGES[0])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const onScroll = () => {
      const cols = Array.from(el.querySelectorAll<HTMLElement>('[data-stage]'))
      const left = el.scrollLeft + 8
      const current = cols.reduce((best, col) => (col.offsetLeft - el.offsetLeft <= left ? col : best), cols[0])
      const stage = current?.dataset.stage as ApplicationStage | undefined
      if (stage) setActiveStage(stage)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // Keep the active chip in view as you swipe.
  useEffect(() => {
    chipsRef.current
      ?.querySelector<HTMLElement>(`[data-chip="${activeStage}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [activeStage])

  const jumpTo = (stage: ApplicationStage) => {
    const el = scrollerRef.current
    const col = el?.querySelector<HTMLElement>(`[data-stage="${stage}"]`)
    if (el && col) el.scrollTo({ left: col.offsetLeft - el.offsetLeft, behavior: 'smooth' })
  }

  const moveMutation = useMutation({
    mutationFn: ({ candidateId, stage }: { candidateId: string; stage: ApplicationStage }) =>
      candidatesApi.updateStage(candidateId, stage),
    onSuccess: (res: any, variables: { candidateId: string; stage: ApplicationStage }) => {
      queryClient.invalidateQueries({ queryKey: ['candidates_pipeline'] })
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['candidates-for-schedule'] })

      const alertOnOffer = localStorage.getItem('hybent_hiring_alert_on_offer') !== 'false'
      if (alertOnOffer && variables.stage === 'offer') {
        // Find candidate's card to get their name
        let candidateName = 'A candidate'
        for (const stageCards of Object.values(data.stages)) {
          const card = stageCards.find(c => c.id === variables.candidateId)
          if (card) {
            candidateName = card.candidate_name
            break
          }
        }

        const title = 'Stage Reached: Offer'
        const message = `Candidate ${candidateName} has entered the "Offer" stage!`

        // Trigger in-app notification in store
        useNotificationStore.getState().addNotification({
          id: crypto.randomUUID(),
          organization_id: '',
          user_id: '',
          type: 'system',
          title,
          message,
          data: null,
          is_read: false,
          read_at: null,
          created_at: new Date().toISOString(),
        })

        // Show premium toast
        toast.custom((t) => (
          <div
            className={`${
              t.visible ? 'animate-enter' : 'animate-leave'
            } pointer-events-auto flex w-full max-w-md rounded-hb-lg border border-hb-border bg-hb-elevated shadow-hb-3`}
          >
            <div className="flex-1 w-0 p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 pt-0.5">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-hb-blue/10 text-hb-cyan">
                    <Sparkles size={18} aria-hidden />
                  </div>
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-hb-sm font-semibold text-hb-text">
                    {title}
                  </p>
                  <p className="mt-1 text-hb-xs text-hb-muted">
                    {message}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex border-l border-hb-border">
              <button
                onClick={() => toast.dismiss(t.id)}
                className="flex w-full items-center justify-center rounded-r-hb-lg border border-transparent p-4 text-hb-xs font-semibold text-hb-cyan transition-colors duration-hb hover:text-hb-text focus:outline-none"
              >
                Close
              </button>
            </div>
          </div>
        ), { duration: 5000 })
      }
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Unable to move candidate as the interview is still pending'
      toast.error(message)
      queryClient.invalidateQueries({ queryKey: ['candidates_pipeline'] })
    }
  })

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const newStage = destination.droppableId as ApplicationStage
    moveMutation.mutate({ candidateId: draggableId, stage: newStage })
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      {/* Stage switcher — phones only. */}
      <div ref={chipsRef} role="tablist" aria-label="Pipeline stages" className="hb-scroll-x -mx-4 mb-3 gap-2 px-4 md:hidden">
        {STAGES.map((stage) => {
          const active = stage === activeStage
          const count = data.stages[stage]?.length ?? 0
          return (
            <button
              key={stage}
              type="button"
              role="tab"
              aria-selected={active}
              data-chip={stage}
              onClick={() => jumpTo(stage)}
              className={clsx(
                'flex h-9 items-center gap-1.5 whitespace-nowrap rounded-hb-full border px-3.5 text-hb-sm font-semibold transition-colors duration-hb',
                active
                  ? 'border-hb-blue/40 bg-hb-blue/10 text-hb-text'
                  : 'border-hb-border bg-hb-surface text-hb-muted'
              )}
            >
              {stageLabel(stage)}
              <span className={clsx('font-mono text-hb-xs', active ? 'text-hb-blue' : 'text-hb-dim')}>{count}</span>
            </button>
          )
        })}
      </div>

      <div
        ref={scrollerRef}
        className="flex w-full snap-x snap-mandatory items-start gap-4 overflow-x-auto pb-4 scrollbar-thin md:snap-none"
      >
        {STAGES.map((stage) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            cards={data.stages[stage] ?? []}
            onCardClick={onCardClick}
            stages={STAGES}
            onMove={(card, to) => {
              if (to !== stage) moveMutation.mutate({ candidateId: card.id, stage: to })
            }}
          />
        ))}
      </div>
    </DragDropContext>
  )
}
