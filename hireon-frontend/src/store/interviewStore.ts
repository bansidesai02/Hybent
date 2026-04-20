import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const CHECKLIST_CRITERIA = [
  "Review candidate's resume and portfolio",
  "Read the job description and required skills",
  "Test your audio and video setup",
  "Keep a notepad ready for overall summary",
]

interface InterviewState {
  // interviewId -> array of booleans reflecting checklist completion
  checklists: Record<string, boolean[]>
  
  toggleStep: (interviewId: string, index: number) => void
  isComplete: (interviewId: string) => boolean
  resetChecklist: (interviewId: string) => void
}

export const useInterviewStore = create<InterviewState>()(
  persist(
    (set, get) => ({
      checklists: {},

      toggleStep: (interviewId, index) => {
        set((state) => {
          const current = state.checklists[interviewId] || new Array(CHECKLIST_CRITERIA.length).fill(false)
          const next = [...current]
          next[index] = !next[index]
          return {
            checklists: {
              ...state.checklists,
              [interviewId]: next,
            },
          }
        })
      },

      isComplete: (interviewId) => {
        const steps = get().checklists[interviewId]
        if (!steps) return false
        // Ensure at least the current criteria are all checked
        // We slice to handle cases where the persisted array might be longer than current criteria
        const relevantSteps = steps.slice(0, CHECKLIST_CRITERIA.length)
        return relevantSteps.length === CHECKLIST_CRITERIA.length && relevantSteps.every(Boolean)
      },

      resetChecklist: (interviewId) => {
        set((state) => {
          const { [interviewId]: _, ...rest } = state.checklists
          return { checklists: rest }
        })
      },
    }),
    {
      name: 'hireon-interview-storage',
    }
  )
)
