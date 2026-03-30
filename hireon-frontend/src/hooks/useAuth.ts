import { useAuthStore } from '@/store/authStore'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { useQueryClient } from '@tanstack/react-query'

export function useAuth() {
  const { user, isAuthenticated, setTokens, logout: storeLogout } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const login = async (email: string, password: string) => {
    const { data } = await authApi.login(email, password)
    setTokens(data.access_token, undefined, data.user)
    // Role-based redirect
    if (data.user.role === 'candidate') navigate('/portal')
    else if (data.user.role === 'interviewer') navigate('/interviewer')
    else if (data.user.role === 'admin') navigate('/admin')
    else navigate('/recruiter')
  }

  const basePath = user?.role === 'admin' ? '/admin' : 
                   user?.role === 'interviewer' ? '/interviewer' : 
                   user?.role === 'candidate' ? '/portal' : '/recruiter'

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('hireon_refresh_token') ?? undefined
      await authApi.logout(refreshToken)
    } catch (_) {
      // ignore errors
    }
    // Clear ALL React Query cache so the next user never sees stale data
    queryClient.clear()
    storeLogout()
    navigate('/login')
  }

  return { user, isAuthenticated, login, logout, basePath }
}
