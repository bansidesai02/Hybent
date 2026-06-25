export const tokenStorage = {
  getAccessToken: (): string | null => {
    return localStorage.getItem('hireon_access_token') || sessionStorage.getItem('hireon_access_token')
  },
  getRefreshToken: (): string | null => {
    return localStorage.getItem('hireon_refresh_token') || sessionStorage.getItem('hireon_refresh_token')
  },
  setTokens: (accessToken: string, refreshToken: string | undefined, rememberMe: boolean) => {
    if (rememberMe) {
      localStorage.setItem('hireon_access_token', accessToken)
      if (refreshToken) localStorage.setItem('hireon_refresh_token', refreshToken)
      sessionStorage.removeItem('hireon_access_token')
      sessionStorage.removeItem('hireon_refresh_token')
    } else {
      sessionStorage.setItem('hireon_access_token', accessToken)
      if (refreshToken) sessionStorage.setItem('hireon_refresh_token', refreshToken)
      localStorage.removeItem('hireon_access_token')
      localStorage.removeItem('hireon_refresh_token')
    }
  },
  clear: () => {
    localStorage.removeItem('hireon_access_token')
    localStorage.removeItem('hireon_refresh_token')
    sessionStorage.removeItem('hireon_access_token')
    sessionStorage.removeItem('hireon_refresh_token')
  }
}
