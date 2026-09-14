import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { User } from '@/types'
import { tokenStorage } from '@/utils/tokenStorage'

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
  rememberMe: boolean
  /** False until zustand's async storage rehydration completes. A cold page
   *  load (e.g. landing back on a deep route after the Gmail OAuth redirect)
   *  renders with `isAuthenticated: false` for one tick before persisted
   *  session state is read back in — RequireAuth must wait for this instead
   *  of treating that gap as "logged out". */
  hasHydrated: boolean

  setTokens: (accessToken: string, refreshToken: string | undefined, user?: User, rememberMe?: boolean) => void
  setUser: (user: User) => void
  logout: () => void
  forcedLogoutReason: 'account_deleted' | 'session_expired' | null
  setForcedLogout: (reason: 'account_deleted' | 'session_expired' | null) => void
}

const customPersistStorage = {
  getItem: (name: string) => {
    const sessionVal = sessionStorage.getItem(name)
    if (sessionVal) return sessionVal
    return localStorage.getItem(name)
  },
  setItem: (name: string, value: string) => {
    try {
      const parsed = JSON.parse(value)
      const rememberMe = parsed.state?.rememberMe
      if (rememberMe) {
        localStorage.setItem(name, value)
        sessionStorage.removeItem(name)
      } else {
        sessionStorage.setItem(name, value)
        localStorage.removeItem(name)
      }
    } catch {
      localStorage.setItem(name, value)
    }
  },
  removeItem: (name: string) => {
    localStorage.removeItem(name)
    sessionStorage.removeItem(name)
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      rememberMe: false,
      hasHydrated: false,
      forcedLogoutReason: null,

      setForcedLogout: (reason) => set({ forcedLogoutReason: reason }),

      setTokens: (accessToken, refreshToken, user, rememberMe) => {
        const currentRememberMe = rememberMe !== undefined ? rememberMe : get().rememberMe
        
        tokenStorage.setTokens(accessToken, refreshToken, currentRememberMe)
        
        set(() => ({ 
          accessToken, 
          refreshToken: refreshToken ?? null, 
          ...(user !== undefined && { user: sanitizeUser(user) }),
          rememberMe: currentRememberMe,
          isAuthenticated: true 
        }))
      },

      setUser: (user) => set({ user: sanitizeUser(user) }),

      logout: () => {
        tokenStorage.clear()
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, rememberMe: false, forcedLogoutReason: null })
      },
    }),
    {
      name: 'hybent_hiring_auth',
      storage: createJSONStorage(() => customPersistStorage),
      onRehydrateStorage: () => (state) => {
        // Runs regardless of whether a session was actually persisted — an
        // anonymous visitor still needs hasHydrated flipped, or RequireAuth
        // would wait forever for a login that was never there.
        if (state?.user) state.setUser(state.user)
        useAuthStore.setState({ hasHydrated: true })
      },
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        rememberMe: state.rememberMe,
      }),
    }
  )
)
