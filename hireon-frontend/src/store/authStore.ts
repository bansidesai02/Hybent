import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'

const VERSION_TAG_RE = /\s*\[v\d+(?:\.\d+)*\]\s*/gi

function sanitizeUser(user: User): User {
  return {
    ...user,
    full_name: user.full_name.replace(VERSION_TAG_RE, ' ').replace(/\s+/g, ' ').trim(),
  }
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean

  setTokens: (accessToken: string, refreshToken: string | undefined, user?: User) => void
  setUser: (user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setTokens: (accessToken, refreshToken, user) => {
        localStorage.setItem('hireon_access_token', accessToken)
        if (refreshToken) localStorage.setItem('hireon_refresh_token', refreshToken)
        set((state) => ({ 
          accessToken, 
          refreshToken: refreshToken ?? null, 
          ...(user !== undefined && { user: sanitizeUser(user) }),
          isAuthenticated: true 
        }))
      },

      setUser: (user) => set({ user: sanitizeUser(user) }),

      logout: () => {
        localStorage.removeItem('hireon_access_token')
        localStorage.removeItem('hireon_refresh_token')
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
      },
    }),
    {
      name: 'hireon_auth',
      onRehydrateStorage: () => (state) => {
        if (!state?.user) return
        state.setUser(state.user)
      },
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
