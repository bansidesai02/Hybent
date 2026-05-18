import { DragDropContext, type DropResult } from '@hello-pangea/dnd'
import { KanbanColumn } from './KanbanColumn'
import type { PipelineData, ApplicationStage, KanbanCard } from '@/types'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { candidatesApi } from '@/api/candidates'
import { useNotificationStore } from '@/store/notificationStore'
import toast from 'react-hot-toast'

const STAGES: ApplicationStage[] = ['applied', 'screening', 'interview', 'interviewed', 'offer', 'rejected']

interface KanbanBoardProps {
  data: PipelineData
  onCardClick?: (card: KanbanCard) => void
}

export function KanbanBoard({ data, onCardClick }: KanbanBoardProps) {
  const queryClient = useQueryClient()

  const moveMutation = useMutation({
    mutationFn: ({ candidateId, stage }: { candidateId: string; stage: ApplicationStage }) =>
      candidatesApi.updateStage(candidateId, stage),
    onSuccess: (res: any, variables: { candidateId: string; stage: ApplicationStage }) => {
      queryClient.invalidateQueries({ queryKey: ['candidates_pipeline'] })
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['candidates-for-schedule'] })

      const alertOnOffer = localStorage.getItem('hireon_alert_on_offer') !== 'false'
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
            } max-w-md w-full bg-white dark:bg-[#1a1730] shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-black ring-opacity-5 border border-violet-100 dark:border-[#2a2550]`}
          >
            <div className="flex-1 w-0 p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 pt-0.5">
                  <div className="h-10 w-10 rounded-full bg-violet-50 dark:bg-[#201c3b] flex items-center justify-center text-violet-600 dark:text-violet-400 font-bold text-lg">
                    ✨
                  </div>
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {title}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {message}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex border-l border-gray-100 dark:border-[#201c3b]">
              <button
                onClick={() => toast.dismiss(t.id)}
                className="w-full border border-transparent rounded-none rounded-r-2xl p-4 flex items-center justify-center text-xs font-bold text-violet-600 hover:text-violet-500 dark:text-violet-400 focus:outline-none"
              >
                Close
              </button>
            </div>
          </div>
        ), { duration: 5000 })
      }
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Unable to move candidate as the interview is still pending'
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
      <div className="flex gap-4 pb-4 w-full items-start overflow-x-auto scrollbar-thin">
        {STAGES.map((stage) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            cards={data.stages[stage] ?? []}
            onCardClick={onCardClick}
          />
        ))}
      </div>
    </DragDropContext>
  )
}
