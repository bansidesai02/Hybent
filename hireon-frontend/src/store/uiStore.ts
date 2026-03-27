import { create } from 'zustand'

interface UIState {
  isLoading: boolean
  loadingMessage: string | null
  requestCount: number
  
  startLoading: (message?: string) => void
  stopLoading: () => void
  setLoadingMessage: (message: string | null) => void
}

export const useUIStore = create<UIState>((set) => ({
  isLoading: false,
  loadingMessage: null,
  requestCount: 0,

  startLoading: (message) => set((state) => ({
    isLoading: true,
    requestCount: state.requestCount + 1,
    loadingMessage: message || state.loadingMessage
  })),

  stopLoading: () => set((state) => {
    const nextCount = Math.max(0, state.requestCount - 1)
    return {
      requestCount: nextCount,
      isLoading: nextCount > 0,
      loadingMessage: nextCount > 0 ? state.loadingMessage : null
    }
  }),

  setLoadingMessage: (message) => set({ loadingMessage: message })
}))
