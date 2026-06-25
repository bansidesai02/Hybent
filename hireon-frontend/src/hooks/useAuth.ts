import { useAuthStore } from '@/store/authStore'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { useQueryClient } from '@tanstack/react-query'
import { tokenStorage } from '@/utils/tokenStorage'

export function useAuth() {
  const { user, isAuthenticated, setTokens, logout: storeLogout } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const login = async (email: string, password: string) => {
    const { data } = await authApi.login(email, password)
    const user = data.user ?? (await authApi.me()).data
    setTokens(data.access_token, data.refresh_token, user)

    // Role-based redirect
    if (user.role === 'super_admin') navigate('/super-admin')
    else if (user.role === 'candidate') navigate('/portal')
    else if (user.role === 'interviewer') navigate('/interviewer')
    else if (user.role === 'admin') navigate('/admin')
    else navigate('/recruiter')
  }

  const basePath = user?.role === 'super_admin' ? '/super-admin' :
                   user?.role === 'admin' ? '/admin' : 
                   user?.role === 'interviewer' ? '/interviewer' : 
                   user?.role === 'candidate' ? '/portal' : '/recruiter'

  const logout = async () => {
    // If we are currently impersonating, logout should exit impersonation instead of logging out the admin entirely
    if (user?.is_impersonating) {
      exitImpersonation()
      return
    }

    try {
      const refreshToken = tokenStorage.getRefreshToken() ?? undefined
      await authApi.logout(refreshToken)
    } catch (_) {
      // ignore errors
    }
    // Clear ALL React Query cache so the next user never sees stale data
    queryClient.clear()
    storeLogout()
    navigate('/login')
  }

  const exitImpersonation = () => {
    const adminToken = localStorage.getItem('hireon_super_admin_access_token') || sessionStorage.getItem('hireon_super_admin_access_token')
    const adminRefreshToken = localStorage.getItem('hireon_super_admin_refresh_token') || sessionStorage.getItem('hireon_super_admin_refresh_token')
    const adminUserStr = localStorage.getItem('hireon_super_admin_user') || sessionStorage.getItem('hireon_super_admin_user')

    if (adminToken && adminUserStr) {
      const adminUser = JSON.parse(adminUserStr)
      setTokens(adminToken, adminRefreshToken || undefined, adminUser)
      
      localStorage.removeItem('hireon_super_admin_access_token')
      localStorage.removeItem('hireon_super_admin_refresh_token')
      localStorage.removeItem('hireon_super_admin_user')
      sessionStorage.removeItem('hireon_super_admin_access_token')
      sessionStorage.removeItem('hireon_super_admin_refresh_token')
      sessionStorage.removeItem('hireon_super_admin_user')
      
      queryClient.clear()
      navigate('/super-admin')
    } else {
      // fallback if backup doesn't exist
      queryClient.clear()
      storeLogout()
      navigate('/login')
    }
  }

  const isAdmin = user?.role === 'admin'
  const isSuperAdmin = user?.role === 'super_admin'
  const isImpersonating = !!user?.is_impersonating

  return { user, isAuthenticated, login, logout, basePath, isAdmin, isSuperAdmin, isImpersonating, exitImpersonation }
}
