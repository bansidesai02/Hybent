import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type Theme = 'light' | 'dark'

interface ThemeState {
  theme: Theme
  /** False until zustand's storage rehydration completes — see `AppShell`,
   *  which waits for this before touching the document, so it never
   *  overwrites the pre-paint script's already-correct guess with the
   *  in-memory default and flashes light->dark on a hard reload. */
  hasHydrated: boolean
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

// Captured from inside the creator below — see the identical pattern (and its
// comment) in `authStore.ts`. `onRehydrateStorage`'s callback can fire before
// `create()` returns, and referencing `useThemeStore` there throws "Cannot
// access 'useThemeStore' before initialization".
let themeStoreSet: ((partial: Partial<ThemeState>) => void) | null = null

/**
 * Persists only inside the authenticated product — see `AppShell`, which is
 * the sole reader that ever applies this to the document. The marketing site
 * and the auth pages never consult it, so a stored preference here cannot
 * leak into a surface that's meant to stay light.
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => {
      themeStoreSet = set
      return {
        theme: 'light',
        hasHydrated: false,
        setTheme: (theme: Theme) => set({ theme }),
        toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
      }
    },
    {
      name: 'hybent_hiring_theme',
      storage: createJSONStorage(() => localStorage),
      // Runs regardless of whether a preference was actually persisted — a
      // first-time visitor still needs `hasHydrated` flipped, or `AppShell`
      // would wait forever for a rehydration that was never coming.
      onRehydrateStorage: () => () => {
        themeStoreSet?.({ hasHydrated: true })
      },
    }
  )
)
