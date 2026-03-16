import { DragDropContext, type DropResult } from '@hello-pangea/dnd'
import { KanbanColumn } from './KanbanColumn'
import type { PipelineData, ApplicationStage, KanbanCard } from '@/types'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { candidatesApi } from '@/api/candidates'

const STAGES: ApplicationStage[] = ['applied', 'screening', 'interview', 'offer', 'rejected']

interface KanbanBoardProps {
  data: PipelineData
  onCardClick?: (card: KanbanCard) => void
}

export function KanbanBoard({ data, onCardClick }: KanbanBoardProps) {
  const queryClient = useQueryClient()

  const moveMutation = useMutation({
    mutationFn: ({ candidateId, stage }: { candidateId: string; stage: ApplicationStage }) =>
      candidatesApi.updateStage(candidateId, stage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates_pipeline'] })
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['candidates-for-schedule'] })
    },
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
      <div className="flex gap-4 pb-4 w-full items-start">
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
